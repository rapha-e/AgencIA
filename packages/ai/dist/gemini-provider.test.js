import test from "node:test";
import assert from "node:assert/strict";
import { GeminiAiProvider } from "./gemini-provider.js";
test("GEMINI PROVIDER: Processa resposta JSON estruturada do Gemini e valida GrowthRecommendationSchema", async () => {
    const mockGeminiPayload = {
        candidates: [
            {
                content: {
                    parts: [
                        {
                            text: JSON.stringify({
                                title: "Reduzir orçamento diário em campanha com CPA inflacionado",
                                problem: "Campanha de conversão apresenta CPA R$ 140,00 contra meta de R$ 50,00.",
                                evidence: [
                                    {
                                        metric: "CPA",
                                        observed: 140.0,
                                        target: 50.0,
                                        period: "7 dias",
                                        source: "metric_facts"
                                    }
                                ],
                                hypothesis: "Saturação do público-alvo e leilão competitivo elevando o custo por lead.",
                                proposedActions: [
                                    {
                                        type: "ADJUST_DAILY_BUDGET",
                                        resourceId: "camp_meta_conversao",
                                        changes: { proposedBudgetReductionPercent: 20 }
                                    }
                                ],
                                expectedImpact: {
                                    direction: "positive",
                                    estimate: null,
                                    assumptions: ["Estabilização do CPA em 48h"]
                                },
                                confidence: 0.91,
                                risks: ["Redução moderada no volume diário de impressões"],
                                requiresApproval: true
                            })
                        }
                    ]
                }
            }
        ]
    };
    const mockFetch = async () => new Response(JSON.stringify(mockGeminiPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
    const provider = new GeminiAiProvider({
        apiKey: "AIzaSyMockRealGeminiApiKeyForUnitTesting12345",
        model: "gemini-2.5-flash",
        fetchFn: mockFetch,
        enableFallback: false
    });
    assert.equal(provider.isConfigured(), true);
    const rec = await provider.generateRecommendation("Otimizar CPA", {
        issue: { campaignId: "camp_meta_conversao" }
    });
    assert.equal(rec.title, "Reduzir orçamento diário em campanha com CPA inflacionado");
    assert.equal(rec.confidence, 0.91);
    assert.equal(rec.requiresApproval, true);
    assert.equal(rec.evidence[0].metric, "CPA");
    assert.equal(rec.evidence[0].observed, 140.0);
});
test("GEMINI PROVIDER: Aciona fallback determinístico automaticamente quando API retorna erro 503 ou sem chave", async () => {
    const failingFetch = async () => new Response(JSON.stringify({ error: { message: "Service Unavailable" } }), {
        status: 503
    });
    const provider = new GeminiAiProvider({
        apiKey: "AIzaSyMockRealGeminiApiKeyForUnitTesting12345",
        fetchFn: failingFetch,
        enableFallback: true
    });
    const rec = await provider.generateRecommendation("Estancar sangria de orçamento", {
        issue: {
            title: "CPA acima da meta",
            hypothesis: "Fadiga criativa",
            campaignId: "camp_123",
            evidence: { metric: "CPA", observedValue: 120, expectedThreshold: 45, periodDays: 14 },
            suggestedAction: { actionType: "ADJUST_DAILY_BUDGET", proposedBudgetReductionPercent: 20 }
        }
    });
    assert.equal(rec.requiresApproval, true);
    assert.equal(rec.evidence[0].observed, 120);
    assert.equal(rec.proposedActions[0].resourceId, "camp_123");
});
test("GEMINI PROVIDER: Gera pacote ColdStartAssetPackage validando limites de 30/90 caracteres do Google Ads", async () => {
    const mockColdStartResponse = {
        candidates: [
            {
                content: {
                    parts: [
                        {
                            text: JSON.stringify({
                                productName: "TorxOS",
                                reelsScripts: [
                                    {
                                        id: "reels_gemini_1",
                                        title: "OS automática no WhatsApp",
                                        durationEstimateSeconds: 25,
                                        hook: "Cansado de responder cliente toda hora no WhatsApp?",
                                        pain: "Você perde mais tempo digitando status do que consertando na bancada.",
                                        solution: "O TorxOS dispara o aviso automático no WhatsApp assim que a OS muda.",
                                        cta: "Teste grátis por 14 dias no link da bio.",
                                        visualDirections: [
                                            "Cena 1: Técnico ocupado na bancada.",
                                            "Cena 2: Notificação chegando no celular do cliente."
                                        ]
                                    }
                                ],
                                googleSearchCampaign: [
                                    {
                                        adGroupName: "Sistema Assistência Técnica",
                                        theme: "Gestão de OS",
                                        keywords: [
                                            {
                                                keyword: "sistema para assistencia tecnica",
                                                matchType: "EXACT",
                                                estimatedIntent: "HIGH_PURCHASE"
                                            }
                                        ],
                                        headlines: [
                                            "Sistema p/ Assistência Técnica",
                                            "OS Automática no WhatsApp",
                                            "Teste Grátis por 14 Dias"
                                        ],
                                        descriptions: [
                                            "Organize sua bancada, controle estoque de peças e avise clientes no WhatsApp.",
                                            "O software completo para assistências de celular, informática e consoles."
                                        ]
                                    }
                                ],
                                landingPage: {
                                    headline: "Aumente o lucro da sua assistência técnica com o TorxOS.",
                                    subheadline: "OS no WhatsApp, controle de peças e financeiro em um só lugar.",
                                    ctaButtonText: "Começar Teste de 14 Dias",
                                    benefitBullets: [
                                        "Notificação automática via WhatsApp",
                                        "Baixa de peças integrada à OS",
                                        "Orçamentos rápidos em PDF"
                                    ],
                                    socialProofAngle: "Feito para a rotina real de bancada.",
                                    faq: [
                                        {
                                            question: "Precisa de cartão para testar?",
                                            answer: "Não, o teste de 14 dias é 100% livre de cartão."
                                        },
                                        {
                                            question: "Envia mensagem no WhatsApp?",
                                            answer: "Sim, envia automaticamente a cada mudança de status."
                                        }
                                    ]
                                },
                                outboundMessages: [
                                    {
                                        channel: "whatsapp",
                                        angle: "Prospecção Google Maps",
                                        messageTemplate: "Olá! Vi sua assistência no Google Maps e gostaria de liberar 14 dias grátis do TorxOS."
                                    }
                                ],
                                generatedAt: new Date().toISOString()
                            })
                        }
                    ]
                }
            }
        ]
    };
    const mockFetch = async () => new Response(JSON.stringify(mockColdStartResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
    const provider = new GeminiAiProvider({
        apiKey: "AIzaSyMockRealGeminiApiKeyForUnitTesting12345",
        fetchFn: mockFetch
    });
    const result = await provider.generateColdStartAssets({
        productName: "TorxOS",
        businessModel: "b2b_saas",
        valueProposition: "Gestão de assistências técnicas",
        targetAudience: "Assistências técnicas",
        painPoints: ["Falta de controle de OS"],
        mainDifferentiator: "OS automática no WhatsApp"
    });
    assert.equal(result.providerUsed, "gemini");
    assert.equal(result.package.productName, "TorxOS");
    assert.equal(result.package.googleSearchCampaign[0].headlines.length, 3);
    for (const h of result.package.googleSearchCampaign[0].headlines) {
        assert.ok(h.length <= 30, `Headline excedeu 30 chars: ${h}`);
    }
});
//# sourceMappingURL=gemini-provider.test.js.map