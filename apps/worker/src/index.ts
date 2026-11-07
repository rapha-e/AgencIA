import { MockAdsConnector, syncGoogleConnections } from "@admetrics/integrations";
import { runHeuristicDiagnostics } from "@admetrics/diagnostics";
import { ActionExecutionOrchestrator } from "@admetrics/execution";
import { createAiProvider } from "@admetrics/ai";
import { ActionProposal, Client } from "@admetrics/domain";
export { syncMetaConnections } from "./sync-meta.js";
export { syncGoogleConnections };
export { pingSupabaseKeepAlive, startDailyKeepAliveScheduler } from "./keep-alive.js";

async function main() {
  console.log("=================================================");
  console.log("🚀 AdMetrics & Growth AI — Async Worker Iniciado");
  console.log("=================================================\n");

  const connector = new MockAdsConnector("meta");
  const orchestrator = new ActionExecutionOrchestrator();
  const aiProvider = createAiProvider();

  const clientId = "c0000000-0000-0000-0000-000000000001";
  const orgId = "a0000000-0000-0000-0000-000000000001";
  const client: Client = {
    id: clientId,
    organizationId: orgId,
    name: "Alpha E-commerce B2B",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    maxDailyBudgetLimit: 1500.0,
    maxSingleBudgetIncreasePercent: 20,
    createdAt: new Date().toISOString()
  };

  // 1. Sincronização de Campanhas e Métricas
  console.log("1. Sincronizando contas e métricas do Meta Ads...");
  const accounts = await connector.listAccounts();
  console.log(`   ✓ Contas conectadas: ${accounts.map((a: { name: string }) => a.name).join(", ")}`);

  const syncCampResult = await connector.syncCampaigns(accounts[0].id, clientId);
  console.log(`   ✓ Campanhas sincronizadas: ${syncCampResult.recordsCount}`);

  const metricsResult = await connector.fetchMetrics(accounts[0].id, clientId, {
    start: "2026-10-14",
    end: "2026-10-26"
  });
  console.log(`   ✓ Fatos de métricas diárias coletados: ${metricsResult.recordsCount}`);

  // 2. Execução do Motor de Diagnóstico Determinístico
  console.log("\n2. Executando regras heurísticas de diagnóstico determinístico...");
  const issues = runHeuristicDiagnostics(metricsResult.data, {
    targetCpa: 50.0,
    targetRoas: 4.0
  });
  console.log(`   ✓ Anomalias identificadas: ${issues.length}`);

  for (const issue of issues) {
    console.log(`     - [${issue.severity.toUpperCase()}] ${issue.title} (Campanha: ${issue.campaignId})`);
    console.log(`       Evidência: ${issue.evidence.metric} = R$ ${issue.evidence.observedValue.toFixed(2)} (Meta: R$ ${issue.evidence.expectedThreshold.toFixed(2)})`);
  }

  // 3. Growth Copilot / IA com Evidências
  if (issues.length > 0) {
    console.log("\n3. Gerando recomendação estruturada com IA a partir de evidências reais...");
    const primaryIssue = issues[0];
    const aiRecommendation = await aiProvider.generateRecommendation(
      "Otimizar orçamento e estancar prejuízo",
      { issue: primaryIssue }
    );
    console.log(`   ✓ Título da recomendação: "${aiRecommendation.title}"`);
    console.log(`   ✓ Confiança calibrada: ${(aiRecommendation.confidence * 100).toFixed(0)}%`);
    console.log(`   ✓ Requer aprovação humana explícita: ${aiRecommendation.requiresApproval}`);

    // 4. Montar Proposta Versionada de Ação
    const proposal: ActionProposal = {
      id: crypto.randomUUID(),
      organizationId: orgId,
      clientId,
      proposedBy: "ai",
      actionType: "ADJUST_DAILY_BUDGET",
      payload: {
        actionType: "ADJUST_DAILY_BUDGET",
        platform: "meta",
        externalAccountId: accounts[0].id,
        resourceType: "CAMPAIGN",
        resourceId: primaryIssue.campaignId,
        currentValue: 280.0,
        proposedValue: 224.0, // Redução preventiva de 20%
        unit: "BRL",
        reason: primaryIssue.suggestedAction.recommendationText
      },
      evidence: primaryIssue.evidence,
      riskLevel: primaryIssue.severity,
      status: "pending",
      version: 1,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString()
    };

    console.log("\n4. Proposta gerada na Central de Aprovações (Status: PENDING):");
    console.log(`   - Campanha: ${proposal.payload.resourceId}`);
    console.log(`   - De: R$ ${proposal.payload.currentValue} → Para: R$ ${proposal.payload.proposedValue}`);

    // 5. Simulação de Aprovação Humana do Gestor de Tráfego
    console.log("\n5. Gestor de tráfego revisou e aprovou a proposta...");
    const { proposal: approvedProposal, approval } = orchestrator.applyApprovalDecision(
      proposal,
      "user_gestor_raphael",
      "approved",
      "Aprovado após conferência do CPA no gerenciador nativo."
    );
    console.log(`   ✓ Decisão registrada: ${approval.decision.toUpperCase()} para Versão ${approval.approvedVersion}`);

    // 6. Execução Autorizada via Adaptador Oficial com Idempotência
    console.log("\n6. Orquestrador disparando execução autorizada na API externa...");
    const execution = await orchestrator.executeApprovedProposal(
      approvedProposal,
      approval,
      client,
      connector
    );

    if (execution.success) {
      console.log(`   ✅ SUCESSO! Campanha atualizada no Meta Ads.`);
      console.log(`   ✓ Idempotency Key: ${execution.executionLog?.idempotencyKey}`);
      console.log(`   ✓ Operação Remota: ${execution.executionLog?.responsePayload?.remoteOperationId}`);
    } else {
      console.log(`   ❌ FALHA: ${execution.error}`);
    }
  }

  console.log("\n=================================================");
  console.log("🏁 Ciclo de Operação Concluído com Sucesso!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Erro fatal no worker:", err);
  process.exit(1);
});
