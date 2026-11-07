import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  MetaOAuthService,
  encryptToken
} from "@admetrics/integrations";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const code = searchParams.get("code");
  const stateString = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Se o usuário cancelou ou a Meta retornou erro
  if (error || !code || !stateString) {
    const errorMsg = encodeURIComponent(
      errorDescription || error || "Autorização cancelada ou recusada pelo usuário na Meta."
    );
    return NextResponse.redirect(`${appUrl}/?meta_error=${errorMsg}`);
  }

  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("meta_oauth_nonce")?.value;

  // Proteção anti-replay imediata: apagar o cookie de nonce assim que lido
  cookieStore.delete("meta_oauth_nonce");

  if (!storedNonce) {
    return NextResponse.redirect(
      `${appUrl}/?meta_error=${encodeURIComponent(
        "Sessão de autorização expirou ou código de uso único já utilizado (anti-replay)."
      )}`
    );
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${appUrl}/api/integrations/meta/callback`;

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      `${appUrl}/?meta_error=${encodeURIComponent(
        "Credenciais META_APP_ID ou META_APP_SECRET ausentes no servidor."
      )}`
    );
  }

  const oauthService = new MetaOAuthService({
    appId,
    appSecret,
    redirectUri
  });

  try {
    // 1. Validar state, expiração (10m) e CSRF com assinatura HMAC-SHA256
    const stateData = oauthService.verifySignedState(stateString);

    if (stateData.nonce !== storedNonce) {
      return NextResponse.redirect(
        `${appUrl}/?meta_error=${encodeURIComponent(
          "Violação de segurança CSRF: Nonce do state não coincide com o cookie de autorização."
        )}`
      );
    }

    // 2. Revalidação estrita da sessão do usuário autenticado no Supabase
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.redirect(
        `${appUrl}/login?meta_error=${encodeURIComponent(
          "Sessão expirada. Faça login novamente para concluir a vinculação."
        )}`
      );
    }

    // Garantir que quem está concluindo o OAuth é exatamente o mesmo usuário que o iniciou
    if (user.id !== stateData.userId) {
      return NextResponse.redirect(
        `${appUrl}/?meta_error=${encodeURIComponent(
          "Violação de segurança: O usuário logado difere do usuário que iniciou o fluxo OAuth."
        )}`
      );
    }

    // Revalidar se o usuário ainda pertence à organização e possui papel gestor/administrador
    const { data: membership, error: memberErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", stateData.organizationId)
      .eq("user_id", user.id)
      .single();

    if (memberErr || !membership || !["owner", "admin", "manager"].includes(membership.role)) {
      return NextResponse.redirect(
        `${appUrl}/?meta_error=${encodeURIComponent(
          "Acesso negado: Vínculo ou permissão insuficiente na organização solicitante."
        )}`
      );
    }

    // Revalidar se o cliente pertence à organização
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", stateData.organizationId)
      .eq("id", stateData.clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.redirect(
        `${appUrl}/?meta_error=${encodeURIComponent(
          "Cliente informado não pertence à organização autorizada."
        )}`
      );
    }

    // 3. Trocar código temporário por token de curta duração
    const shortLivedResponse = await oauthService.exchangeCodeForToken(code);

    // 4. Renovar para Long-Lived User Access Token (~60 dias de validade)
    const longLivedResponse = await oauthService.exchangeForLongLivedToken(
      shortLivedResponse.accessToken
    );

    // 5. Inspecionar token (debug_token) para assegurar conformidade e escopos
    const debugInfo = await oauthService.debugToken(longLivedResponse.accessToken);

    if (!debugInfo.isValid) {
      return NextResponse.redirect(
        `${appUrl}/?meta_error=${encodeURIComponent("O token retornado pela Meta foi marcado como inválido.")}`
      );
    }

    // 6. Criptografia AES-256-GCM antes de qualquer armazenamento
    const { versionedPayload } = encryptToken(longLivedResponse.accessToken);

    // 7. Criar sessão de staging criptografada com sessionId de uso único e timestamp
    const stagingPayload = JSON.stringify({
      sessionId: crypto.randomUUID(),
      encryptedToken: versionedPayload,
      organizationId: stateData.organizationId,
      clientId: stateData.clientId,
      userId: user.id,
      metaUserId: debugInfo.userId,
      scopes: debugInfo.scopes,
      createdAt: Date.now(),
      expiresAt: longLivedResponse.expiresIn
        ? new Date(Date.now() + longLivedResponse.expiresIn * 1000).toISOString()
        : null
    });

    const encryptedStaging = encryptToken(stagingPayload);

    cookieStore.set("meta_staging_session", encryptedStaging.versionedPayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 900 // 15 minutos para concluir a escolha da conta
    });

    // 8. Redirecionar para a página de seleção de conta autorizada
    return NextResponse.redirect(`${appUrl}/integrations/meta/accounts`);
  } catch (err: any) {
    console.error("[Meta OAuth Callback Error]", err);
    return NextResponse.redirect(
      `${appUrl}/?meta_error=${encodeURIComponent(`Falha no callback da Meta: ${err.message}`)}`
    );
  }
}
