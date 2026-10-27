import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Route Handler para troca de código de autorização PKCE por sessão.
 * Utilizado após confirmação de e-mail ou login social.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Prevenção de Open Redirect: validar que o destino é um caminho relativo seguro
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Se houver erro ou ausência de código, redireciona para a tela de login com indicação de erro
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
