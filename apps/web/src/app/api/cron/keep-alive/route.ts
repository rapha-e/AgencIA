import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Executa um ping real na API REST (PostgREST) e no serviço Auth do Supabase
 * para impedir que o projeto entre em pausa automática por inatividade (regra de 7 dias do Free Tier).
 */
async function executeSupabaseKeepAlive(request: NextRequest) {
  const startTime = Date.now();

  // Se CRON_SECRET estiver configurado no ambiente, exige autenticação Bearer
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && cronSecret.trim().length > 0) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret.trim()}`) {
      return NextResponse.json(
        { error: "Não autorizado: CRON_SECRET inválido ou ausente." },
        { status: 401 }
      );
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your-project")) {
    return NextResponse.json(
      {
        success: false,
        status: "SUPABASE_NOT_CONFIGURED",
        message: "Variáveis NEXT_PUBLIC_SUPABASE_URL ou chave de acesso não configuradas.",
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Consulta leve no PostgREST (gera tráfego real no banco de dados PostgreSQL)
    const { count, error: dbError } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true });

    if (dbError) {
      throw new Error(`Erro no ping PostgREST: ${dbError.message}`);
    }

    // 2. Ping complementar na API de Auth (GoTrue)
    await supabase.auth.getSession();

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      status: "ALIVE",
      service: "supabase-keep-alive",
      organizationsCountChecked: typeof count === "number",
      latencyMs,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        status: "ERROR",
        error: err.message || "Falha ao comunicar com o Supabase.",
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return executeSupabaseKeepAlive(request);
}

export async function POST(request: NextRequest) {
  return executeSupabaseKeepAlive(request);
}

