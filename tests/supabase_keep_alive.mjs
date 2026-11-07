import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvVars() {
  if (!fs.existsSync(".env.local")) return process.env;
  const envContent = fs.readFileSync(".env.local", "utf-8");
  const parsed = Object.fromEntries(
    envContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx), l.slice(idx + 1).replace(/^["']|["']$/g, "")];
      })
  );
  return { ...process.env, ...parsed };
}

export async function runSupabaseKeepAlive() {
  const startTime = Date.now();
  const env = loadEnvVars();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your-project")) {
    throw new Error("Variáveis NEXT_PUBLIC_SUPABASE_URL ou chave de acesso ausentes.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Consulta real via PostgREST
  const { count, error } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Falha no ping PostgREST: ${error.message}`);
  }

  // 2. Consulta real na API de Auth (GoTrue)
  await supabase.auth.getSession();

  const latencyMs = Date.now() - startTime;
  console.log(
    `✅ [Supabase Keep-Alive] Sucesso! PostgREST & Auth ativos (Organizações verificadas: ${count ?? 0}, Latência: ${latencyMs}ms) — ${new Date().toISOString()}`
  );
}

if (process.argv[1]?.includes("supabase_keep_alive")) {
  runSupabaseKeepAlive().catch((err) => {
    console.error("❌ [Supabase Keep-Alive] Erro:", err.message);
    process.exit(1);
  });
}

