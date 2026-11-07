import { MetricFact, RiskLevel } from "@admetrics/domain";
export interface DiagnosticIssue {
    id: string;
    ruleCode: "SPEND_WITHOUT_CONVERSIONS" | "CPA_ABOVE_TARGET" | "CTR_DROP" | "CPC_SURGE" | "ROAS_BELOW_TARGET";
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
    minSpendForConversionAlert?: number;
    ctrDropThresholdPercent?: number;
}
/**
 * Motor de Diagnóstico Heurístico Determinístico
 * Regra: Diagnostica anomalias estritamente a partir de fatos mensurados.
 */
export declare function runHeuristicDiagnostics(metrics: MetricFact[], config?: DiagnosticConfig): DiagnosticIssue[];
//# sourceMappingURL=engine.d.ts.map