import { z } from "zod";
/**
 * Contrato Oficial de Parâmetros UTM e Rastreamento de Aquisição
 * Padronização estrita conforme diretrizes de atribuição determinística.
 */
export declare const UtmParametersSchema: z.ZodObject<{
    utm_source: z.ZodString;
    utm_medium: z.ZodString;
    utm_campaign: z.ZodString;
    utm_content: z.ZodOptional<z.ZodString>;
    utm_term: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content?: string | undefined;
    utm_term?: string | undefined;
}, {
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content?: string | undefined;
    utm_term?: string | undefined;
}>;
export type UtmParameters = z.infer<typeof UtmParametersSchema>;
export interface TrackingUrlOptions {
    preserveExistingParams?: boolean;
    extraParams?: Record<string, string>;
}
/**
 * Constrói uma URL rastreável determinística preservando parâmetros pré-existentes
 * e aplicando encoding seguro em todos os componentes.
 */
export declare function buildTrackingUrl(baseUrl: string, utms: UtmParameters, options?: TrackingUrlOptions): string;
/**
 * Extrai e valida parâmetros UTM a partir de uma URL ou string de query
 */
export declare function extractUtmParameters(urlOrQuery: string): Partial<UtmParameters> | null;
export declare const AttributionChannelSchema: z.ZodEnum<["meta_ads", "google_ads", "whatsapp_direct", "organic_search", "direct", "unknown"]>;
export type AttributionChannel = z.infer<typeof AttributionChannelSchema>;
export declare const ConversionEventTypeSchema: z.ZodEnum<["lead_capture", "free_trial_started", "subscription_activated", "billing_refund", "billing_chargeback", "billing_dispute_reversed"]>;
export type ConversionEventType = z.infer<typeof ConversionEventTypeSchema>;
/**
 * Contrato de Ingestão de Evento de Aquisição (Payload recebido no endpoint)
 */
export declare const IngestionEventPayloadSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventName: z.ZodEnum<["lead_capture", "free_trial_started", "subscription_activated", "billing_refund", "billing_chargeback", "billing_dispute_reversed"]>;
    eventTimestamp: z.ZodString;
    organizationId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodOptional<z.ZodString>;
    utms: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        utm_source: z.ZodOptional<z.ZodString>;
        utm_medium: z.ZodOptional<z.ZodString>;
        utm_campaign: z.ZodOptional<z.ZodString>;
        utm_content: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        utm_term: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        utm_source?: string | undefined;
        utm_medium?: string | undefined;
        utm_campaign?: string | undefined;
        utm_content?: string | undefined;
        utm_term?: string | undefined;
    }, {
        utm_source?: string | undefined;
        utm_medium?: string | undefined;
        utm_campaign?: string | undefined;
        utm_content?: string | undefined;
        utm_term?: string | undefined;
    }>>>;
    pageUrl: z.ZodOptional<z.ZodString>;
    referrerUrl: z.ZodOptional<z.ZodString>;
    campaignId: z.ZodOptional<z.ZodString>;
    userTraits: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        userId: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        userId?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    }, {
        userId?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    }>>>;
    value: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    billingEventId: z.ZodOptional<z.ZodString>;
    billingSignature: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    eventId: string;
    eventName: "lead_capture" | "free_trial_started" | "subscription_activated" | "billing_refund" | "billing_chargeback" | "billing_dispute_reversed";
    eventTimestamp: string;
    utms: {
        utm_source?: string | undefined;
        utm_medium?: string | undefined;
        utm_campaign?: string | undefined;
        utm_content?: string | undefined;
        utm_term?: string | undefined;
    };
    userTraits: {
        userId?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    };
    value?: number | undefined;
    organizationId?: string | undefined;
    clientId?: string | undefined;
    campaignId?: string | undefined;
    pageUrl?: string | undefined;
    referrerUrl?: string | undefined;
    billingEventId?: string | undefined;
    billingSignature?: string | undefined;
}, {
    eventId: string;
    eventName: "lead_capture" | "free_trial_started" | "subscription_activated" | "billing_refund" | "billing_chargeback" | "billing_dispute_reversed";
    eventTimestamp: string;
    value?: number | undefined;
    organizationId?: string | undefined;
    currency?: string | undefined;
    clientId?: string | undefined;
    campaignId?: string | undefined;
    utms?: {
        utm_source?: string | undefined;
        utm_medium?: string | undefined;
        utm_campaign?: string | undefined;
        utm_content?: string | undefined;
        utm_term?: string | undefined;
    } | undefined;
    pageUrl?: string | undefined;
    referrerUrl?: string | undefined;
    userTraits?: {
        userId?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    billingEventId?: string | undefined;
    billingSignature?: string | undefined;
}>;
export type IngestionEventPayload = z.infer<typeof IngestionEventPayloadSchema>;
export declare const ConversionEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    eventType: z.ZodEnum<["lead_capture", "free_trial_started", "subscription_activated", "billing_refund", "billing_chargeback", "billing_dispute_reversed"]>;
    timestamp: z.ZodString;
    clientDomain: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    utmParams: z.ZodDefault<z.ZodObject<{
        utm_source: z.ZodOptional<z.ZodString>;
        utm_medium: z.ZodOptional<z.ZodString>;
        utm_campaign: z.ZodOptional<z.ZodString>;
        utm_content: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        utm_term: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        utm_source?: string | undefined;
        utm_medium?: string | undefined;
        utm_campaign?: string | undefined;
        utm_content?: string | undefined;
        utm_term?: string | undefined;
    }, {
        utm_source?: string | undefined;
        utm_medium?: string | undefined;
        utm_campaign?: string | undefined;
        utm_content?: string | undefined;
        utm_term?: string | undefined;
    }>>;
    resolvedChannel: z.ZodEnum<["meta_ads", "google_ads", "whatsapp_direct", "organic_search", "direct", "unknown"]>;
    attributionConfidence: z.ZodEnum<["EXACT_UTM", "HEURISTIC", "ORGANIC_FALLBACK", "UNATTRIBUTED"]>;
    value: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    eventId: string;
    eventType: "lead_capture" | "free_trial_started" | "subscription_activated" | "billing_refund" | "billing_chargeback" | "billing_dispute_reversed";
    timestamp: string;
    utmParams: {
        utm_source?: string | undefined;
        utm_medium?: string | undefined;
        utm_campaign?: string | undefined;
        utm_content?: string | undefined;
        utm_term?: string | undefined;
    };
    resolvedChannel: "google_ads" | "unknown" | "meta_ads" | "whatsapp_direct" | "organic_search" | "direct";
    attributionConfidence: "EXACT_UTM" | "HEURISTIC" | "ORGANIC_FALLBACK" | "UNATTRIBUTED";
    value?: number | undefined;
    clientDomain?: string | undefined;
    url?: string | undefined;
}, {
    eventId: string;
    eventType: "lead_capture" | "free_trial_started" | "subscription_activated" | "billing_refund" | "billing_chargeback" | "billing_dispute_reversed";
    timestamp: string;
    resolvedChannel: "google_ads" | "unknown" | "meta_ads" | "whatsapp_direct" | "organic_search" | "direct";
    attributionConfidence: "EXACT_UTM" | "HEURISTIC" | "ORGANIC_FALLBACK" | "UNATTRIBUTED";
    value?: number | undefined;
    currency?: string | undefined;
    clientDomain?: string | undefined;
    url?: string | undefined;
    utmParams?: {
        utm_source?: string | undefined;
        utm_medium?: string | undefined;
        utm_campaign?: string | undefined;
        utm_content?: string | undefined;
        utm_term?: string | undefined;
    } | undefined;
}>;
export type ConversionEvent = z.infer<typeof ConversionEventSchema>;
/**
 * Resolve o canal de atribuição determinístico a partir dos parâmetros UTM observados
 */
export declare function resolveAttributionChannel(utms?: Partial<UtmParameters> | null): {
    channel: AttributionChannel;
    confidence: "EXACT_UTM" | "ORGANIC_FALLBACK" | "UNATTRIBUTED";
};
/**
 * Validação da janela temporal de aceitação do evento.
 * Rejeita eventos no futuro (> 5 min) e eventos muito antigos (> 30 dias).
 */
export declare function validateEventTimeWindow(eventTimestamp: string, now?: Date, maxAgeDays?: number, maxFutureMinutes?: number): {
    valid: boolean;
    reason?: string;
};
/**
 * Implementação de HMAC-SHA-256 em TypeScript puro conforme RFC 2104.
 */
export declare function hmacSha256Hex(key: string, message: string): string;
/**
 * Pseudonimização determinística de identificadores de usuário (LGPD/GDPR).
 * Se fornecido um segredo exclusivo do servidor (pepper), utiliza HMAC-SHA-256
 * para proteção contra ataques de dicionário e rainbow tables.
 */
export declare function pseudonimizeUserTraits(traits?: {
    userId?: string;
    email?: string;
    phone?: string;
}, serverPepper?: string): string | null;
/**
/**
 * Comparação em tempo constante (Timing-Attack Resistant) para hashes e assinaturas.
 * Utiliza crypto.timingSafeEqual quando disponível em runtime Node.js, com fallback
 * bitwise constante universal para qualquer ambiente sem vazar tamanho de buffer.
 */
export declare function timingSafeEqualStrings(a: string, b: string): boolean;
/**
 * Validação criptográfica de assinatura de Webhook de Pagamento (HMAC-SHA-256).
 * Verifica se a assinatura recebida coincide exatamente com o HMAC gerado
 * a partir do payload bruto ou concatenado usando o segredo exclusivo do servidor.
 */
export declare function verifyWebhookSignature(rawPayload: string, providedSignature: string, webhookSecret: string): boolean;
/**
 * Contrato Oficial do Webhook de Faturamento Confiável (Billing Webhook)
 * Suporta pagamentos confirmados, estornos totais, reembolsos parciais e disputas.
 */
export declare const BillingWebhookPayloadSchema: z.ZodObject<{
    eventId: z.ZodString;
    clientId: z.ZodString;
    paymentId: z.ZodString;
    status: z.ZodEnum<["CONFIRMED", "PAID", "RECEIVED", "PENDING", "REFUNDED", "FAILED", "CANCELLED", "DISPUTED", "DISPUTE_REVERSED"]>;
    amount: z.ZodNumber;
    refundAmount: z.ZodOptional<z.ZodNumber>;
    originalPaymentId: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    currency: z.ZodDefault<z.ZodString>;
    customer: z.ZodOptional<z.ZodObject<{
        userId: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        userId?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    }, {
        userId?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    }>>;
    timestamp: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "CONFIRMED" | "PAID" | "RECEIVED" | "PENDING" | "REFUNDED" | "FAILED" | "CANCELLED" | "DISPUTED" | "DISPUTE_REVERSED";
    currency: string;
    clientId: string;
    eventId: string;
    timestamp: string;
    paymentId: string;
    amount: number;
    reason?: string | undefined;
    refundAmount?: number | undefined;
    originalPaymentId?: string | undefined;
    customer?: {
        userId?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    metadata?: Record<string, string> | undefined;
}, {
    status: "CONFIRMED" | "PAID" | "RECEIVED" | "PENDING" | "REFUNDED" | "FAILED" | "CANCELLED" | "DISPUTED" | "DISPUTE_REVERSED";
    clientId: string;
    eventId: string;
    timestamp: string;
    paymentId: string;
    amount: number;
    currency?: string | undefined;
    reason?: string | undefined;
    refundAmount?: number | undefined;
    originalPaymentId?: string | undefined;
    customer?: {
        userId?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    metadata?: Record<string, string> | undefined;
}>;
export type BillingWebhookPayload = z.infer<typeof BillingWebhookPayloadSchema>;
/**
 * Gera hash SHA-256 para armazenamento e comparação de ApiKeys.
 */
export declare function hashApiKey(key: string): string;
//# sourceMappingURL=tracking.d.ts.map