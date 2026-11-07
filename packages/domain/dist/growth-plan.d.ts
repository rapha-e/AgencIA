import { z } from "zod";
export declare const BusinessModelSchema: z.ZodEnum<["b2b_saas", "ecommerce", "infoproduct", "local_service", "b2b_sales"]>;
export type BusinessModel = z.infer<typeof BusinessModelSchema>;
export declare const PrimaryOfferSchema: z.ZodEnum<["free_trial", "demo", "direct_sale", "whatsapp_consult"]>;
export type PrimaryOffer = z.infer<typeof PrimaryOfferSchema>;
export declare const GrowthPlanSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    clientId: z.ZodString;
    businessModel: z.ZodEnum<["b2b_saas", "ecommerce", "infoproduct", "local_service", "b2b_sales"]>;
    productName: z.ZodString;
    productUrl: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    valueProposition: z.ZodString;
    targetAudience: z.ZodString;
    painPoints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    mainDifferentiator: z.ZodString;
    primaryOffer: z.ZodDefault<z.ZodEnum<["free_trial", "demo", "direct_sale", "whatsapp_consult"]>>;
    monthlyPrice: z.ZodDefault<z.ZodNumber>;
    estimatedLtv: z.ZodDefault<z.ZodNumber>;
    targetCac: z.ZodDefault<z.ZodNumber>;
    targetCpl: z.ZodDefault<z.ZodNumber>;
    maxDailyBudget: z.ZodDefault<z.ZodNumber>;
    version: z.ZodDefault<z.ZodNumber>;
    authorId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    organizationId: string;
    clientId: string;
    version: number;
    businessModel: "b2b_saas" | "ecommerce" | "infoproduct" | "local_service" | "b2b_sales";
    productName: string;
    valueProposition: string;
    targetAudience: string;
    painPoints: string[];
    mainDifferentiator: string;
    primaryOffer: "free_trial" | "demo" | "direct_sale" | "whatsapp_consult";
    monthlyPrice: number;
    estimatedLtv: number;
    targetCac: number;
    targetCpl: number;
    maxDailyBudget: number;
    updatedAt: string;
    productUrl?: string | undefined;
    authorId?: string | undefined;
}, {
    id: string;
    createdAt: string;
    organizationId: string;
    clientId: string;
    businessModel: "b2b_saas" | "ecommerce" | "infoproduct" | "local_service" | "b2b_sales";
    productName: string;
    valueProposition: string;
    targetAudience: string;
    mainDifferentiator: string;
    updatedAt: string;
    version?: number | undefined;
    productUrl?: string | undefined;
    painPoints?: string[] | undefined;
    primaryOffer?: "free_trial" | "demo" | "direct_sale" | "whatsapp_consult" | undefined;
    monthlyPrice?: number | undefined;
    estimatedLtv?: number | undefined;
    targetCac?: number | undefined;
    targetCpl?: number | undefined;
    maxDailyBudget?: number | undefined;
    authorId?: string | undefined;
}>;
export type GrowthPlan = z.infer<typeof GrowthPlanSchema>;
export interface UnitEconomicsInput {
    monthlyPrice: number;
    avgMonthsRetention?: number;
    targetCacPercentOfLtv?: number;
    leadToCustomerConversionRate?: number;
}
export interface UnitEconomicsOutput {
    estimatedLtv: number;
    targetCac: number;
    targetCpl: number;
    maxRecommendedDailySpend: number;
}
/**
 * Calcula os parâmetros financeiros e contábeis de partida a frio para um produto/SaaS
 * Princípio: Todo teto de CAC e CPL deve ser deduzido matematicamente do LTV e margem.
 */
export declare function calculateUnitEconomics(input: UnitEconomicsInput): UnitEconomicsOutput;
export declare const MarketingChannelSchema: z.ZodEnum<["meta_ads", "google_search", "landing_page", "whatsapp_outbound"]>;
export type MarketingChannel = z.infer<typeof MarketingChannelSchema>;
export declare const MarketingAssetTypeSchema: z.ZodEnum<["reels_script", "feed_ad", "search_keywords", "lp_structure", "outbound_message"]>;
export type MarketingAssetType = z.infer<typeof MarketingAssetTypeSchema>;
export declare const MarketingAssetStatusSchema: z.ZodEnum<["draft", "approved", "active", "archived"]>;
export type MarketingAssetStatus = z.infer<typeof MarketingAssetStatusSchema>;
export declare const MarketingAssetSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    clientId: z.ZodString;
    channel: z.ZodEnum<["meta_ads", "google_search", "landing_page", "whatsapp_outbound"]>;
    assetType: z.ZodEnum<["reels_script", "feed_ad", "search_keywords", "lp_structure", "outbound_message"]>;
    title: z.ZodString;
    content: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    status: z.ZodDefault<z.ZodEnum<["draft", "approved", "active", "archived"]>>;
    version: z.ZodDefault<z.ZodNumber>;
    authorId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "approved" | "draft" | "archived";
    id: string;
    createdAt: string;
    organizationId: string;
    clientId: string;
    version: number;
    updatedAt: string;
    channel: "meta_ads" | "google_search" | "landing_page" | "whatsapp_outbound";
    assetType: "reels_script" | "feed_ad" | "search_keywords" | "lp_structure" | "outbound_message";
    title: string;
    content: Record<string, unknown>;
    authorId?: string | undefined;
}, {
    id: string;
    createdAt: string;
    organizationId: string;
    clientId: string;
    updatedAt: string;
    channel: "meta_ads" | "google_search" | "landing_page" | "whatsapp_outbound";
    assetType: "reels_script" | "feed_ad" | "search_keywords" | "lp_structure" | "outbound_message";
    title: string;
    content: Record<string, unknown>;
    status?: "active" | "approved" | "draft" | "archived" | undefined;
    version?: number | undefined;
    authorId?: string | undefined;
}>;
export type MarketingAsset = z.infer<typeof MarketingAssetSchema>;
//# sourceMappingURL=growth-plan.d.ts.map