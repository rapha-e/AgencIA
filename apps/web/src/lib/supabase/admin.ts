import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com permissões de SERVICE ROLE.
 * RESTRIÇÃO CRÍTICA DE SEGURANÇA:
 * - Deve ser invocado EXCLUSIVAMENTE em ambiente de servidor (Node.js / Route Handlers protegidos).
 * - NUNCA deve ser importado em componentes com "use client" nem exposto ao navegador.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("VIOLAÇÃO DE SEGURANÇA: createAdminClient não pode ser executado no navegador.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configurações do Supabase Service Role ausentes no ambiente.");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
