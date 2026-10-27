import { z } from "zod";
/**
 * Contrato de Saída Estruturada da IA
 * Conforme Seção 7.2 do Blueprint Técnico
 */
export declare const GrowthRecommendationSchema: z.ZodObject<{
    title: z.ZodString;
    problem: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        metric: z.ZodString;
        observed: z.ZodNullable<z.ZodNumber>;
        target: z.ZodNullable<z.ZodNumber>;
        period: z.ZodString;
        source: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source: string;
        metric: string;
        observed: number | null;
        target: number | null;
        period: string;
    }, {
        source: string;
        metric: string;
        observed: number | null;
        target: number | null;
        period: string;
    }>, "many">;
    hypothesis: z.ZodString;
    proposedActions: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        resourceId: z.ZodString;
        changes: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        resourceId: string;
        changes: Record<string, unknown>;
    }, {
        type: string;
        resourceId: string;
        changes: Record<string, unknown>;
    }>, "many">;
    expectedImpact: z.ZodObject<{
        direction: z.ZodEnum<["positive", "neutral", "negative", "unknown"]>;
        estimate: z.ZodNullable<z.ZodNumber>;
        assumptions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        direction: "unknown" | "positive" | "neutral" | "negative";
        estimate: number | null;
        assumptions: string[];
    }, {
        direction: "unknown" | "positive" | "neutral" | "negative";
        estimate: number | null;
        assumptions: string[];
    }>;
    confidence: z.ZodNumber;
    risks: z.ZodArray<z.ZodString, "many">;
    requiresApproval: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    evidence: {
        source: string;
        metric: string;
        observed: number | null;
        target: number | null;
        period: string;
    }[];
    title: string;
    problem: string;
    hypothesis: string;
    proposedActions: {
        type: string;
        resourceId: string;
        changes: Record<string, unknown>;
    }[];
    expectedImpact: {
        direction: "unknown" | "positive" | "neutral" | "negative";
        estimate: number | null;
        assumptions: string[];
    };
    confidence: number;
    risks: string[];
    requiresApproval: true;
}, {
    evidence: {
        source: string;
        metric: string;
        observed: number | null;
        target: number | null;
        period: string;
    }[];
    title: string;
    problem: string;
    hypothesis: string;
    proposedActions: {
        type: string;
        resourceId: string;
        changes: Record<string, unknown>;
    }[];
    expectedImpact: {
        direction: "unknown" | "positive" | "neutral" | "negative";
        estimate: number | null;
        assumptions: string[];
    };
    confidence: number;
    risks: string[];
    requiresApproval: true;
}>;
export type GrowthRecommendation = z.infer<typeof GrowthRecommendationSchema>;
export interface AiProvider {
    name: string;
    generateRecommendation(prompt: string, contextData: unknown): Promise<GrowthRecommendation>;
}
/**
 * Provedor Fallback Determinístico de IA
 * Garante que se o modelo externo (Gemini/OpenAI) estiver offline,
 * a plataforma continua gerando recomendações perfeitamente estruturadas.
 */
export declare class DeterministicFallbackAiProvider implements AiProvider {
    readonly name = "deterministic-fallback";
    generateRecommendation(prompt: string, contextData: any): Promise<GrowthRecommendation>;
}
//# sourceMappingURL=contracts.d.ts.map