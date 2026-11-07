import { DeterministicFallbackAiProvider, GrowthRecommendationSchema } from "./contracts.js";
import { ColdStartAssetPackageSchema, generateColdStartAssets } from "./creative-studio.js";
/**
 * Provedor Oficial Google Gemini API (Generative Language API v1beta)
 * Utiliza Structured Outputs e validação rigorosa via Zod Schema,
 * com fallback determinístico automático para resiliência em produção.
 */
export class GeminiAiProvider {
    name = "gemini";
    apiKey;
    model;
    fetchFn;
    timeoutMs;
    enableFallback;
    fallbackProvider;
    constructor(options = {}) {
        this.apiKey =
            options.apiKey ??
                (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY || "" : "");
        this.model =
            options.model ??
                (typeof process !== "undefined" && process.env?.GEMINI_MODEL
                    ? process.env.GEMINI_MODEL
                    : "gemini-2.5-flash");
        this.fetchFn = options.fetchFn || fetch;
        this.timeoutMs = options.timeoutMs ?? 20000;
        this.enableFallback = options.enableFallback ?? true;
        this.fallbackProvider = new DeterministicFallbackAiProvider();
    }
    isConfigured() {
        return Boolean(this.apiKey && this.apiKey.trim().length > 10 && !this.apiKey.includes("your-gemini-api-key"));
    }
    /**
     * Chama a API REST oficial do Gemini com JSON mode estruturado
     */
    async callGeminiJson(systemInstruction, userPrompt) {
        if (!this.isConfigured()) {
            throw new Error("GEMINI_API_KEY não configurada ou inválida.");
        }
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await this.fetchFn(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                signal: controller.signal,
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    },
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: userPrompt }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        responseMimeType: "application/json"
                    }
                })
            });
            const data = (await response.json());
            if (!response.ok || data.error) {
                const errMsg = data.error?.message || response.statusText || `HTTP ${response.status}`;
                throw new Error(`[Gemini API Error] ${errMsg}`);
            }
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText || typeof rawText !== "string") {
                throw new Error("[Gemini API Error] Resposta vazia ou sem conteúdo textual JSON.");
            }
            const cleanedJson = rawText
                .replace(/^```json\s*/i, "")
                .replace(/```\s*$/i, "")
                .trim();
            return JSON.parse(cleanedJson);
        }
        finally {
            clearTimeout(timer);
        }
    }
    /**
     * Gera uma recomendação de otimização de tráfego baseada em evidências reais
     * e validada pelo contrato GrowthRecommendationSchema.
     */
    async generateRecommendation(prompt, contextData) {
        if (!this.isConfigured()) {
            if (this.enableFallback) {
                return this.fallbackProvider.generateRecommendation(prompt, contextData);
            }
            throw new Error("GEMINI_API_KEY ausente e fallback desativado.");
        }
        const systemPrompt = [
            "Você é o Copiloto de Growth Marketing e Governança de Tráfego Pago do AdMetrics & Growth AI.",
            "Sua função é analisar anomalias determinísticas de campanhas (CPA, ROAS, CTR, CPC, conversões) e gerar recomendações estruturadas em Português do Brasil.",
            "REGRAS INEGOCIÁVEIS:",
            "1. Nunca invente métricas que não estejam no contexto fornecido.",
            "2. O campo 'requiresApproval' DEVE ser sempre booleano 'true'.",
            "3. O campo 'confidence' deve ser um número entre 0 e 1.",
            "4. Retorne EXCLUSIVAMENTE um objeto JSON válido contendo as chaves exatas:",
            "   title (string), problem (string), evidence (array de {metric, observed, target, period, source}),",
            "   hypothesis (string), proposedActions (array de {type, resourceId, changes}),",
            "   expectedImpact ({direction: 'positive'|'neutral'|'negative'|'unknown', estimate: number|null, assumptions: string[]}),",
            "   confidence (number 0..1), risks (string[]), requiresApproval (true)."
        ].join("\n");
        const userMessage = JSON.stringify({
            objective: prompt,
            context: contextData
        });
        try {
            const rawJson = await this.callGeminiJson(systemPrompt, userMessage);
            // Garantir que requiresApproval seja estritamente true antes do parse
            if (rawJson && typeof rawJson === "object") {
                rawJson.requiresApproval = true;
            }
            return GrowthRecommendationSchema.parse(rawJson);
        }
        catch (error) {
            if (this.enableFallback) {
                return this.fallbackProvider.generateRecommendation(prompt, contextData);
            }
            throw error;
        }
    }
    /**
     * Gera pacote completo de ativos de partida a frio (Cold Start) via Gemini
     * com validação de limites de caracteres do Google Ads e fallback determinístico.
     */
    async generateColdStartAssets(input) {
        if (!this.isConfigured()) {
            return {
                package: generateColdStartAssets(input),
                providerUsed: "deterministic-fallback"
            };
        }
        const systemPrompt = [
            "Você é um Estrategista Sênior de Aquisição B2B e Copywriter de Resposta Direta.",
            "Gere um pacote completo de ativos de campanha (ColdStartAssetPackage) em Português do Brasil baseado nos dados reais do produto.",
            "REGRAS DE FORMATO E RESTRIÇÕES OFICIAIS:",
            "- 'reelsScripts': mínimo 2 roteiros práticos com id, title, durationEstimateSeconds (10 a 60), hook (min 5 chars), pain (min 5 chars), solution (min 5 chars), cta (min 5 chars), visualDirections (array com min 2 cenas).",
            "- 'googleSearchCampaign': mínimo 1 grupo de anúncios com adGroupName, theme, keywords (array de {keyword, matchType: 'EXACT'|'PHRASE'|'BROAD', estimatedIntent: 'HIGH_PURCHASE'|'SOLUTION_SEARCH'|'COMPARISON'}), headlines (mínimo 3 títulos, CADA UM COM NO MÁXIMO 30 CARACTERES), descriptions (mínimo 2 descrições, CADA UMA COM NO MÁXIMO 90 CARACTERES).",
            "- 'landingPage': { headline, subheadline, ctaButtonText, benefitBullets (min 3), socialProofAngle, faq (min 2 perguntas e respostas) }.",
            "- 'outboundMessages': mínimo 2 templates ({ channel: 'whatsapp'|'instagram_dm'|'email', angle, messageTemplate }).",
            "- 'productName': nome do produto.",
            "- 'generatedAt': timestamp ISO 8601."
        ].join("\n");
        try {
            const rawJson = await this.callGeminiJson(systemPrompt, JSON.stringify(input));
            // Sanitização preventiva dos limites rígidos do Google Ads (30 e 90 caracteres)
            if (rawJson && Array.isArray(rawJson.googleSearchCampaign)) {
                for (const group of rawJson.googleSearchCampaign) {
                    if (Array.isArray(group.headlines)) {
                        group.headlines = group.headlines.map((h) => String(h).slice(0, 30));
                    }
                    if (Array.isArray(group.descriptions)) {
                        group.descriptions = group.descriptions.map((d) => String(d).slice(0, 90));
                    }
                }
            }
            if (rawJson && typeof rawJson === "object") {
                rawJson.productName = rawJson.productName || input.productName;
                rawJson.generatedAt = new Date().toISOString();
            }
            const validated = ColdStartAssetPackageSchema.parse(rawJson);
            return {
                package: validated,
                providerUsed: "gemini"
            };
        }
        catch {
            return {
                package: generateColdStartAssets(input),
                providerUsed: "deterministic-fallback"
            };
        }
    }
}
/**
 * Factory oficial de Provedor de IA
 */
export function createAiProvider(options = {}) {
    return new GeminiAiProvider(options);
}
//# sourceMappingURL=gemini-provider.js.map