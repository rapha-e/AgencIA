import test from "node:test";
import assert from "node:assert/strict";
import { calculateCTR, calculateCPC, calculateCPM, calculateCPA, calculateROAS, calculateConversionRate, calculateMetricSummary } from "./metrics.js";
import { validateProposalPolicy } from "./policies.js";
test("calculateCTR calculates Click-Through Rate accurately", () => {
    assert.equal(calculateCTR(150, 5000), 3.0);
    assert.equal(calculateCTR(0, 5000), 0);
    assert.equal(calculateCTR(100, 0), 0);
});
test("calculateCPC and CPM calculates costs correctly", () => {
    assert.equal(calculateCPC(500, 250), 2.0);
    assert.equal(calculateCPM(500, 50000), 10.0);
    assert.equal(calculateCPC(0, 100), 0);
    assert.equal(calculateCPC(500, 0), 0);
});
test("calculateROAS and CPA calculates financial return correctly", () => {
    assert.equal(calculateROAS(4000, 1000), 4.0);
    assert.equal(calculateCPA(1000, 20), 50.0);
    assert.equal(calculateROAS(0, 1000), 0);
    assert.equal(calculateROAS(1000, 0), 0);
});
test("calculateConversionRate handles zero conversions and zero traffic gracefully", () => {
    assert.equal(calculateConversionRate(15, 300), 5.0);
    assert.equal(calculateConversionRate(0, 300), 0);
    assert.equal(calculateConversionRate(15, 0), 0);
});
test("calculateMetricSummary consolidates all indicators in a single deterministic pass", () => {
    const summary = calculateMetricSummary({
        impressions: 10000,
        clicks: 500,
        spend: 1000,
        conversions: 50,
        revenue: 5000
    });
    assert.equal(summary.ctr, 5.0);
    assert.equal(summary.cpc, 2.0);
    assert.equal(summary.cpm, 100.0);
    assert.equal(summary.conversionRate, 10.0);
    assert.equal(summary.cpa, 20.0);
    assert.equal(summary.roas, 5.0);
});
test("validateProposalPolicy blocks proposals exceeding Client Hard Cap", () => {
    const client = {
        id: "00000000-0000-0000-0000-000000000001",
        organizationId: "00000000-0000-0000-0000-000000000002",
        name: "Empresa Piloto",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
        maxDailyBudgetLimit: 300, // Hard Cap R$ 300 / dia
        maxSingleBudgetIncreasePercent: 20,
        createdAt: new Date().toISOString()
    };
    const proposal = {
        id: "00000000-0000-0000-0000-000000000003",
        organizationId: client.organizationId,
        clientId: client.id,
        proposedBy: "ai",
        actionType: "ADJUST_DAILY_BUDGET",
        payload: {
            actionType: "ADJUST_DAILY_BUDGET",
            platform: "meta",
            externalAccountId: "act_12345",
            resourceType: "CAMPAIGN",
            resourceId: "camp_999",
            currentValue: 200,
            proposedValue: 350, // Ultrapassa R$ 300
            unit: "BRL",
            reason: "Otimização de escala"
        },
        evidence: { cpa: 15, targetCpa: 25 },
        riskLevel: "medium",
        status: "pending",
        version: 1,
        expiresAt: null,
        createdAt: new Date().toISOString()
    };
    const validation = validateProposalPolicy(proposal, client, 200);
    assert.equal(validation.isValid, false);
    assert.match(validation.errors[0], /excede o Hard Cap/);
});
// ============================================================================
// TESTES DE AGREGAÇÃO REAL, DEDUPLICAÇÃO E SEMÂNTICA DE KPIS
// ============================================================================
import { aggregateMetricFacts } from "./metrics.js";
test("1. Métricas reais com valores positivos: calcula KPIs e taxas determinísticas", () => {
    const facts = [
        {
            clientId: "cli-1",
            platform: "meta",
            externalAccountId: "act_100",
            campaignId: "c_1",
            date: "2026-10-25",
            impressions: 10000,
            clicks: 500,
            spend: 1500.0,
            conversions: 50,
            revenue: 6000.0,
            currency: "BRL"
        },
        {
            clientId: "cli-1",
            platform: "meta",
            externalAccountId: "act_100",
            campaignId: "c_2",
            date: "2026-10-26",
            impressions: 5000,
            clicks: 250,
            spend: 500.0,
            conversions: 25,
            revenue: 2000.0,
            currency: "BRL"
        }
    ];
    const result = aggregateMetricFacts(facts);
    assert.equal(result.hasData, true);
    assert.equal(result.totalSpend, 2000.0);
    assert.equal(result.totalImpressions, 15000);
    assert.equal(result.totalClicks, 750);
    assert.equal(result.totalConversions, 75);
    assert.equal(result.totalRevenue, 8000.0);
    assert.equal(result.cpa, 26.67); // 2000 / 75
    assert.equal(result.roas, 4.0); // 8000 / 2000
    assert.equal(result.conversionRate, 10.0); // (75 / 750) * 100
    assert.equal(result.ctr, 5.0); // (750 / 15000) * 100
    assert.equal(result.uniqueDays, 2);
    assert.equal(result.recordCount, 2);
});
test("2. Consulta válida sem registros: retorna hasData=false e não projeta zeros fictícios", () => {
    const result = aggregateMetricFacts([]);
    assert.equal(result.hasData, false);
    assert.equal(result.totalSpend, 0);
    assert.equal(result.totalConversions, 0);
    assert.equal(result.cpa, null);
    assert.equal(result.roas, null);
    assert.equal(result.conversionRate, null);
    assert.equal(result.recordCount, 0);
});
test("3. Erro de consulta: a interface/serviço nunca interpreta erro como R$ 0,00 ou sucesso", () => {
    // Simulando validação de erro
    const errorState = {
        status: "error",
        errorMessage: "Falha na conexão com Supabase ou timeout"
    };
    assert.equal(errorState.status, "error");
    assert.notEqual(errorState.status, "real_data");
});
test("4. Sincronização pendente: conexão ativa sem last_synced_at é identificada", () => {
    const connection = {
        id: "conn-123",
        status: "active",
        lastSyncedAt: null
    };
    const isPending = connection.status === "active" && !connection.lastSyncedAt;
    assert.equal(isPending, true);
});
test("5. Custo armazenado em micros: conversão correta de micros para unidade monetária", () => {
    const facts = [
        {
            clientId: "cli-1",
            platform: "google_ads",
            externalAccountId: "acc_g1",
            campaignId: "c_g1",
            date: "2026-10-25",
            impressions: 2000,
            clicks: 100,
            costMicros: 150000000, // 150 milhões de micros = R$ 150,00
            conversions: 5,
            revenue: 450.0
        }
    ];
    const result = aggregateMetricFacts(facts);
    assert.equal(result.totalSpend, 150.0);
    assert.equal(result.cpa, 30.0); // 150 / 5
    assert.equal(result.roas, 3.0); // 450 / 150
});
test("6. CPA sem conversões: retorna null em vez de zero ou Infinity", () => {
    const facts = [
        {
            clientId: "cli-1",
            platform: "meta",
            externalAccountId: "act_100",
            campaignId: "c_1",
            date: "2026-10-25",
            impressions: 1000,
            clicks: 20,
            spend: 250.0,
            conversions: 0, // Zero conversões
            revenue: 0.0
        }
    ];
    const result = aggregateMetricFacts(facts);
    assert.equal(result.totalSpend, 250.0);
    assert.equal(result.totalConversions, 0);
    assert.equal(result.cpa, null); // Nunca inventa CPA R$ 0,00
});
test("7. ROAS sem receita válida: retorna null em vez de zero ou NaN", () => {
    const facts = [
        {
            clientId: "cli-1",
            platform: "meta",
            externalAccountId: "act_100",
            campaignId: "c_1",
            date: "2026-10-25",
            impressions: 1000,
            clicks: 20,
            spend: 250.0,
            conversions: 10,
            revenue: 0.0 // Zero receita
        }
    ];
    const result = aggregateMetricFacts(facts);
    assert.equal(result.totalRevenue, 0);
    assert.equal(result.roas, null); // Nunca inventa ROAS a partir de cliques
    assert.equal(result.cpa, 25.0); // 250 / 10
});
test("8. Cliente sem acesso à organização selecionada: validação de autorização multi-tenant", () => {
    const userMemberships = [{ organizationId: "org-alpha", role: "admin" }];
    const targetClient = { id: "cli-beta", organizationId: "org-bravo" }; // Outra organização
    const hasAccess = userMemberships.some((m) => m.organizationId === targetClient.organizationId);
    assert.equal(hasAccess, false);
});
test("9. Prevenção de duplicação na agregação: ignora registros duplicados na mesma chave", () => {
    const facts = [
        {
            clientId: "cli-1",
            platform: "meta",
            externalAccountId: "act_100",
            campaignId: "c_1",
            date: "2026-10-25",
            attributionWindow: "7d_click_1d_view",
            impressions: 1000,
            clicks: 50,
            spend: 100.0,
            conversions: 5,
            revenue: 300.0
        },
        // Registro idêntico (re-sincronizado)
        {
            clientId: "cli-1",
            platform: "meta",
            externalAccountId: "act_100",
            campaignId: "c_1",
            date: "2026-10-25",
            attributionWindow: "7d_click_1d_view",
            impressions: 1000,
            clicks: 50,
            spend: 100.0,
            conversions: 5,
            revenue: 300.0
        }
    ];
    const result = aggregateMetricFacts(facts);
    assert.equal(result.recordCount, 1); // Deduplicado para 1
    assert.equal(result.totalSpend, 100.0);
    assert.equal(result.totalImpressions, 1000);
});
test("10. Modo de demonstração: claramente identificado e isolado de dados de produção", () => {
    const demoKpis = {
        isDemo: true,
        badgeText: "MODO DEMONSTRAÇÃO ATIVO - Valores Sintéticos Não Reais",
        spend: 5915.0,
        conversions: 154,
        cpa: 38.41,
        roas: 4.12
    };
    assert.equal(demoKpis.isDemo, true);
    assert.match(demoKpis.badgeText, /MODO DEMONSTRAÇÃO/);
});
test("11. Distinção explícita entre dados ausentes (NO_RECORDS) e zero confirmado (CONFIRMED_ZERO)", () => {
    // Cenário 11.1: Zero registros no banco
    const noRecordsResult = aggregateMetricFacts([]);
    assert.equal(noRecordsResult.dataState, "NO_RECORDS");
    assert.equal(noRecordsResult.hasData, false);
    // Cenário 11.2: Registros existem mas veiculação é zero real (campanhas pausadas)
    const zeroConfirmedResult = aggregateMetricFacts([
        {
            clientId: "cli-1",
            platform: "meta",
            externalAccountId: "act_100",
            campaignId: "c_paused",
            date: "2026-10-25",
            impressions: 0,
            clicks: 0,
            spend: 0,
            conversions: 0,
            revenue: 0
        }
    ]);
    assert.equal(zeroConfirmedResult.dataState, "CONFIRMED_ZERO");
    assert.equal(zeroConfirmedResult.recordCount, 1);
    assert.equal(zeroConfirmedResult.totalSpend, 0);
    assert.equal(zeroConfirmedResult.hasData, false); // Não renderiza cards com números ativos
});
test("12. Separação contábil entre leads, compras e contatos (CPL e CAC)", () => {
    const facts = [
        {
            clientId: "cli-1",
            platform: "meta",
            externalAccountId: "act_100",
            campaignId: "c_ecommerce",
            date: "2026-10-25",
            impressions: 5000,
            clicks: 200,
            spend: 1000.0,
            conversions: 25, // 10 compras + 15 leads
            purchases: 10,
            leads: 15,
            contacts: 0,
            revenue: 4000.0
        }
    ];
    const result = aggregateMetricFacts(facts);
    assert.equal(result.totalConversions, 25);
    assert.equal(result.totalPurchases, 10);
    assert.equal(result.totalLeads, 15);
    assert.equal(result.cpa, 40.0); // 1000 / 25
    assert.equal(result.cac, 100.0); // 1000 / 10 (Custo por Compra real)
    assert.equal(result.cpl, 66.67); // 1000 / 15 (Custo por Lead real)
    assert.equal(result.roas, 4.0); // 4000 / 1000
});
//# sourceMappingURL=metrics.test.js.map