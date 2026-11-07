import { createClient } from "@supabase/supabase-js";

export interface KeepAliveResult {
  success: boolean;
  latencyMs: number;
  timestamp: string;
  error?: string;
}

/**
 * Envia uma consulta real leve ao Supabase (PostgREST + Auth)
 * para evitar pausa por inatividade de 7 dias.
 */
export async function pingSupabaseKeepAlive(options?: {
  supabaseUrl?: string;
  supabaseKey?: string;
}): Promise<KeepAliveResult> {
  const startTime = Date.now();
  const supabaseUrl = options?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    options?.supabaseKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your-project")) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: "Credenciais do Supabase ausentes ou não configuradas."
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw new Error(error.message);
    }

    await supabase.auth.getSession();

    const latencyMs = Date.now() - startTime;
    console.log(
      `[Supabase Keep-Alive] ✅ Ping diário concluído com sucesso (${latencyMs}ms) em ${new Date().toISOString()}`
    );

    return {
      success: true,
      latencyMs,
      timestamp: new Date().toISOString()
    };
  } catch (err: any) {
    const errorMsg = err.message || "Erro desconhecido no Keep-Alive";
    console.error(`[Supabase Keep-Alive] ❌ Falha no ping:`, errorMsg);
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: errorMsg
    };
  }
}

/**
 * Inicia um agendador em segundo plano que envia um ping a cada 24 horas (por padrão)
 */
export function startDailyKeepAliveScheduler(
  intervalMs: number = 24 * 60 * 60 * 1000
): NodeJS.Timeout {
  // Executa imediatamente no boot e agenda para cada 24h
  pingSupabaseKeepAlive().catch(() => {});
  const timer = setInterval(() => {
    pingSupabaseKeepAlive().catch(() => {});
  }, intervalMs);
  timer.unref();
  return timer;
}

