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

/**
 * Estado explícito de disponibilidade de dados
 */
export type DataAvailabilityState = "ACTIVE_METRICS" | "CONFIRMED_ZERO" | "NO_RECORDS";

/**
 * Item bruto de fato métrico para agregação
 */
export interface RawFactItem {
  id?: string;
  clientId: string;
  platform: string;
  externalAccountId: string;
  campaignId?: string | null;
  date: string;
  impressions: number;
  clicks: number;
  spend?: number;
  costMicros?: number;
  conversions: number;
  purchases?: number;
  leads?: number;
  contacts?: number;
  revenue: number;
  currency?: string;
  attributionWindow?: string;
}

/**
 * Resultado da agregação determinística com semântica estrita de KPIs
 */
export interface MetricAggregationResult {
  hasData: boolean;
  dataState: DataAvailabilityState;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalPurchases: number;
  totalLeads: number;
  totalContacts: number;
  totalRevenue: number;
  cpa: number | null; // Custo por Conversão Total
  cpl: number | null; // Custo por Lead específico
  cac: number | null; // Custo por Compra específico
  roas: number | null;
  conversionRate: number | null;
  ctr: number | null;
  currency: string;
  recordCount: number;
  uniqueDays: number;
}

/**
 * Agrega fatos métricos com deduplicação anti-duplicação, normalização monetária e cálculo estrito
 */
export function aggregateMetricFacts(
  facts: RawFactItem[],
  defaultCurrency = "BRL"
): MetricAggregationResult {
  if (!facts || facts.length === 0) {
    return {
      hasData: false,
      dataState: "NO_RECORDS",
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalPurchases: 0,
      totalLeads: 0,
      totalContacts: 0,
      totalRevenue: 0,
      cpa: null,
      cpl: null,
      cac: null,
      roas: null,
      conversionRate: null,
      ctr: null,
      currency: defaultCurrency,
      recordCount: 0,
      uniqueDays: 0
    };
  }

  const seenKeys = new Set<string>();
  const uniqueDates = new Set<string>();

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalPurchases = 0;
  let totalLeads = 0;
  let totalContacts = 0;
  let totalRevenue = 0;
  let detectedCurrency = defaultCurrency;
  let deduplicatedCount = 0;

  for (const f of facts) {
    // Chave composta para prevenir dupla contagem na mesma janela de atribuição
    const deduplicationKey = `${f.platform}:${f.externalAccountId}:${f.campaignId || "account_level"}:${f.date}:${f.attributionWindow || "default"}`;
    if (seenKeys.has(deduplicationKey)) {
      continue;
    }
    seenKeys.add(deduplicationKey);
    deduplicatedCount++;
    uniqueDates.add(f.date);

    if (f.currency) {
      detectedCurrency = f.currency;
    }

    // Normalização de custo: aceita spend (unidade monetária) ou costMicros (micro-unidades)
    let itemSpend = 0;
    if (typeof f.spend === "number" && !isNaN(f.spend)) {
      itemSpend = f.spend;
    } else if (typeof f.costMicros === "number" && !isNaN(f.costMicros)) {
      itemSpend = f.costMicros / 1000000;
    }

    totalSpend += Math.max(0, itemSpend);
    totalImpressions += Math.max(0, f.impressions || 0);
    totalClicks += Math.max(0, f.clicks || 0);
    totalConversions += Math.max(0, f.conversions || 0);
    totalPurchases += Math.max(0, f.purchases || 0);
    totalLeads += Math.max(0, f.leads || 0);
    totalContacts += Math.max(0, f.contacts || 0);
    totalRevenue += Math.max(0, f.revenue || 0);
  }

  totalSpend = roundTo(totalSpend, 2);
  totalConversions = roundTo(totalConversions, 2);
  totalPurchases = roundTo(totalPurchases, 2);
  totalLeads = roundTo(totalLeads, 2);
  totalContacts = roundTo(totalContacts, 2);
  totalRevenue = roundTo(totalRevenue, 2);

  // Semântica estrita: CPA só existe quando há conversões válidas (> 0) e gasto (> 0)
  const cpa = totalConversions > 0 && totalSpend > 0
    ? roundTo(totalSpend / totalConversions, 2)
    : null;

  // CPL específico (Custo por Lead)
  const cpl = totalLeads > 0 && totalSpend > 0
    ? roundTo(totalSpend / totalLeads, 2)
    : null;

  // CAC específico (Custo por Compra)
  const cac = totalPurchases > 0 && totalSpend > 0
    ? roundTo(totalSpend / totalPurchases, 2)
    : null;

  // Semântica estrita: ROAS só existe quando há receita atribuída válida (> 0) e investimento (> 0)
  const roas = totalSpend > 0 && totalRevenue > 0
    ? roundTo(totalRevenue / totalSpend, 2)
    : null;

  // Taxa de conversão: só existe quando há cliques (> 0)
  const conversionRate = totalClicks > 0
    ? roundTo((totalConversions / totalClicks) * 100, 2)
    : null;

  // CTR: só existe quando há impressões (> 0)
  const ctr = totalImpressions > 0
    ? roundTo((totalClicks / totalImpressions) * 100, 2)
    : null;

  // Distinção explícita entre dados ausentes, zero confirmado e veiculação ativa
  let dataState: DataAvailabilityState = "NO_RECORDS";
  if (deduplicatedCount === 0) {
    dataState = "NO_RECORDS";
  } else if (totalSpend === 0 && totalImpressions === 0 && totalClicks === 0 && totalConversions === 0) {
    dataState = "CONFIRMED_ZERO";
  } else {
    dataState = "ACTIVE_METRICS";
  }

  const hasData = dataState === "ACTIVE_METRICS";

  return {
    hasData,
    dataState,
    totalSpend,
    totalImpressions,
    totalClicks,
    totalConversions,
    totalPurchases,
    totalLeads,
    totalContacts,
    totalRevenue,
    cpa,
    cpl,
    cac,
    roas,
    conversionRate,
    ctr,
    currency: detectedCurrency,
    recordCount: deduplicatedCount,
    uniqueDays: uniqueDates.size
  };
}

