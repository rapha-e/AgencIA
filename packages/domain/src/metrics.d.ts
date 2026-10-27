/**
 * Motores de Cálculo Determinístico de Métricas de Performance e Growth
 * Princípio Fundamental: Nenhuma métrica contábil ou financeira deve ser calculada por LLM.
 */
export interface MetricSummaryInput {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
    leads?: number;
    newCustomers?: number;
    acquisitionCosts?: number;
}
export interface MetricSummaryOutput {
    ctr: number;
    cpc: number;
    cpm: number;
    conversionRate: number;
    cpa: number;
    roas: number;
    cpl: number;
    cac: number;
}
/**
 * Arredonda valor para número seguro de casas decimais
 */
export declare function roundTo(value: number, decimals?: number): number;
/**
 * CTR = Cliques ÷ Impressões × 100
 */
export declare function calculateCTR(clicks: number, impressions: number): number;
/**
 * CPC = Investimento ÷ Cliques
 */
export declare function calculateCPC(spend: number, clicks: number): number;
/**
 * CPM = (Investimento ÷ Impressões) × 1.000
 */
export declare function calculateCPM(spend: number, impressions: number): number;
/**
 * Taxa de Conversão = Conversões ÷ Cliques × 100
 */
export declare function calculateConversionRate(conversions: number, trafficOrClicks: number): number;
/**
 * CPA = Investimento ÷ Conversões Atribuídas
 */
export declare function calculateCPA(spend: number, conversions: number): number;
/**
 * ROAS = Receita Atribuída ÷ Investimento Publicitário
 */
export declare function calculateROAS(revenue: number, spend: number): number;
/**
 * CPL = Investimento ÷ Leads Gerados
 */
export declare function calculateCPL(spend: number, leads: number): number;
/**
 * CAC = Custos Totais de Aquisição ÷ Novos Clientes Conquistados
 */
export declare function calculateCAC(acquisitionCosts: number, newCustomers: number): number;
/**
 * Calcula o painel consolidado de métricas garantindo determinismo
 */
export declare function calculateMetricSummary(input: MetricSummaryInput): MetricSummaryOutput;
//# sourceMappingURL=metrics.d.ts.map