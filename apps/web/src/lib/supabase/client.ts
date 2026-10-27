import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase Client para componentes executados no navegador (Client Components).
 * Utiliza estritamente as chaves públicas (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock-project.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
