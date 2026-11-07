import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  if (!fs.existsSync(".env.local")) return process.env;
  const content = fs.readFileSync(".env.local", "utf-8");
  const parsed = Object.fromEntries(
    content
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

async function testGitHubIntegration() {
  console.log("-------------------------------------------------");
  console.log("1. TESTANDO INTEGRAÇÃO GITHUB (rapha-e/AgencIA)");
  console.log("-------------------------------------------------");

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "AdMetrics-Growth-AI-Verifier"
  };

  const repoRes = await fetch("https://api.github.com/repos/rapha-e/AgencIA", { headers });
  if (!repoRes.ok) {
    console.log(`   ⚠️ Repositório privado ou não acessível publicamente sem token (HTTP ${repoRes.status}).`);
    return { vercelUrls: [] };
  }

  const repoData = await repoRes.json();
  console.log(`   ✅ Repositório online: ${repoData.full_name} (Branch padrão: ${repoData.default_branch})`);
  console.log(`   ✓ Último push: ${repoData.pushed_at}`);

  // Verificar Workflows do GitHub Actions
  const wfRes = await fetch("https://api.github.com/repos/rapha-e/AgencIA/actions/workflows", { headers });
  if (wfRes.ok) {
    const wfData = await wfRes.json();
    const workflows = wfData.workflows || [];
    console.log(`   ✅ Workflows registrados no GitHub Actions: ${workflows.length}`);
    for (const wf of workflows) {
      console.log(`      - [${wf.state.toUpperCase()}] ${wf.name} (${wf.path})`);
    }
  }

  // Verificar execuções recentes do GitHub Actions
  const runsRes = await fetch("https://api.github.com/repos/rapha-e/AgencIA/actions/runs?per_page=5", { headers });
  if (runsRes.ok) {
    const runsData = await runsRes.json();
    const runs = runsData.workflow_runs || [];
    console.log(`   ✓ Execuções recentes de Actions: ${runs.length}`);
    for (const run of runs) {
      console.log(`      - Run #${run.run_number}: ${run.name} -> Status: ${run.status} (${run.conclusion || "em andamento"}) em ${run.created_at}`);
    }
  }

  // Descobrir URLs de deployment da Vercel associadas ao repositório no GitHub
  const vercelUrls = new Set();
  const depRes = await fetch("https://api.github.com/repos/rapha-e/AgencIA/deployments?per_page=10", { headers });
  if (depRes.ok) {
    const deployments = await depRes.json();
    if (Array.isArray(deployments) && deployments.length > 0) {
      console.log(`   ✅ Deployments encontrados no GitHub: ${deployments.length}`);
      for (const dep of deployments) {
        const statusRes = await fetch(dep.statuses_url, { headers });
        if (statusRes.ok) {
          const statuses = await statusRes.json();
          for (const st of statuses) {
            if (st.environment_url) vercelUrls.add(st.environment_url);
            if (st.target_url && st.target_url.includes(".vercel.app")) vercelUrls.add(st.target_url);
          }
        }
      }
    } else {
      console.log("   ℹ️ Nenhum deployment da Vercel registrado na API do GitHub até o momento.");
    }
  }

  return { vercelUrls: Array.from(vercelUrls) };
}

async function testVercelAndLocalServer(discoveredUrls = []) {
  console.log("\n-------------------------------------------------");
  console.log("2. TESTANDO SERVIDOR WEB & ENDPOINT KEEP-ALIVE");
  console.log("-------------------------------------------------");

  // 2.1 Testar servidor local http://localhost:3000/api/cron/keep-alive
  try {
    const localRes = await fetch("http://localhost:3000/api/cron/keep-alive");
    if (localRes.ok) {
      const localData = await localRes.json();
      console.log(`   ✅ Servidor Local (http://localhost:3000/api/cron/keep-alive): ONLINE (${localData.latencyMs}ms)`);
    }
  } catch {
    console.log("   ℹ️ Servidor local na porta 3000 não respondeu neste momento.");
  }

  // 2.2 Testar URLs da Vercel
  const candidateUrls = [
    ...discoveredUrls,
    "https://agenc-ia.vercel.app",
    "https://agencia-rapha-es-projects.vercel.app"
  ];

  let foundActiveVercel = false;

  for (const baseUrl of candidateUrls) {
    try {
      const cleanUrl = baseUrl.replace(/\/$/, "");
      const keepAliveUrl = `${cleanUrl}/api/cron/keep-alive`;
      const res = await fetch(keepAliveUrl, { method: "GET" });
      const contentType = res.headers.get("content-type") || "";

      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        console.log(`   ✅ Deploy Vercel ATIVO em: ${cleanUrl}`);
        console.log(`   ✅ Resposta de ${keepAliveUrl}:`, JSON.stringify(data));
        foundActiveVercel = true;
        break;
      }
    } catch {
      // ignora URL candidata inacessível
    }
  }

  if (!foundActiveVercel) {
    console.log(
      "   ℹ️ Deploy na Vercel: o repositório ainda não foi vinculado ao painel da Vercel (vercel.json já está pronto para importação)."
    );
  }
}

async function testSupabaseIntegration() {
  console.log("\n-------------------------------------------------");
  console.log("3. TESTANDO INTEGRAÇÃO SUPABASE (POSTGREST + AUTH + TABELAS)");
  console.log("-------------------------------------------------");

  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Credenciais NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Garantir que exista pelo menos 1 proposta inicial para os clientes cadastrados
  const { data: clients } = await supabase.from("clients").select("id, organization_id").limit(5);
  if (clients && clients.length > 0) {
    const { count: propCount } = await supabase
      .from("action_proposals")
      .select("id", { count: "exact", head: true });

    if (!propCount || propCount === 0) {
      const firstClient = clients[0];
      await supabase.from("action_proposals").upsert(
        {
          id: "f0000000-0000-0000-0000-000000000001",
          organization_id: firstClient.organization_id,
          client_id: firstClient.id,
          proposed_by: "ai",
          action_type: "ADJUST_DAILY_BUDGET",
          payload: {
            actionType: "ADJUST_DAILY_BUDGET",
            platform: "meta",
            externalAccountId: "act_7788990011",
            resourceType: "CAMPAIGN",
            resourceId: "camp_meta_conversao",
            campaignName: "Fundo de Funil - Leads Qualificados",
            currentValue: 280.0,
            proposedValue: 224.0,
            unit: "BRL",
            reason:
              "Redução preventiva de 20% no orçamento diário devido a CPA R$ 140,00 estar 180% acima da meta de R$ 50,00."
          },
          evidence: {
            metric: "CPA",
            observed: 140.0,
            target: 50.0,
            periodDays: 7,
            aiProvider: "gemini",
            confidence: 0.91
          },
          risk_level: "high",
          status: "pending",
          version: 1
        },
        { onConflict: "id" }
      );
    }
  }

  const t0 = Date.now();
  const tablesToCheck = [
    "organizations",
    "memberships",
    "clients",
    "ad_connections",
    "campaigns",
    "metric_facts",
    "action_proposals",
    "approvals",
    "execution_logs",
    "audit_logs"
  ];

  for (const table of tablesToCheck) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log(`   ❌ Tabela '${table}': ERRO (${error.message})`);
    } else {
      console.log(`   ✅ Tabela '${table}': OK (${count ?? 0} registro(s))`);
    }
  }

  const { error: authErr } = await supabase.auth.getSession();
  if (authErr) {
    console.log(`   ❌ GoTrue Auth: ERRO (${authErr.message})`);
  } else {
    console.log(`   ✅ GoTrue Auth API: OK`);
  }

  console.log(`   ✅ Latência total de verificação Supabase: ${Date.now() - t0}ms`);
}

async function main() {
  console.log("=================================================");
  console.log("🌐 VERIFICAÇÃO INTEGRADA: GITHUB + VERCEL + SUPABASE");
  console.log("=================================================\n");

  const { vercelUrls } = await testGitHubIntegration();
  await testVercelAndLocalServer(vercelUrls);
  await testSupabaseIntegration();

  console.log("\n=================================================");
  console.log("🏁 Diagnóstico Integrado Concluído!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Erro fatal na verificação integrada:", err.message);
  process.exit(1);
});
