import { MetricFact, RiskLevel } from "@admetrics/domain";
import { calculateCPA, calculateCTR, calculateCPC, calculateROAS } from "@admetrics/domain";

export interface DiagnosticIssue {
  id: string;
  ruleCode:
    | "SPEND_WITHOUT_CONVERSIONS"
    | "CPA_ABOVE_TARGET"
    | "CTR_DROP"
    | "CPC_SURGE"
    | "ROAS_BELOW_TARGET";
  title: string;
  campaignId: string;
  severity: RiskLevel;
  evidence: {
    observedValue: number;
    expectedThreshold: number;
    metric: string;
    periodDays: number;
    spendTotal: number;
    conversionsTotal: number;
  };
  hypothesis: string;
  suggestedAction: {
    actionType: "PAUSE_CAMPAIGN" | "ADJUST_DAILY_BUDGET" | "CHECK_TRACKING";
    recommendationText: string;
    proposedBudgetReductionPercent?: number;
  };
}

export interface DiagnosticConfig {
  targetCpa?: number;
  targetRoas?: number;
  minSpendForConversionAlert?: number; // Ex: gastou mais de R$ 300 sem nenhuma conversão
  ctrDropThresholdPercent?: number;    // Ex: queda > 30% em relação ao baseline
}

/**
 * Motor de Diagnóstico Heurístico Determinístico
 * Regra: Diagnostica anomalias estritamente a partir de fatos mensurados.
 */
export function runHeuristicDiagnostics(
  metrics: MetricFact[],
  config: DiagnosticConfig = {}
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];

  const targetCpa = config.targetCpa || 40.0;
  const targetRoas = config.targetRoas || 3.0;
  const minSpendForZeroConv = config.minSpendForConversionAlert || 250.0;

  // Agrupar métricas por campanha
  const metricsByCampaign = new Map<string, MetricFact[]>();
  for (const m of metrics) {
    if (!m.campaignId) continue;
    const existing = metricsByCampaign.get(m.campaignId) || [];
    existing.push(m);
    metricsByCampaign.set(m.campaignId, existing);
  }

  for (const [campaignId, campMetrics] of metricsByCampaign.entries()) {
    // Ordenar por data crescente
    campMetrics.sort((a, b) => a.date.localeCompare(b.date));

    const totalSpend = campMetrics.reduce((sum, m) => sum + m.spend, 0);
    const totalClicks = campMetrics.reduce((sum, m) => sum + m.clicks, 0);
    const totalImpressions = campMetrics.reduce((sum, m) => sum + m.impressions, 0);
    const totalConversions = campMetrics.reduce((sum, m) => sum + m.conversions, 0);
    const totalRevenue = campMetrics.reduce((sum, m) => sum + m.revenue, 0);

    const cpa = calculateCPA(totalSpend, totalConversions);
    const roas = calculateROAS(totalRevenue, totalSpend);
    const ctr = calculateCTR(totalClicks, totalImpressions);
    const cpc = calculateCPC(totalSpend, totalClicks);

    // Regra 1: Gasto expressivo sem nenhuma conversão
    if (totalSpend >= minSpendForZeroConv && totalConversions === 0) {
      issues.push({
        id: `diag_spend_zero_conv_${campaignId}`,
        ruleCode: "SPEND_WITHOUT_CONVERSIONS",
        title: "Investimento ativo sem nenhuma conversão registrada",
        campaignId,
        severity: "critical",
        evidence: {
          observedValue: 0,
          expectedThreshold: 1,
          metric: "conversions",
          periodDays: campMetrics.length,
          spendTotal: totalSpend,
          conversionsTotal: 0
        },
        hypothesis:
          "Possível quebra de pixel/tag de conversão no site ou oferta/página de destino com fricção impeditiva.",
        suggestedAction: {
          actionType: "PAUSE_CAMPAIGN",
          recommendationText:
            "Pausar campanha temporariamente para checagem imediata de eventos no Pixel/GTM."
        }
      });
      continue; // Não acumular outros erros se não há conversão alguma
    }

    // Regra 2: CPA acima da meta tolerada (> 35% da meta)
    if (totalConversions > 0 && cpa > targetCpa * 1.35) {
      const reductionPercent = 20;
      issues.push({
        id: `diag_cpa_high_${campaignId}`,
        ruleCode: "CPA_ABOVE_TARGET",
        title: `CPA excessivamente alto (R$ ${cpa.toFixed(2)} vs meta R$ ${targetCpa.toFixed(2)})`,
        campaignId,
        severity: "high",
        evidence: {
          observedValue: cpa,
          expectedThreshold: targetCpa,
          metric: "CPA",
          periodDays: campMetrics.length,
          spendTotal: totalSpend,
          conversionsTotal: totalConversions
        },
        hypothesis:
          "Leilão inflacionado, segmentação saturada ou perda de relevância dos criativos frente aos concorrentes.",
        suggestedAction: {
          actionType: "ADJUST_DAILY_BUDGET",
          recommendationText:
            `Reduzir orçamento diário em ${reductionPercent}% para limitar prejuízo enquanto novos criativos são testados.`,
          proposedBudgetReductionPercent: reductionPercent
        }
      });
    }

    // Regra 3: ROAS insuficiente
    if (totalSpend > 200 && roas < targetRoas * 0.7 && totalRevenue > 0) {
      issues.push({
        id: `diag_roas_low_${campaignId}`,
        ruleCode: "ROAS_BELOW_TARGET",
        title: `Retorno sobre investimento abaixo da meta (${roas.toFixed(2)}x vs meta ${targetRoas.toFixed(2)}x)`,
        campaignId,
        severity: "medium",
        evidence: {
          observedValue: roas,
          expectedThreshold: targetRoas,
          metric: "ROAS",
          periodDays: campMetrics.length,
          spendTotal: totalSpend,
          conversionsTotal: totalConversions
        },
        hypothesis:
          "Ticket médio baixo ou taxa de conversão final na página de checkout em queda.",
        suggestedAction: {
          actionType: "ADJUST_DAILY_BUDGET",
          recommendationText:
            "Readequar verba para campanhas de maior rentabilidade (fundo de funil)."
        }
      });
    }

    // Regra 4: Queda brusca de CTR (sinal de fadiga de criativo nos últimos dias vs início do período)
    if (campMetrics.length >= 6) {
      const midPoint = Math.floor(campMetrics.length / 2);
      const early = campMetrics.slice(0, midPoint);
      const recent = campMetrics.slice(midPoint);

      const earlyClicks = early.reduce((s, m) => s + m.clicks, 0);
      const earlyImpr = early.reduce((s, m) => s + m.impressions, 0);
      const recentClicks = recent.reduce((s, m) => s + m.clicks, 0);
      const recentImpr = recent.reduce((s, m) => s + m.impressions, 0);

      const earlyCtr = calculateCTR(earlyClicks, earlyImpr);
      const recentCtr = calculateCTR(recentClicks, recentImpr);

      if (earlyCtr > 0 && recentCtr < earlyCtr * 0.65) {
        issues.push({
          id: `diag_ctr_drop_${campaignId}`,
          ruleCode: "CTR_DROP",
          title: `Queda abrupta no CTR (${earlyCtr.toFixed(2)}% → ${recentCtr.toFixed(2)}%)`,
          campaignId,
          severity: "medium",
          evidence: {
            observedValue: recentCtr,
            expectedThreshold: earlyCtr,
            metric: "CTR",
            periodDays: campMetrics.length,
            spendTotal: totalSpend,
            conversionsTotal: totalConversions
          },
          hypothesis:
            "Fadiga de público e saturação criativa. Os usuários já viram o mesmo anúncio repetidamente.",
          suggestedAction: {
            actionType: "CHECK_TRACKING",
            recommendationText: "Subir 3 novas variações de anúncios e renovar o criativo ativo."
          }
        });
      }
    }
  }

  return issues;
}
