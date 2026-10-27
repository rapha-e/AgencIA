import { z } from "zod";

/**
 * Contrato de Saída Estruturada da IA
 * Conforme Seção 7.2 do Blueprint Técnico
 */
export const GrowthRecommendationSchema = z.object({
  title: z.string().min(1),
  problem: z.string().min(1),
  evidence: z.array(
    z.object({
      metric: z.string(),
      observed: z.number().nullable(),
      target: z.number().nullable(),
      period: z.string(),
      source: z.string()
    })
  ),
  hypothesis: z.string().min(1),
  proposedActions: z.array(
    z.object({
      type: z.string(),
      resourceId: z.string(),
      changes: z.record(z.unknown())
    })
  ),
  expectedImpact: z.object({
    direction: z.enum(["positive", "neutral", "negative", "unknown"]),
    estimate: z.number().nullable(),
    assumptions: z.array(z.string())
  }),
  confidence: z.number().min(0).max(1),
  risks: z.array(z.string()),
  requiresApproval: z.literal(true)
});

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
export class DeterministicFallbackAiProvider implements AiProvider {
  public readonly name = "deterministic-fallback";

  async generateRecommendation(
    prompt: string,
    contextData: any
  ): Promise<GrowthRecommendation> {
    const issue = contextData?.issue || {};

    return {
      title: issue.title || "Otimização identificada pelo motor determinístico",
      problem:
        issue.hypothesis || "Desvio significativo de indicadores em relação às metas estabelecidas.",
      evidence: [
        {
          metric: issue.evidence?.metric || "CPA",
          observed: issue.evidence?.observedValue ?? null,
          target: issue.evidence?.expectedThreshold ?? null,
          period: `${issue.evidence?.periodDays || 7} dias`,
          source: "metric_facts"
        }
      ],
      hypothesis:
        issue.hypothesis ||
        "Readequar parâmetros de entrega da campanha para restabelecer a eficiência do orçamento.",
      proposedActions: [
        {
          type: issue.suggestedAction?.actionType || "ADJUST_DAILY_BUDGET",
          resourceId: issue.campaignId || "camp_unknown",
          changes: {
            proposedBudgetReductionPercent:
              issue.suggestedAction?.proposedBudgetReductionPercent || 15
          }
        }
      ],
      expectedImpact: {
        direction: "positive",
        estimate: null, // Conforme Blueprint: nulo quando não houver base estatística suficiente
        assumptions: [
          "Redução imediata do custo por aquisição no período de 48h a 72h",
          "Preservação do aprendizado do pixel"
        ]
      },
      confidence: 0.85,
      risks: [
        "Possível desaceleração temporária no volume de cliques durante o ajuste do leilão"
      ],
      requiresApproval: true
    };
  }
}
