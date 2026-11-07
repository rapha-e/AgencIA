import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runHeuristicDiagnostics } from "@admetrics/diagnostics";
import { createAiProvider } from "@admetrics/ai";
import { MockAdsConnector } from "@admetrics/integrations";
import { MetricFact } from "@admetrics/domain";

export const dynamic = "force-dynamic";

const CAMPAIGN_NAME_MAP: Record<string, string> = {
  camp_meta_conversao: "Fundo de Funil - Leads Qualificados",
  camp_meta_topo: "Topo de Funil - Vídeos & Alcance",
  camp_meta_remarketing: "Remarketing - Visitantes 30D",
  "99887766": "Google Search - Intenção de Compra Exata"
};

/**
 * GET /api/proposals
 * Lista todas as propostas de ação persistidas no banco de dados para a organização e cliente.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Sessão não autenticada." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const clientId = searchParams.get("clientId");

    if (!organizationId || !clientId) {
      return NextResponse.json(
        { error: "organizationId e clientId são obrigatórios." },
        { status: 400 }
      );
    }

    // Validar vínculo multi-tenant
    const { data: membership, error: memberErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !membership) {
      return NextResponse.json(
        { error: "Acesso negado à organização informada." },
        { status: 403 }
      );
    }

    // Buscar campanhas do cliente para mapear nomes amigáveis
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("external_campaign_id, name")
      .eq("client_id", clientId);

    const campaignLookup = new Map<string, string>(Object.entries(CAMPAIGN_NAME_MAP));
    for (const c of campaigns || []) {
      campaignLookup.set(c.external_campaign_id, c.name);
    }

    // Buscar propostas no banco
    const { data: rows, error: propErr } = await supabase
      .from("action_proposals")
      .select(
        "id, organization_id, client_id, proposed_by, action_type, payload, evidence, risk_level, status, version, created_at"
      )
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (propErr) {
      return NextResponse.json(
        { error: `Erro ao consultar action_proposals: ${propErr.message}` },
        { status: 500 }
      );
    }

    const proposals = (rows || []).map((row: any) => {
      const payload = row.payload || {};
      const evidence = row.evidence || {};
      const resourceId = payload.resourceId || "camp_meta_conversao";

      return {
        id: row.id,
        campaignId: resourceId,
        campaignName:
          payload.campaignName ||
          campaignLookup.get(resourceId) ||
          `Campanha (${resourceId})`,
        platform: payload.platform || "meta",
        actionType: row.action_type || payload.actionType || "ADJUST_DAILY_BUDGET",
        currentValue: Number(payload.currentValue ?? 280),
        proposedValue: Number(payload.proposedValue ?? 224),
        unit: payload.unit || "BRL",
        reason: payload.reason || "Otimização preventiva sugerida pelo motor de governança.",
        aiTitle: evidence.aiTitle || null,
        aiProvider: evidence.aiProvider || row.proposed_by,
        confidence: evidence.confidence ?? null,
        evidenceMetric: evidence.metric || "CPA",
        evidenceObserved: Number(evidence.observed ?? evidence.observedValue ?? 140),
        evidenceTarget: Number(evidence.target ?? evidence.expectedThreshold ?? 50),
        riskLevel: row.risk_level || "high",
        status: row.status || "pending",
        version: row.version || 1,
        createdAt: row.created_at
      };
    });

    return NextResponse.json({
      success: true,
      proposals
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Falha ao carregar propostas: ${err.message}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/proposals
 * Executa o motor de diagnóstico determinístico + recomendação estruturada do Gemini
 * e persiste novas propostas na tabela public.action_proposals no Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Sessão não autenticada." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { organizationId, clientId } = body;

    if (!organizationId || !clientId) {
      return NextResponse.json(
        { error: "organizationId e clientId são obrigatórios." },
        { status: 400 }
      );
    }

    const { data: membership, error: memberErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !membership) {
      return NextResponse.json(
        { error: "Acesso negado à organização informada." },
        { status: 403 }
      );
    }

    // 1. Buscar fatos métricos reais do cliente; se não houver veiculação ativa, usar baseline do conector de simulação
    const { data: dbFacts } = await supabase
      .from("metric_facts")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .limit(60);

    let metricsToAnalyze: MetricFact[] = [];

    if (dbFacts && dbFacts.length > 0 && dbFacts.some((f: any) => Number(f.spend) > 0)) {
      metricsToAnalyze = dbFacts.map((f: any) => ({
        id: f.id,
        clientId: f.client_id,
        platform: f.platform,
        externalAccountId: f.external_account_id,
        campaignId: f.campaign_id,
        date: f.date,
        impressions: Number(f.impressions || 0),
        clicks: Number(f.clicks || 0),
        spend: Number(f.spend || 0),
        conversions: Number(f.conversions || 0),
        revenue: Number(f.revenue || 0),
        currency: f.currency || "BRL",
        attributionWindow: f.attribution_window || "7d_click_1d_view",
        source: f.source || "api_sync"
      }));
    } else {
      const mockConnector = new MockAdsConnector("meta");
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      const simulated = await mockConnector.fetchMetrics("act_7788990011", clientId, {
        start: startDate,
        end: endDate
      });
      metricsToAnalyze = simulated.data;
    }

    // 2. Rodar diagnóstico heurístico determinístico
    const issues = runHeuristicDiagnostics(metricsToAnalyze, {
      targetCpa: 50.0,
      targetRoas: 4.0
    });

    if (issues.length === 0) {
      return NextResponse.json({
        success: true,
        generatedCount: 0,
        message: "Nenhuma anomalia crítica detectada nas campanhas analisadas."
      });
    }

    // 3. Consultar provedor Gemini (com fallback determinístico) para enriquecer a proposta
    const aiProvider = createAiProvider();
    const primaryIssue = issues[0];
    const aiRec = await aiProvider.generateRecommendation(
      "Otimizar alocação de orçamento e corrigir desvio de CPA/ROAS",
      { issue: primaryIssue }
    );

    const providerUsed = aiProvider.isConfigured() ? "gemini" : "deterministic-fallback";
    const currentBudget = 280.0;
    const reductionPercent =
      primaryIssue.suggestedAction.proposedBudgetReductionPercent || 20;
    const proposedBudget =
      Math.round(currentBudget * (1 - reductionPercent / 100) * 100) / 100;

    const actionType =
      primaryIssue.suggestedAction.actionType === "PAUSE_CAMPAIGN"
        ? "PAUSE_CAMPAIGN"
        : "ADJUST_DAILY_BUDGET";

    const campaignName =
      CAMPAIGN_NAME_MAP[primaryIssue.campaignId] ||
      `Campanha (${primaryIssue.campaignId})`;

    // 4. Persistir a proposta em public.action_proposals
    const { data: inserted, error: insertErr } = await supabase
      .from("action_proposals")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        proposed_by: "ai",
        action_type: actionType,
        payload: {
          actionType,
          platform: "meta",
          externalAccountId: "act_7788990011",
          resourceType: "CAMPAIGN",
          resourceId: primaryIssue.campaignId,
          campaignName,
          currentValue: currentBudget,
          proposedValue: proposedBudget,
          unit: "BRL",
          reason: `${aiRec.title}: ${aiRec.problem}`
        },
        evidence: {
          metric: primaryIssue.evidence.metric,
          observed: primaryIssue.evidence.observedValue,
          target: primaryIssue.evidence.expectedThreshold,
          periodDays: primaryIssue.evidence.periodDays,
          spendObserved: primaryIssue.evidence.spendTotal,
          conversionsObserved: primaryIssue.evidence.conversionsTotal,
          aiTitle: aiRec.title,
          aiHypothesis: aiRec.hypothesis,
          aiProvider: providerUsed,
          confidence: aiRec.confidence
        },
        risk_level: primaryIssue.severity,
        status: "pending",
        version: 1,
        expires_at: new Date(Date.now() + 86400000).toISOString()
      })
      .select("*")
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: `Erro ao persistir proposta no banco: ${insertErr?.message}` },
        { status: 500 }
      );
    }

    // 5. Registrar auditoria
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: user.id,
      action: "AI_PROPOSAL_GENERATED",
      target_type: "action_proposal",
      target_id: inserted.id,
      details: {
        providerUsed,
        campaignId: primaryIssue.campaignId,
        confidence: aiRec.confidence
      }
    });

    return NextResponse.json({
      success: true,
      generatedCount: 1,
      aiProviderUsed: providerUsed,
      proposalId: inserted.id
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Falha ao gerar proposta com IA: ${err.message}` },
      { status: 500 }
    );
  }
}

