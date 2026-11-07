import { z } from "zod";
/**
 * Status de pagamento normalizado entre diferentes gateways
 */
export declare const NormalizedPaymentStatusSchema: z.ZodEnum<["CONFIRMED", "PAID", "RECEIVED", "PENDING", "REFUNDED", "FAILED", "CANCELLED", "DISPUTED", "DISPUTE_REVERSED"]>;
export type NormalizedPaymentStatus = z.infer<typeof NormalizedPaymentStatusSchema>;
/**
 * Tipo contábil do evento no razão financeiro (Ledger)
 */
export type AccountingType = "CREDIT" | "DEBIT" | "NEUTRAL";
/**
 * Classificação semântica estrita do evento contábil
 */
export type FinancialEventType = "PAYMENT_CONFIRMED" | "REFUND_FULL" | "REFUND_PARTIAL" | "CHARGEBACK_DISPUTED" | "DISPUTE_REVERSED" | "UNCONFIRMED_STATUS";
/**
 * Contrato de Transação Financeira Confiável Processada
 */
export interface BillingTransaction {
    transactionId: string;
    gatewayEventId?: string;
    provider: string;
    status: NormalizedPaymentStatus;
    amount: number;
    refundAmount?: number;
    netAmount: number;
    accountingType: AccountingType;
    financialEventType: FinancialEventType;
    currency: string;
    clientId: string;
    timestamp: string;
    isRefund: boolean;
    reason?: string;
    customer?: {
        userId?: string;
        email?: string;
        phone?: string;
    };
    metadata?: Record<string, string>;
}
/**
 * Contrato Abstrato de Provedor / Gateway de Pagamento
 */
export interface BillingGatewayAdapter {
    readonly providerName: string;
    /**
     * Valida a assinatura do webhook usando a criptografia oficial do gateway
     */
    verifySignature(rawPayload: string, signatureHeader: string, secret: string): boolean;
    /**
     * Converte o payload bruto recebido para o modelo contábil normalizado do AdMetrics
     */
    parseWebhook(rawPayload: string): BillingTransaction;
}
/**
 * Validação de Elegibilidade de Estorno (Prevenção de Over-Refund).
 * Garante em precisão de centavos inteiros que a soma dos estornos nunca exceda o saldo original.
 */
export declare function validateRefundEligibility(originalAmount: number, alreadyRefunded: number, requestedRefund: number): {
    eligible: boolean;
    remainingBalance: number;
    maxAllowedRefund: number;
    reason?: string;
};
/**
 * Calcula o saldo líquido de uma transação ou cliente em precisão de centavos
 * para evitar distorções de ponto flutuante do IEEE 754.
 */
export declare function calculateNetCentsBalance(values: number[]): number;
/**
 * Adaptador de Referência Genérico para Webhooks HMAC-SHA-256 (Padrão Oficial AdMetrics)
 * Suporta integração com gateways que utilizam assinatura HMAC (ex: Stripe, Hotmart, Kiwify, Asaas)
 */
export declare class GenericHmacBillingAdapter implements BillingGatewayAdapter {
    readonly providerName = "generic_hmac";
    verifySignature(rawPayload: string, signatureHeader: string, secret: string): boolean;
    parseWebhook(rawPayload: string): BillingTransaction;
}
//# sourceMappingURL=billing-gateway.d.ts.map