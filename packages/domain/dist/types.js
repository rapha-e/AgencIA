import { z } from "zod";
// --- Multi-Tenancy & Organizações ---
export const OrganizationTypeSchema = z.enum(["smb", "agency"]);
export const MembershipRoleSchema = z.enum(["owner", "admin", "manager", "analyst", "viewer"]);
export const OrganizationSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    organizationType: OrganizationTypeSchema,
    createdAt: z.string().datetime()
});
export const ClientSchema = z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    name: z.string().min(1),
    timezone: z.string().default("America/Sao_Paulo"),
    currency: z.string().default("BRL"),
    maxDailyBudgetLimit: z.number().nonnegative().optional(), // Hard Cap de segurança
    maxSingleBudgetIncreasePercent: z.number().min(1).max(100).default(20), // Ex: max 20% aumento por ação
    createdAt: z.string().datetime()
});
// --- Conexões de Plataformas de Anúncios ---
export const PlatformTypeSchema = z.enum(["meta", "google_ads"]);
export const ConnectionStatusSchema = z.enum(["pending", "active", "expired", "revoked", "error"]);
export const AdConnectionSchema = z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    clientId: z.string().uuid(),
    platform: PlatformTypeSchema,
    externalAccountId: z.string(),
    externalAccountName: z.string().optional(),
    status: ConnectionStatusSchema,
    lastSyncedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime()
});
// --- Estrutura de Campanhas e Recursos ---
export const CampaignStatusSchema = z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "UNKNOWN"]);
export const CampaignSchema = z.object({
    id: z.string().uuid(),
    connectionId: z.string().uuid(),
    clientId: z.string().uuid(),
    platform: PlatformTypeSchema,
    externalCampaignId: z.string(),
    name: z.string(),
    status: CampaignStatusSchema,
    dailyBudget: z.number().nonnegative().nullable(),
    lifetimeBudget: z.number().nonnegative().nullable(),
    objective: z.string().optional(),
    lastUpdatedRemote: z.string().datetime().optional()
});
// --- Métricas e Fatos Analíticos ---
export const MetricFactSchema = z.object({
    id: z.string().uuid(),
    clientId: z.string().uuid(),
    platform: PlatformTypeSchema,
    externalAccountId: z.string(),
    campaignId: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    impressions: z.number().nonnegative(),
    clicks: z.number().nonnegative(),
    spend: z.number().nonnegative(),
    conversions: z.number().nonnegative(),
    revenue: z.number().nonnegative(),
    currency: z.string().default("BRL"),
    attributionWindow: z.string().default("7d_click_1d_view"),
    source: z.string().default("api_sync")
});
// --- Governança, Propostas e Execução ---
export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const ProposalStatusSchema = z.enum([
    "pending",
    "approved",
    "rejected",
    "executing",
    "succeeded",
    "failed",
    "expired",
    "cancelled"
]);
export const ProposedActionTypeSchema = z.enum([
    "PAUSE_CAMPAIGN",
    "RESUME_CAMPAIGN",
    "ADJUST_DAILY_BUDGET",
    "ADJUST_TARGET_CPA"
]);
export const ProposedActionPayloadSchema = z.object({
    actionType: ProposedActionTypeSchema,
    platform: PlatformTypeSchema,
    externalAccountId: z.string(),
    resourceType: z.enum(["CAMPAIGN", "AD_SET", "AD"]),
    resourceId: z.string(),
    currentValue: z.union([z.number(), z.string(), z.boolean()]),
    proposedValue: z.union([z.number(), z.string(), z.boolean()]),
    unit: z.enum(["BRL", "USD", "PERCENT", "STATUS"]),
    reason: z.string()
});
export const ActionProposalSchema = z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    clientId: z.string().uuid(),
    proposedBy: z.enum(["ai", "analyst", "heuristic_rule"]),
    actionType: ProposedActionTypeSchema,
    payload: ProposedActionPayloadSchema,
    evidence: z.record(z.any()),
    riskLevel: RiskLevelSchema,
    status: ProposalStatusSchema,
    version: z.number().int().positive().default(1),
    expiresAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime()
});
export const ApprovalDecisionSchema = z.enum(["approved", "rejected"]);
export const ApprovalSchema = z.object({
    id: z.string().uuid(),
    proposalId: z.string().uuid(),
    approvedVersion: z.number().int().positive(),
    approvedByUserId: z.string().uuid(),
    decision: ApprovalDecisionSchema,
    decidedAt: z.string().datetime(),
    note: z.string().optional()
});
export const ExecutionLogSchema = z.object({
    id: z.string().uuid(),
    proposalId: z.string().uuid(),
    idempotencyKey: z.string(),
    platform: PlatformTypeSchema,
    requestPayload: z.record(z.any()),
    responsePayload: z.record(z.any()).nullable(),
    status: z.enum(["SUCCESS", "FAILURE"]),
    errorMessage: z.string().nullable(),
    executedAt: z.string().datetime()
});
//# sourceMappingURL=types.js.map