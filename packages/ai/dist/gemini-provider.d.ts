import { AiProvider, GrowthRecommendation } from "./contracts.js";
import { ColdStartAssetPackage, GenerateAssetsInput } from "./creative-studio.js";
export interface GeminiProviderOptions {
    apiKey?: string;
    model?: string;
    fetchFn?: typeof fetch;
    timeoutMs?: number;
    enableFallback?: boolean;
}
/**
 * Provedor Oficial Google Gemini API (Generative Language API v1beta)
 * Utiliza Structured Outputs e validação rigorosa via Zod Schema,
 * com fallback determinístico automático para resiliência em produção.
 */
export declare class GeminiAiProvider implements AiProvider {
    readonly name = "gemini";
    private readonly apiKey;
    private readonly model;
    private readonly fetchFn;
    private readonly timeoutMs;
    private readonly enableFallback;
    private readonly fallbackProvider;
    constructor(options?: GeminiProviderOptions);
    isConfigured(): boolean;
    /**
     * Chama a API REST oficial do Gemini com JSON mode estruturado
     */
    private callGeminiJson;
    /**
     * Gera uma recomendação de otimização de tráfego baseada em evidências reais
     * e validada pelo contrato GrowthRecommendationSchema.
     */
    generateRecommendation(prompt: string, contextData: unknown): Promise<GrowthRecommendation>;
    /**
     * Gera pacote completo de ativos de partida a frio (Cold Start) via Gemini
     * com validação de limites de caracteres do Google Ads e fallback determinístico.
     */
    generateColdStartAssets(input: GenerateAssetsInput): Promise<{
        package: ColdStartAssetPackage;
        providerUsed: "gemini" | "deterministic-fallback";
    }>;
}
/**
 * Factory oficial de Provedor de IA
 */
export declare function createAiProvider(options?: GeminiProviderOptions): GeminiAiProvider;
//# sourceMappingURL=gemini-provider.d.ts.map