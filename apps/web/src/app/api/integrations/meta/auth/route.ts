import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MetaOAuthService } from "@admetrics/integrations";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autorizado. Faça login para conectar sua conta de anúncios." },
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

    // Validação de RBAC no servidor: confirma se o usuário pertence à organização
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
        { error: "Permissão insuficiente: Apenas Administradores ou Gestores podem conectar contas de anúncios." },
        { status: 403 }
      );
    }

    // Confirma se o cliente pertence à organização
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

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${appUrl}/api/integrations/meta/callback`;

    if (!appId || !appSecret) {
      return NextResponse.json(
        {
          error: "Credenciais da Meta não configuradas no servidor.",
          code: "META_CREDENTIALS_MISSING",
          message:
            "Defina as variáveis META_APP_ID e META_APP_SECRET no ambiente para habilitar o OAuth real da Meta Ads. Enquanto não configuradas, utilize o conector Sandbox de simulação."
        },
        { status: 400 }
      );
    }

    const oauthService = new MetaOAuthService({
      appId,
      appSecret,
      redirectUri
    });

    const { stateString, nonce } = oauthService.generateSignedState({
      userId: user.id,
      organizationId,
      clientId
    });

    // Armazenar nonce em cookie seguro HttpOnly para validação CSRF no retorno
    const cookieStore = await cookies();
    cookieStore.set("meta_oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600 // 10 minutos
    });

    const authorizationUrl = oauthService.getAuthorizationUrl(stateString);

    // Se a requisição solicitou JSON (ex: chamada de API do frontend), retorna URL
    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ url: authorizationUrl });
    }

    // Redirecionamento 302 direto para a tela oficial de login da Meta
    return NextResponse.redirect(authorizationUrl);
  } catch (error: any) {
    console.error("[Meta OAuth Init Error]", error);
    return NextResponse.json(
      { error: `Falha ao iniciar autorização com a Meta: ${error.message}` },
      { status: 500 }
    );
  }
}
