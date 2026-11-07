import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  GoogleAdsOAuthService,
  GoogleAdsConnector,
  encryptToken
} from "@admetrics/integrations";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const code = searchParams.get("code");
  const stateString = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !stateString) {
    const errorMsg = encodeURIComponent(
      error || "Autorização cancelada ou recusada no Google Ads."
    );
    return NextResponse.redirect(`${appUrl}/?meta_error=${errorMsg}`);
  }

  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("google_oauth_nonce")?.value;
  cookieStore.delete("google_oauth_nonce");

  if (!storedNonce) {
    return NextResponse.redirect(
      `${appUrl}/?meta_error=${encodeURIComponent(
        "Sessão de autorização Google Ads expirou ou código já utilizado (anti-replay)."
      )}`
    );
  }

  const googleClientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_ADS_REDIRECT_URI || `${appUrl}/api/integrations/google/callback`;

  if (!googleClientId || !googleClientSecret) {
    return NextResponse.redirect(
      `${appUrl}/?meta_error=${encodeURIComponent(
        "Credenciais GOOGLE_ADS_CLIENT_ID ou GOOGLE_ADS_CLIENT_SECRET ausentes no servidor."
      )}`
    );
  }

  const oauthService = new GoogleAdsOAuthService({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    redirectUri
  });

  try {
    const stateData = oauthService.verifySignedState(stateString);

    if (stateData.nonce !== storedNonce) {
      return NextResponse.redirect(
        `${appUrl}/?meta_error=${encodeURIComponent(
          "Violação de segurança CSRF no Google OAuth: Nonce inválido."
        )}`
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authErr
    } = await supabase.auth.getUser();

    if (authErr || !user || user.id !== stateData.userId) {
      return NextResponse.redirect(
        `${appUrl}/login?meta_error=${encodeURIComponent(
          "Sessão expirada ou inválida durante vinculação do Google Ads."
        )}`
      );
    }

    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", stateData.organizationId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin", "manager"].includes(membership.role)) {
      return NextResponse.redirect(
        `${appUrl}/?meta_error=${encodeURIComponent(
          "Permissão insuficiente na organização para vincular o Google Ads."
        )}`
      );
    }

    // Trocar authorization code por tokens (access + refresh)
    const tokens = await oauthService.exchangeCodeForTokens(code);

    // Descobrir a primeira conta acessível via GoogleAdsConnector
    const connector = new GoogleAdsConnector({
      accessToken: tokens.accessToken,
      developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    });

    const accounts = await connector.listAccounts();
    if (!accounts || accounts.length === 0) {
      return NextResponse.redirect(
        `${appUrl}/?meta_error=${encodeURIComponent(
          "Nenhuma conta do Google Ads encontrada para o usuário autenticado."
        )}`
      );
    }

    const primaryAccount = accounts[0];
    const encryptedAccess = encryptToken(tokens.accessToken);
    const encryptedRefresh = tokens.refreshToken
      ? encryptToken(tokens.refreshToken).versionedPayload
      : null;

    // Persistir conexão em ad_connections e segredo em connection_secrets via Service Role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const adminDb = createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const { data: connRow, error: connErr } = await adminDb
        .from("ad_connections")
        .upsert(
          {
            organization_id: stateData.organizationId,
            client_id: stateData.clientId,
            platform: "google_ads",
            external_account_id: primaryAccount.id,
            external_account_name: primaryAccount.name,
            status: "active"
          },
          { onConflict: "platform,external_account_id" }
        )
        .select("id")
        .single();

      if (connErr || !connRow) {
        throw new Error(connErr?.message || "Falha ao registrar conexão Google Ads.");
      }

      await adminDb.from("connection_secrets").upsert(
        {
          connection_id: connRow.id,
          encrypted_access_token: encryptedAccess.versionedPayload,
          encrypted_refresh_token: encryptedRefresh,
          token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: "connection_id" }
      );
    }

    return NextResponse.redirect(`${appUrl}/?google_connected=true`);
  } catch (err: any) {
    return NextResponse.redirect(
      `${appUrl}/?meta_error=${encodeURIComponent(`Falha no callback do Google Ads: ${err.message}`)}`
    );
  }
}

