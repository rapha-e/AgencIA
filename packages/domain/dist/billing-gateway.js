import { z } from "zod";
import { verifyWebhookSignature } from "./tracking.js";
/**
 * Status de pagamento normalizado entre diferentes gateways
 */
export const NormalizedPaymentStatusSchema = z.enum([
    "CONFIRMED",
    "PAID",
    "RECEIVED",
    "PENDING",
    "REFUNDED",
    "FAILED",
    "CANCELLED",
    "DISPUTED",
    "DISPUTE_REVERSED"
]);
/**
 * Validação de Elegibilidade de Estorno (Prevenção de Over-Refund).
 * Garante em precisão de centavos inteiros que a soma dos estornos nunca exceda o saldo original.
 */
export function validateRefundEligibility(originalAmount, alreadyRefunded, requestedRefund) {
    const originalCents = Math.round(Math.abs(originalAmount) * 100);
    const refundedCents = Math.round(Math.abs(alreadyRefunded) * 100);
    const requestedCents = Math.round(Math.abs(requestedRefund) * 100);
    const remainingCents = Math.max(0, originalCents - refundedCents);
    const remainingBalance = remainingCents / 100;
    if (requestedCents <= 0) {
        return {
            eligible: false,
            remainingBalance,
            maxAllowedRefund: remainingBalance,
            reason: "O valor de reembolso solicitado deve ser estritamente maior que zero."
        };
    }
    if (requestedCents > remainingCents) {
        return {
            eligible: false,
            remainingBalance,
            maxAllowedRefund: remainingBalance,
            reason: `Tentativa de over-refund: O estorno solicitado (R$ ${(requestedCents / 100).toFixed(2)}) excede o saldo elegível remanescente da transação (R$ ${remainingBalance.toFixed(2)}).`
        };
    }
    return {
        eligible: true,
        remainingBalance: (remainingCents - requestedCents) / 100,
        maxAllowedRefund: remainingBalance
    };
}
/**
 * Calcula o saldo líquido de uma transação ou cliente em precisão de centavos
 * para evitar distorções de ponto flutuante do IEEE 754.
 */
export function calculateNetCentsBalance(values) {
    const totalCents = values.reduce((acc, val) => acc + Math.round(val * 100), 0);
    return totalCents / 100;
}
/**
 * Adaptador de Referência Genérico para Webhooks HMAC-SHA-256 (Padrão Oficial AdMetrics)
 * Suporta integração com gateways que utilizam assinatura HMAC (ex: Stripe, Hotmart, Kiwify, Asaas)
 */
export class GenericHmacBillingAdapter {
    providerName = "generic_hmac";
    verifySignature(rawPayload, signatureHeader, secret) {
        return verifyWebhookSignature(rawPayload, signatureHeader, secret);
    }
    parseWebhook(rawPayload) {
        const data = JSON.parse(rawPayload);
        const status = NormalizedPaymentStatusSchema.parse(data.status);
        const amount = Number(data.amount);
        const refundAmount = data.refundAmount ? Number(data.refundAmount) : undefined;
        let accountingType = "NEUTRAL";
        let financialEventType = "UNCONFIRMED_STATUS";
        let netAmount = 0;
        let isRefund = false;
        if (status === "CONFIRMED" || status === "PAID" || status === "RECEIVED") {
            accountingType = "CREDIT";
            financialEventType = "PAYMENT_CONFIRMED";
            netAmount = Math.abs(amount);
            isRefund = false;
        }
        else if (status === "REFUNDED") {
            accountingType = "DEBIT";
            isRefund = true;
            if (refundAmount && refundAmount > 0 && refundAmount < amount) {
                financialEventType = "REFUND_PARTIAL";
                netAmount = -Math.abs(refundAmount);
            }
            else {
                financialEventType = "REFUND_FULL";
                netAmount = -Math.abs(amount);
            }
        }
        else if (status === "DISPUTED") {
            accountingType = "DEBIT";
            financialEventType = "CHARGEBACK_DISPUTED";
            isRefund = true;
            netAmount = -Math.abs(refundAmount || amount);
        }
        else if (status === "DISPUTE_REVERSED") {
            accountingType = "CREDIT";
            financialEventType = "DISPUTE_REVERSED";
            isRefund = false;
            netAmount = Math.abs(amount);
        }
        else {
            // PENDING, FAILED, CANCELLED
            accountingType = "NEUTRAL";
            financialEventType = "UNCONFIRMED_STATUS";
            netAmount = 0;
            isRefund = false;
        }
        return {
            transactionId: String(data.paymentId || data.eventId || data.id),
            gatewayEventId: data.eventId ? String(data.eventId) : undefined,
            provider: this.providerName,
            status,
            amount,
            refundAmount,
            netAmount,
            accountingType,
            financialEventType,
            currency: String(data.currency || "BRL").toUpperCase(),
            clientId: String(data.clientId),
            timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
            isRefund,
            reason: data.reason ? String(data.reason) : undefined,
            customer: data.customer,
            metadata: data.metadata
        };
    }
}
//# sourceMappingURL=billing-gateway.js.map