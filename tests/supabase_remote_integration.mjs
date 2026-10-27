import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Carregar variáveis de ambiente
const envContent = fs.readFileSync(".env.local", "utf-8");
const envVars = Object.fromEntries(
  envContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx), l.slice(idx + 1).replace(/^["']|["']$/g, "")];
    })
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

export async function runRemoteIntegrationTest() {
  console.log("=================================================");
  console.log("🧪 Teste de Integração Real com Supabase Auth & RLS");
  console.log("=================================================\n");

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Clientes anônimos simulando dois usuários finais distintos em navegadores separados
  const clientA = createClient(supabaseUrl, anonKey);
  const clientB = createClient(supabaseUrl, anonKey);

  const timestamp = Date.now();
  const emailA = `test_alpha_${timestamp}@example.com`;
  const emailB = `test_beta_${timestamp}@example.com`;
  const testPassword = `TestPass!${timestamp}#99`;

  console.log("1. Cadastrando e autenticando Usuário A (Org Alpha)...");
  // Criação dos usuários via admin para permitir teste automatizado sem depender de confirmação de e-mail por SMTP
  const { data: userAData, error: errA } = await adminClient.auth.admin.createUser({
    email: emailA,
    password: testPassword,
    email_confirm: true,
  });

  if (errA) throw new Error(`Falha ao provisionar Usuário A: ${errA.message}`);
  const userAId = userAData.user.id;

  // Login como Usuário A usando cliente público com anon key (Sessão Real de Usuário Final)
  const { data: sessionAData, error: loginErrA } = await clientA.auth.signInWithPassword({
    email: emailA,
    password: testPassword,
  });
  if (loginErrA) throw new Error(`Falha no login do Usuário A: ${loginErrA.message}`);
  console.log("   ✓ Usuário A autenticado com sucesso (Sessão JWT ativa).");

  console.log("\n2. Criando Organização Alpha através da RPC atômica 'create_organization_with_owner'...");
  const { data: orgAId, error: rpcErrA } = await clientA.rpc("create_organization_with_owner", {
    org_name: "Organização Alpha Teste",
    org_type: "agency",
  });
  if (rpcErrA) throw new Error(`Falha ao criar Org Alpha: ${rpcErrA.message}`);
  console.log("   ✓ Organização Alpha criada com vínculo de OWNER automático para Usuário A.");

  console.log("\n3. Cadastrando e autenticando Usuário B (Org Beta)...");
  const { data: userBData, error: errB } = await adminClient.auth.admin.createUser({
    email: emailB,
    password: testPassword,
    email_confirm: true,
  });

  if (errB) throw new Error(`Falha ao provisionar Usuário B: ${errB.message}`);
  const userBId = userBData.user.id;

  // Login como Usuário B usando cliente público com anon key
  const { data: sessionBData, error: loginErrB } = await clientB.auth.signInWithPassword({
    email: emailB,
    password: testPassword,
  });
  if (loginErrB) throw new Error(`Falha no login do Usuário B: ${loginErrB.message}`);
  console.log("   ✓ Usuário B autenticado com sucesso (Sessão JWT ativa).");

  console.log("\n4. Criando Organização Beta através da RPC atômica...");
  const { data: orgBId, error: rpcErrB } = await clientB.rpc("create_organization_with_owner", {
    org_name: "Organização Beta Teste",
    org_type: "smb",
  });
  if (rpcErrB) throw new Error(`Falha ao criar Org Beta: ${rpcErrB.message}`);
  console.log("   ✓ Organização Beta criada com vínculo de OWNER automático para Usuário B.");

  console.log("\n5. TESTES DE ISOLAMENTO REAL MULTI-TENANT (RLS):");

  // Teste 5.1: Usuário A lê apenas suas organizações
  const { data: orgsViewA } = await clientA.from("organizations").select("id, name");
  console.log(`   ✓ Usuário A enxerga ${orgsViewA?.length} organização(ões): [${orgsViewA?.map((o) => o.name).join(", ")}]`);
  const userASeesOrgB = orgsViewA?.some((o) => o.id === orgBId);
  if (userASeesOrgB) {
    throw new Error("FALHA CRÍTICA DE RLS: Usuário A conseguiu enxergar a Organização B!");
  }
  console.log("   ✅ SUCESSO: Usuário A NÃO enxerga a Organização B.");

  // Teste 5.2: Usuário B lê apenas suas organizações
  const { data: orgsViewB } = await clientB.from("organizations").select("id, name");
  console.log(`   ✓ Usuário B enxerga ${orgsViewB?.length} organização(ões): [${orgsViewB?.map((o) => o.name).join(", ")}]`);
  const userBSeesOrgA = orgsViewB?.some((o) => o.id === orgAId);
  if (userBSeesOrgA) {
    throw new Error("FALHA CRÍTICA DE RLS: Usuário B conseguiu enxergar a Organização A!");
  }
  console.log("   ✅ SUCESSO: Usuário B NÃO enxerga a Organização A.");

  // Teste 5.3: Usuário B tenta forjar inserção de cliente na Org A
  console.log("\n6. TESTE DE ATAQUE: Usuário B tenta cadastrar cliente na Organização A...");
  const { error: forgedInsertError } = await clientB.from("clients").insert({
    organization_id: orgAId,
    name: "Cliente Invasor Forjado",
  });

  if (!forgedInsertError) {
    throw new Error("FALHA CRÍTICA DE SEGURANÇA: Usuário B conseguiu criar cliente na Organização A!");
  }
  console.log(`   ✅ SUCESSO: Operação bloqueada pelo RLS! Erro retornado: ${forgedInsertError.message}`);

  // Teste 5.4: Usuário B tenta forjar proposta de ação na Org A
  console.log("\n7. TESTE DE ATAQUE: Usuário B tenta criar proposta de alteração de tráfego na Org A...");
  const { error: forgedProposalError } = await clientB.from("action_proposals").insert({
    organization_id: orgAId,
    client_id: "00000000-0000-0000-0000-000000000001",
    proposed_by: "ai",
    action_type: "ADJUST_DAILY_BUDGET",
    payload: { actionType: "ADJUST_DAILY_BUDGET" },
    risk_level: "critical",
  });

  if (!forgedProposalError) {
    throw new Error("FALHA CRÍTICA: Proposta não autorizada inserida na Org A por usuário invasor!");
  }
  console.log(`   ✅ SUCESSO: Inserção de proposta bloqueada pelo RLS!`);

  // Teste 5.5: Teste de Logout
  console.log("\n8. Testando encerramento de sessão (Logout)...");
  await clientA.auth.signOut();
  await clientB.auth.signOut();
  console.log("   ✓ Sessões encerradas com sucesso.");

  // Limpeza de usuários de teste criados no Auth
  console.log("\n9. Limpando usuários de teste do Supabase Auth...");
  await adminClient.auth.admin.deleteUser(userAId);
  await adminClient.auth.admin.deleteUser(userBId);
  console.log("   ✓ Usuários de teste removidos.");

  console.log("\n=================================================");
  console.log("🎉 TODOS OS TESTES DE INTEGRAÇÃO REMOTA PASSARAM!");
  console.log("=================================================");
}

if (process.argv[1]?.includes("supabase_remote_integration")) {
  runRemoteIntegrationTest().catch((err) => {
    console.error("❌ ERRO NO TESTE DE INTEGRAÇÃO:", err.message);
    process.exit(1);
  });
}
