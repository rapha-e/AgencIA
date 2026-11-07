import { z } from "zod";
import { roundTo } from "./metrics.js";
// --- Modelos de Negócio e Tipos de Oferta ---
export const BusinessModelSchema = z.enum([
    "b2b_saas",
    "ecommerce",
    "infoproduct",
    "local_service",
    "b2b_sales"
]);
export const PrimaryOfferSchema = z.enum([
    "free_trial",
    "demo",
    "direct_sale",
    "whatsapp_consult"
]);
// --- Esquema do Plano de Crescimento (Growth Plan) ---
export const GrowthPlanSchema = z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    clientId: z.string().uuid(),
    businessModel: BusinessModelSchema,
    productName: z.string().min(1),
    productUrl: z.string().url().optional().or(z.literal("")),
    valueProposition: z.string().min(5),
    targetAudience: z.string().min(5),
    painPoints: z.array(z.string()).default([]),
    mainDifferentiator: z.string().min(3),
    primaryOffer: PrimaryOfferSchema.default("free_trial"),
    monthlyPrice: z.number().nonnegative().default(0),
    estimatedLtv: z.number().nonnegative().default(0),
    targetCac: z.number().nonnegative().default(0),
    targetCpl: z.number().nonnegative().default(0),
    maxDailyBudget: z.number().positive().default(50),
    version: z.number().int().positive().default(1),
    authorId: z.string().uuid().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});
/**
 * Calcula os parâmetros financeiros e contábeis de partida a frio para um produto/SaaS
 * Princípio: Todo teto de CAC e CPL deve ser deduzido matematicamente do LTV e margem.
 */
export function calculateUnitEconomics(input) {
    const price = Math.max(0, input.monthlyPrice);
    const retention = input.avgMonthsRetention && input.avgMonthsRetention > 0 ? input.avgMonthsRetention : 10;
    const cacRatio = input.targetCacPercentOfLtv && input.targetCacPercentOfLtv > 0 ? input.targetCacPercentOfLtv : 0.20;
    const convRate = input.leadToCustomerConversionRate && input.leadToCustomerConversionRate > 0 ? input.leadToCustomerConversionRate : 0.08;
    const estimatedLtv = roundTo(price * retention, 2);
    const targetCac = roundTo(estimatedLtv * cacRatio, 2);
    const targetCpl = roundTo(targetCac * convRate, 2);
    // Recomendação de orçamento diário de teste: equivalente a pelo menos 2 a 3 leads por dia
    const maxRecommendedDailySpend = roundTo(Math.max(30, targetCpl * 3), 2);
    return {
        estimatedLtv,
        targetCac,
        targetCpl,
        maxRecommendedDailySpend
    };
}
// --- Ativos de Marketing e Criativos ---
export const MarketingChannelSchema = z.enum([
    "meta_ads",
    "google_search",
    "landing_page",
    "whatsapp_outbound"
]);
export const MarketingAssetTypeSchema = z.enum([
    "reels_script",
    "feed_ad",
    "search_keywords",
    "lp_structure",
    "outbound_message"
]);
export const MarketingAssetStatusSchema = z.enum([
    "draft",
    "approved",
    "active",
    "archived"
]);
export const MarketingAssetSchema = z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    clientId: z.string().uuid(),
    channel: MarketingChannelSchema,
    assetType: MarketingAssetTypeSchema,
    title: z.string().min(1),
    content: z.record(z.unknown()),
    status: MarketingAssetStatusSchema.default("draft"),
    version: z.number().int().positive().default(1),
    authorId: z.string().uuid().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});
//# sourceMappingURL=growth-plan.js.map