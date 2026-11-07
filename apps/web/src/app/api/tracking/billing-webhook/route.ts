import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BillingWebhookPayloadSchema,
  verifyWebhookSignature,
  pseudonimizeUserTraits
} from "@admetrics/domain";

export const dynamic = "force-dynamic";

/**
 * POST /api/tracking/billing-webhook
 * Endpoint seguro e dedicado para recepção de eventos de pagamento e assinaturas.
 * Valida criptograficamente o webhook (HMAC-SHA-256) com segredo armazenado exclusivamente no servidor.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Obter assinatura e timestamp do cabeçalho
    const signature = request.headers.get("x-admetrics-billing-signature") ||
                      request.headers.get("x-webhook-signature") ||
                      request.headers.get("x-hub-signature-256");

    if (!signature) {
      return NextResponse.json(
        { error: "Não autorizado: Cabeçalho de assinatura do webhook ausente.", code: "SIGNATURE_MISSING" },
        { status: 401 }
      );
    }

    // 2. Obter payload bruto (raw text) para verificação criptográfica sem distorções de formatação
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json(
        { error: "Corpo do webhook vazio.", code: "EMPTY_PAYLOAD" },
        { status: 400 }
      );
    }

    // 3. Validação Criptográfica da Assinatura HMAC-SHA-256
    // Segredo do servidor nunca exposto ao frontend
    const webhookSecret = process.env.BILLING_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === "production" && !webhookSecret) {
      console.error("[Billing Security Violation]: BILLING_WEBHOOK_SECRET ausente em produção.");
      return NextResponse.json(
        { error: "Erro de configuração de segurança: BILLING_WEBHOOK_SECRET obrigatório em ambiente de produção.", code: "SECURITY_CONFIG_ERROR" },
        { status: 500 }
      );
    }
    const effectiveWebhookSecret = webhookSecret || "billing_test_secret_for_homologation_only";
    const isSignatureValid = verifyWebhookSignature(rawBody, signature, effectiveWebhookSecret);

    if (!isSignatureValid) {
      console.warn("[Billing Webhook] Assinatura HMAC inválida rejeitada.");
      return NextResponse.json(
        { error: "Acesso negado: Assinatura criptográfica do webhook inválida.", code: "INVALID_SIGNATURE" },
        { status: 403 }
      );
    }

    // 4. Parser e validação estrita com Zod
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "JSON malformado no corpo do webhook.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parseResult = BillingWebhookPayloadSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Payload de faturamento inválido.",
          details: parseResult.error.errors.map(e => ({ field: e.path.join("."), message: e.message })),
          code: "VALIDATION_FAILED"
        },
        { status: 400 }
      );
    }

    const billingData = parseResult.data;

    // 5. Classificação Contábil Determinística do Evento
    const isPaidStatus = ["CONFIRMED", "PAID", "RECEIVED"].includes(billingData.status);
    const isRefundStatus = billingData.status === "REFUNDED";
    const isDisputeStatus = billingData.status === "DISPUTED";
    const isDisputeReversedStatus = billingData.status === "DISPUTE_REVERSED";

    if (!isPaidStatus && !isRefundStatus && !isDisputeStatus && !isDisputeReversedStatus) {
      // Evento de pagamento não confirmado (PENDING, FAILED, CANCELLED):
      // Aceita a notificação de forma idempotente, sem alterar a receita líquida
      return NextResponse.json({
        success: true,
        status: "IGNORED_UNCONFIRMED_STATUS",
        paymentId: billingData.paymentId,
        paymentStatus: billingData.status,
        verifiedRevenue: 0.00,
        message: `Evento de faturamento recebido com status informativo '${billingData.status}'. Nenhuma alteração financeira computada.`
      });
    }

    // Determinar semântica contábil: Crédito vs Débito (Estorno/Chargeback/Reversão)
    let eventName: "subscription_activated" | "billing_refund" | "billing_chargeback" | "billing_dispute_reversed" = "subscription_activated";
    let netAmount = 0.00;
    let eventId = `billing_pay_${billingData.paymentId}`;
    let financialEventType = "PAYMENT_CONFIRMED";

    if (isPaidStatus) {
      eventName = "subscription_activated";
      netAmount = billingData.amount;
      eventId = `billing_pay_${billingData.paymentId}`;
      financialEventType = "PAYMENT_CONFIRMED";
    } else if (isRefundStatus) {
      eventName = "billing_refund";
      const refundVal = (billingData.refundAmount && billingData.refundAmount > 0)
        ? billingData.refundAmount
        : billingData.amount;
      netAmount = -Math.abs(refundVal);
      // Chave única estável e idempotente: utiliza o ID do evento do gateway ou sufixo determinístico
      eventId = billingData.eventId
        ? `billing_ref_${billingData.eventId}`
        : `billing_ref_${billingData.paymentId}_${Math.abs(netAmount)}_${new Date(billingData.timestamp).getTime()}`;
      financialEventType = (billingData.refundAmount && billingData.refundAmount < billingData.amount)
        ? "REFUND_PARTIAL"
        : "REFUND_FULL";
    } else if (isDisputeStatus) {
      eventName = "billing_chargeback";
      netAmount = -Math.abs(billingData.amount);
      eventId = `billing_chg_${billingData.eventId || billingData.paymentId + "_dispute"}`;
      financialEventType = "CHARGEBACK_DISPUTED";
    } else if (isDisputeReversedStatus) {
      eventName = "billing_dispute_reversed";
      netAmount = Math.abs(billingData.amount);
      eventId = `billing_rev_${billingData.eventId || billingData.paymentId + "_reversed"}`;
      financialEventType = "DISPUTE_REVERSED";
    }

    // 6. Resolução e Validação de Tenant e Cliente no Banco
    const supabase = createAdminClient();
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, organization_id, currency")
      .eq("id", billingData.clientId)
      .maybeSingle();

    let orgId: string;
    let clientId: string;

    if (clientErr) {
      if (clientErr.code === "42P01" || clientErr.message?.includes("does not exist") || clientErr.message?.includes("Could not find the table")) {
        // Migration pendente: simulação local segura
        orgId = "mock-org-local-test";
        clientId = billingData.clientId;
      } else {
        return NextResponse.json(
          { error: `Erro no banco ao validar cliente: ${clientErr.message}`, code: "DB_ERROR" },
          { status: 500 }
        );
      }
    } else if (!client) {
      return NextResponse.json(
        { error: "Cliente não localizado para este identificador de faturamento.", code: "CLIENT_NOT_FOUND" },
        { status: 404 }
      );
    } else {
      // Defesa Anti-Hijacking Multi-Tenant: se o payload trouxe organizationId, valida rigorosamente
      if (billingData.metadata?.organizationId && billingData.metadata.organizationId !== client.organization_id) {
        return NextResponse.json(
          { error: "Violação de segurança multi-tenant: organização informada diverge do cliente cadastrado.", code: "TENANT_MISMATCH" },
          { status: 403 }
        );
      }

      // Validação Contábil de Moeda: previne contaminação cambial
      if (client.currency && client.currency.toUpperCase() !== billingData.currency.toUpperCase()) {
        return NextResponse.json(
          { error: `Inconsistência monetária: moeda do evento (${billingData.currency}) diverge da moeda canônica do cliente (${client.currency}).`, code: "CURRENCY_MISMATCH" },
          { status: 422 }
        );
      }

      orgId = client.organization_id;
      clientId = client.id;
    }

    // 7. Pseudonimização com HMAC Pepper do Servidor
    const serverPepper = process.env.PII_PEPPER_SECRET;
    if (process.env.NODE_ENV === "production" && !serverPepper) {
      console.error("[Billing Security Violation]: PII_PEPPER_SECRET ausente em produção.");
      return NextResponse.json(
        { error: "Erro de configuração de segurança: PII_PEPPER_SECRET obrigatório em ambiente de produção.", code: "SECURITY_CONFIG_ERROR" },
        { status: 500 }
      );
    }
    const effectivePepper = serverPepper || "admetrics_default_dev_pepper_2026";
    const userPseudoId = pseudonimizeUserTraits(billingData.customer, effectivePepper);

    // 8. Persistência Idempotente no Ledger Contábil (Append-Only)
    const billingEventRow = {
      organization_id: orgId,
      client_id: clientId,
      event_id: eventId,
      event_name: eventName,
      event_timestamp: billingData.timestamp,
      utm_source: billingData.metadata?.utm_source || "billing_webhook",
      utm_medium: billingData.metadata?.utm_medium || "direct_payment",
      utm_campaign: billingData.metadata?.utm_campaign || "subscription",
      attribution_channel: "direct",
      attribution_confidence: "EXACT_UTM",
      verified_value: netAmount,
      currency: billingData.currency,
      is_verified_origin: true, // Origem comprovada criptograficamente via webhook
      user_pseudo_id: userPseudoId
    };

    let persistenceResult = "created";
    const { error: insertErr } = await supabase
      .from("tracking_events")
      .insert(billingEventRow)
      .select("id, event_id")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505" || insertErr.message?.includes("duplicate key")) {
        persistenceResult = "deduplicated";
      } else if (insertErr.code === "42P01" || insertErr.message?.includes("does not exist") || insertErr.message?.includes("Could not find the table")) {
        persistenceResult = "simulated_local";
      } else {
        return NextResponse.json(
          { error: `Falha ao persistir evento financeiro: ${insertErr.message}`, code: insertErr.code },
          { status: 500 }
        );
      }
    }

    // Log sanitizado sem PII
    console.info(`[Billing Webhook] Transação processada: ${billingData.paymentId} | Tipo: ${financialEventType} | Valor Líquido: R$ ${netAmount} | Status: ${persistenceResult}`);

    return NextResponse.json({
      success: true,
      status: persistenceResult === "deduplicated" ? "DEDUPLICATED_IGNORED" : "VERIFIED_RECORDED",
      paymentId: billingData.paymentId,
      financialEventType,
      verifiedValue: netAmount,
      currency: billingData.currency,
      isVerifiedOrigin: true,
      persistence: persistenceResult,
      message:
        persistenceResult === "deduplicated"
          ? "Webhook financeiro duplicado recebido e ignorado com sucesso (idempotência contábil garantida)."
          : financialEventType === "PAYMENT_CONFIRMED"
          ? "Receita de pagamento validada criptograficamente e confirmada para cálculo de ROAS."
          : `Ajuste financeiro de ${financialEventType} registrado com sucesso no razão contábil.`
    });
  } catch (error: any) {
    console.error("[Billing Webhook Error]:", error?.message);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar webhook financeiro.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
