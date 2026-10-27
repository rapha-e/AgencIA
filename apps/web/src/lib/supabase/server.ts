import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase Client para contexto de Servidor (Server Components, Server Actions e Route Handlers).
 * Gerencia tokens de sessão e cookies com suporte ao Next.js 15 (await cookies()).
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock-project.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // O método `setAll` pode ser chamado a partir de um Server Component
          // onde a mutação de cookies é ignorada se o middleware já os renovou.
        }
      },
    },
  });
}
