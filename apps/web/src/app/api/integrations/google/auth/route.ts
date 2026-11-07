import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { GoogleAdsOAuthService } from "@admetrics/integrations";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autorizado. Faça login para conectar sua conta do Google Ads." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const clientId = searchParams.get("clientId");

    if (!organizationId || !clientId) {
      return NextResponse.json(
        { error: "Parâmetros 'organizationId' e 'clientId' são obrigatórios." },
        { status: 400 }
      );
    }

    const { data: membership, error: memberError } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: "Acesso negado: Você não possui vínculo com a organização informada." },
        { status: 403 }
      );
    }

    if (!["owner", "admin", "manager"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Permissão insuficiente: Apenas Administradores ou Gestores podem conectar o Google Ads." },
        { status: 403 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Cliente não encontrado ou não pertence a esta organização." },
        { status: 404 }
      );
    }

    const googleClientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri =
      process.env.GOOGLE_ADS_REDIRECT_URI || `${appUrl}/api/integrations/google/callback`;

    if (
      !googleClientId ||
      !googleClientSecret ||
      googleClientId.includes("your-google-client-id")
    ) {
      return NextResponse.redirect(
        `${appUrl}/?meta_error=${encodeURIComponent(
          "Credenciais GOOGLE_ADS_CLIENT_ID e GOOGLE_ADS_CLIENT_SECRET não configuradas no ambiente (.env.local)."
        )}`
      );
    }

    const oauthService = new GoogleAdsOAuthService({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      redirectUri
    });

    const { stateString, nonce } = oauthService.generateSignedState({
      userId: user.id,
      organizationId,
      clientId
    });

    const cookieStore = await cookies();
    cookieStore.set("google_oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600
    });

    const authorizationUrl = oauthService.getAuthorizationUrl(stateString);

    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ url: authorizationUrl });
    }

    return NextResponse.redirect(authorizationUrl);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Falha ao iniciar autorização com Google Ads: ${error.message}` },
      { status: 500 }
    );
  }
}

