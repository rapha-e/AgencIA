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
  ctr: number;        // Click-Through Rate (%)
  cpc: number;        // Custo por Clique (R$)
  cpm: number;        // Custo por Mil Impressões (R$)
  conversionRate: number; // Taxa de Conversão (%)
  cpa: number;        // Custo por Aquisição / Conversão (R$)
  roas: number;       // Return on Ad Spend (x)
  cpl: number;        // Custo por Lead (R$)
  cac: number;        // Custo de Aquisição de Clientes (R$)
}

/**
 * Arredonda valor para número seguro de casas decimais
 */
export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * CTR = Cliques ÷ Impressões × 100
 */
export function calculateCTR(clicks: number, impressions: number): number {
  if (impressions <= 0 || clicks <= 0) return 0;
  return roundTo((clicks / impressions) * 100, 2);
}

/**
 * CPC = Investimento ÷ Cliques
 */
export function calculateCPC(spend: number, clicks: number): number {
  if (clicks <= 0 || spend <= 0) return 0;
  return roundTo(spend / clicks, 2);
}

/**
 * CPM = (Investimento ÷ Impressões) × 1.000
 */
export function calculateCPM(spend: number, impressions: number): number {
  if (impressions <= 0 || spend <= 0) return 0;
  return roundTo((spend / impressions) * 1000, 2);
}

/**
 * Taxa de Conversão = Conversões ÷ Cliques × 100
 */
export function calculateConversionRate(conversions: number, trafficOrClicks: number): number {
  if (trafficOrClicks <= 0 || conversions <= 0) return 0;
  return roundTo((conversions / trafficOrClicks) * 100, 2);
}

/**
 * CPA = Investimento ÷ Conversões Atribuídas
 */
export function calculateCPA(spend: number, conversions: number): number {
  if (conversions <= 0 || spend <= 0) return 0;
  return roundTo(spend / conversions, 2);
}

/**
 * ROAS = Receita Atribuída ÷ Investimento Publicitário
 */
export function calculateROAS(revenue: number, spend: number): number {
  if (spend <= 0 || revenue <= 0) return 0;
  return roundTo(revenue / spend, 2);
}

/**
 * CPL = Investimento ÷ Leads Gerados
 */
export function calculateCPL(spend: number, leads: number): number {
  if (leads <= 0 || spend <= 0) return 0;
  return roundTo(spend / leads, 2);
}

/**
 * CAC = Custos Totais de Aquisição ÷ Novos Clientes Conquistados
 */
export function calculateCAC(acquisitionCosts: number, newCustomers: number): number {
  if (newCustomers <= 0 || acquisitionCosts <= 0) return 0;
  return roundTo(acquisitionCosts / newCustomers, 2);
}

/**
 * Calcula o painel consolidado de métricas garantindo determinismo
 */
export function calculateMetricSummary(input: MetricSummaryInput): MetricSummaryOutput {
  const impressions = Math.max(0, input.impressions || 0);
  const clicks = Math.max(0, input.clicks || 0);
  const spend = Math.max(0, input.spend || 0);
  const conversions = Math.max(0, input.conversions || 0);
  const revenue = Math.max(0, input.revenue || 0);
  const leads = Math.max(0, input.leads ?? conversions);
  const newCustomers = Math.max(0, input.newCustomers ?? conversions);
  const acquisitionCosts = Math.max(0, input.acquisitionCosts ?? spend);

  return {
    ctr: calculateCTR(clicks, impressions),
    cpc: calculateCPC(spend, clicks),
    cpm: calculateCPM(spend, impressions),
    conversionRate: calculateConversionRate(conversions, clicks),
    cpa: calculateCPA(spend, conversions),
    roas: calculateROAS(revenue, spend),
    cpl: calculateCPL(spend, leads),
    cac: calculateCAC(acquisitionCosts, newCustomers)
  };
}
