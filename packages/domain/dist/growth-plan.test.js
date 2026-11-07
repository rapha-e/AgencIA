import test from "node:test";
import assert from "node:assert/strict";
import { calculateUnitEconomics, GrowthPlanSchema, MarketingAssetSchema } from "./growth-plan.js";
test("deve calcular corretamente LTV, CAC Teto e CPL Alvo para um SaaS B2B", () => {
    // Cenário: TorxOS com mensalidade de R$ 97,00
    const result = calculateUnitEconomics({
        monthlyPrice: 97.00,
        avgMonthsRetention: 10,
        targetCacPercentOfLtv: 0.20, // 20% do LTV
        leadToCustomerConversionRate: 0.08 // 8% taxa de conversão de lead para assinante
    });
    assert.equal(result.estimatedLtv, 970.00);
    assert.equal(result.targetCac, 194.00); // 20% de 970
    assert.equal(result.targetCpl, 15.52); // 8% de 194
    assert.equal(result.maxRecommendedDailySpend, 46.56); // 3x CPL alvo
});
test("deve aplicar fallbacks seguros quando parâmetros opcionais forem omitidos", () => {
    const result = calculateUnitEconomics({
        monthlyPrice: 150.00
    });
    // Padrões: 10 meses retenção, 20% CAC, 8% lead conv
    assert.equal(result.estimatedLtv, 1500.00);
    assert.equal(result.targetCac, 300.00);
    assert.equal(result.targetCpl, 24.00);
    assert.equal(result.maxRecommendedDailySpend, 72.00);
});
test("deve validar o schema de um GrowthPlan completo com Zod", () => {
    const validPlan = {
        id: "11111111-1111-1111-1111-111111111111",
        organizationId: "22222222-2222-2222-2222-222222222222",
        clientId: "33333333-3333-3333-3333-333333333333",
        businessModel: "b2b_saas",
        productName: "TorxOS",
        productUrl: "https://torxos.tech",
        valueProposition: "Sistema operacional para centros de reparo de hardware e assistência técnica.",
        targetAudience: "Donos de assistências de celulares, computadores e eletrônicos.",
        painPoints: [
            "Cliente cobrando status no WhatsApp toda hora",
            "Peças sumindo do estoque",
            "Anotação de OS em papel ou planilhas desorganizadas"
        ],
        mainDifferentiator: "OS Digital com notificação automática via WhatsApp a cada etapa do conserto.",
        primaryOffer: "free_trial",
        monthlyPrice: 97.00,
        estimatedLtv: 970.00,
        targetCac: 194.00,
        targetCpl: 15.50,
        maxDailyBudget: 50.00,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const parsed = GrowthPlanSchema.safeParse(validPlan);
    assert.equal(parsed.success, true);
});
test("deve validar o schema de um MarketingAsset completo", () => {
    const validAsset = {
        id: "44444444-4444-4444-4444-444444444444",
        organizationId: "22222222-2222-2222-2222-222222222222",
        clientId: "33333333-3333-3333-3333-333333333333",
        channel: "meta_ads",
        assetType: "reels_script",
        title: "Reels - Você ainda avisa cliente no WhatsApp manualmente?",
        content: {
            hook: "Se você ainda manda mensagem manual para cada cliente de conserto, você tá perdendo tempo.",
            body: "Com o TorxOS, o técnico finaliza na bancada e o cliente recebe a OS no WhatsApp na hora.",
            cta: "Teste 14 dias grátis no link da bio."
        },
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const parsed = MarketingAssetSchema.safeParse(validAsset);
    assert.equal(parsed.success, true);
});
//# sourceMappingURL=growth-plan.test.js.map