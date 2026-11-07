import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GenericHmacBillingAdapter,
  hmacSha256Hex,
  timingSafeEqualStrings,
  calculateROAS,
  validateRefundEligibility,
  calculateNetCentsBalance
} from "./index.js";

describe("SPRINT 6.2: Integridade Contábil, Estornos, Disputas e Idempotência", () => {
  const adapter = new GenericHmacBillingAdapter();
  const webhookSecret = "test_super_secure_billing_secret_2026";

  const validPayloadObj = {
    paymentId: "pay_trans_10928374",
    clientId: "e2b7e1c8-2b8d-4e92-9b2f-981273981273",
    status: "CONFIRMED",
    amount: 199.90,
    currency: "BRL",
    timestamp: "2026-10-27T18:00:00.000Z",
    customer: {
      userId: "usr_99812",
      email: "financeiro@cliente.com.br"
    },
    metadata: {
      plan: "pro_anual",
      utm_source: "google_ads"
    }
  };

  const rawPayload = JSON.stringify(validPayloadObj);
  const validSignature = hmacSha256Hex(webhookSecret, rawPayload);

  it("1. Assinatura Válida: Deve aprovar assinatura criptográfica HMAC-SHA-256", () => {
    const isValid = adapter.verifySignature(rawPayload, validSignature, webhookSecret);
    assert.equal(isValid, true, "Assinatura válida deve ser aprovada.");
  });

  it("2. Assinatura Inválida: Deve rejeitar assinatura gerada com segredo divergente", () => {
    const forgedSignature = hmacSha256Hex("wrong_secret", rawPayload);
    const isValid = adapter.verifySignature(rawPayload, forgedSignature, webhookSecret);
    assert.equal(isValid, false, "Assinatura gerada com outro segredo deve ser rejeitada.");
  });

  it("3. Adulteração (Tampering): Deve rejeitar alteração no payload após assinatura", () => {
    const tamperedPayload = rawPayload.replace("199.9", "999.9");
    const isValid = adapter.verifySignature(tamperedPayload, validSignature, webhookSecret);
    assert.equal(isValid, false, "Assinatura deve falhar se o payload foi modificado após a assinatura.");
  });

  it("4. Timing-Safe Comparison: timingSafeEqualStrings deve ser resistente a ataques de tempo", () => {
    // Strings idênticas
    assert.equal(timingSafeEqualStrings("secret_hash_12345", "secret_hash_12345"), true);
    // Strings com mesmo tamanho mas caracteres diferentes
    assert.equal(timingSafeEqualStrings("secret_hash_12345", "secret_hash_12349"), false);
    // Strings com tamanhos diferentes
    assert.equal(timingSafeEqualStrings("short", "longer_secret_string"), false);
    // Casos nulos ou tipos inválidos
    assert.equal(timingSafeEqualStrings("" as any, "abc"), false);
  });

  it("5. Pagamento Confirmado: Classifica como CREDIT com netAmount positivo", () => {
    const tx = adapter.parseWebhook(rawPayload);
    assert.equal(tx.transactionId, "pay_trans_10928374");
    assert.equal(tx.status, "CONFIRMED");
    assert.equal(tx.amount, 199.90);
    assert.equal(tx.netAmount, 199.90);
    assert.equal(tx.accountingType, "CREDIT");
    assert.equal(tx.financialEventType, "PAYMENT_CONFIRMED");
    assert.equal(tx.isRefund, false);
    assert.equal(tx.currency, "BRL");
  });

  it("6. Reembolso Total (REFUND_FULL): Classifica como DEBIT com netAmount negativo integral", () => {
    const refundPayloadObj = {
      ...validPayloadObj,
      status: "REFUNDED"
    };
    const refundRaw = JSON.stringify(refundPayloadObj);
    const tx = adapter.parseWebhook(refundRaw);
    assert.equal(tx.status, "REFUNDED");
    assert.equal(tx.accountingType, "DEBIT");
    assert.equal(tx.financialEventType, "REFUND_FULL");
    assert.equal(tx.netAmount, -199.90, "Reembolso total deve debitar o valor integral.");
    assert.equal(tx.isRefund, true);
  });

  it("7. Reembolso Parcial (REFUND_PARTIAL): Debita exatamente o refundAmount especificado", () => {
    const partialRefundObj = {
      ...validPayloadObj,
      status: "REFUNDED",
      refundAmount: 50.00,
      reason: "Desconto concedido pós-venda"
    };
    const partialRaw = JSON.stringify(partialRefundObj);
    const tx = adapter.parseWebhook(partialRaw);
    assert.equal(tx.status, "REFUNDED");
    assert.equal(tx.accountingType, "DEBIT");
    assert.equal(tx.financialEventType, "REFUND_PARTIAL");
    assert.equal(tx.refundAmount, 50.00);
    assert.equal(tx.netAmount, -50.00, "Reembolso parcial deve debitar apenas o valor estornado.");
    assert.equal(tx.reason, "Desconto concedido pós-venda");
  });

  it("8. Contestação / Chargeback (DISPUTED): Classifica como DEBIT cautelar imediato", () => {
    const disputeObj = {
      ...validPayloadObj,
      status: "DISPUTED",
      reason: "Suspeita de fraude reportada pelo banco emissor"
    };
    const disputeRaw = JSON.stringify(disputeObj);
    const tx = adapter.parseWebhook(disputeRaw);
    assert.equal(tx.status, "DISPUTED");
    assert.equal(tx.accountingType, "DEBIT");
    assert.equal(tx.financialEventType, "CHARGEBACK_DISPUTED");
    assert.equal(tx.netAmount, -199.90, "Disputa deve debitar cautelarmente o valor da transação.");
    assert.equal(tx.isRefund, true);
  });

  it("9. Status Informativo (PENDING / FAILED): Não gera débito nem crédito (NEUTRAL)", () => {
    const pendingObj = {
      ...validPayloadObj,
      status: "PENDING"
    };
    const pendingRaw = JSON.stringify(pendingObj);
    const tx = adapter.parseWebhook(pendingRaw);
    assert.equal(tx.accountingType, "NEUTRAL");
    assert.equal(tx.netAmount, 0);
    assert.equal(tx.financialEventType, "UNCONFIRMED_STATUS");
  });

  it("10. Simulação de Ledger Contábil Append-Only com ROAS Líquido", () => {
    // Cenário:
    // 1. Compra confirmada de R$ 200,00
    // 2. Reembolso parcial de R$ 50,00
    // 3. Compra confirmada de R$ 300,00
    // 4. Reembolso integral da compra 3 de R$ 300,00
    // Investimento em anúncios: R$ 100,00
    const ledger = [
      { eventId: "evt_1", eventName: "subscription_activated", verifiedValue: 200.00 },
      { eventId: "evt_2", eventName: "billing_refund", verifiedValue: -50.00 },
      { eventId: "evt_3", eventName: "subscription_activated", verifiedValue: 300.00 },
      { eventId: "evt_4", eventName: "billing_refund", verifiedValue: -300.00 }
    ];

    let grossRevenue = 0;
    let netRevenue = 0;
    let totalRefunds = 0;

    for (const entry of ledger) {
      if (entry.eventName === "subscription_activated") {
        grossRevenue += entry.verifiedValue;
      } else if (entry.eventName === "billing_refund" || entry.eventName === "billing_chargeback") {
        totalRefunds += Math.abs(entry.verifiedValue);
      }
      netRevenue += entry.verifiedValue;
    }

    assert.equal(grossRevenue, 500.00, "Receita Bruta = R$ 500,00");
    assert.equal(totalRefunds, 350.00, "Total de Estornos = R$ 350,00");
    assert.equal(netRevenue, 150.00, "Receita Líquida = R$ 150,00");

    const adSpend = 100.00;
    const grossRoas = calculateROAS(grossRevenue, adSpend); // 500 / 100 = 5.0
    const netRoas = calculateROAS(netRevenue, adSpend);       // 150 / 100 = 1.5

    assert.equal(grossRoas, 5.0, "ROAS Bruto deve ser 5.0x");
    assert.equal(netRoas, 1.5, "ROAS Líquido auditado deve ser 1.5x");
  });

  it("11. Idempotência Contábil: Reenvio de mesmo evento não deve duplicar registros", () => {
    const seenEventKeys = new Set<string>();

    function processEvent(clientId: string, eventId: string, value: number) {
      const key = `${clientId}:${eventId}`;
      if (seenEventKeys.has(key)) {
        return { status: "DEDUPLICATED_IGNORED", persisted: false };
      }
      seenEventKeys.add(key);
      return { status: "ACCEPTED", persisted: true, value };
    }

    const firstCall = processEvent("client_a", "evt_pay_99", 199.90);
    assert.equal(firstCall.status, "ACCEPTED");

    // Reenvio acidental ou webhook duplicado da mesma notificação
    const duplicateCall = processEvent("client_a", "evt_pay_99", 199.90);
    assert.equal(duplicateCall.status, "DEDUPLICATED_IGNORED");
    assert.equal(duplicateCall.persisted, false);
  });

  it("12. Reversão de Disputa (DISPUTE_REVERSED): Restaura saldo líquido com crédito explícito", () => {
    const disputeReversedObj = {
      ...validPayloadObj,
      status: "DISPUTE_REVERSED",
      reason: "Lojista apresentou comprovante e venceu a contestação"
    };
    const disputeReversedRaw = JSON.stringify(disputeReversedObj);
    const tx = adapter.parseWebhook(disputeReversedRaw);
    assert.equal(tx.status, "DISPUTE_REVERSED");
    assert.equal(tx.accountingType, "CREDIT");
    assert.equal(tx.financialEventType, "DISPUTE_REVERSED");
    assert.equal(tx.netAmount, 199.90, "Reversão de disputa deve creditar novamente o valor da transação.");
    assert.equal(tx.isRefund, false);
  });

  it("13. Prevenção de Over-Refund: Bloqueia tentativa de estornar valor superior ao saldo elegível", () => {
    // Compra original: R$ 200,00
    // Já estornado: R$ 50,00
    // Saldo remanescente elegível: R$ 150,00

    // Caso A: Estorno elegível de R$ 100,00 (Aprovado)
    const check1 = validateRefundEligibility(200.00, 50.00, 100.00);
    assert.equal(check1.eligible, true);
    assert.equal(check1.remainingBalance, 50.00);

    // Caso B: Tentativa de estorno de R$ 160,00 (Rejeitado por over-refund)
    const check2 = validateRefundEligibility(200.00, 50.00, 160.00);
    assert.equal(check2.eligible, false);
    assert.match(check2.reason || "", /Tentativa de over-refund/);

    // Caso C: Tentativa de estorno de R$ 0,00 ou negativo (Rejeitado)
    const check3 = validateRefundEligibility(200.00, 50.00, 0.00);
    assert.equal(check3.eligible, false);
  });

  it("14. Precisão Monetária Exata em Centavos: Previne erros de ponto flutuante IEEE 754", () => {
    // No JS padrão: 0.1 + 0.2 !== 0.3 (resulta em 0.30000000000000004)
    // Com calculateNetCentsBalance:
    const values = [199.99, -50.10, -49.89];
    const net = calculateNetCentsBalance(values);
    assert.equal(net, 100.00, "Saldo contábil deve ser exatamente R$ 100.00 sem distorções de centavos.");
  });

  it("15. Defesa Multi-Tenant & Validação de Moeda no Webhook", () => {
    // Simulação das regras do endpoint
    function validateTenantAndCurrency(
      client: { organization_id: string; currency: string },
      payload: { metadata?: { organizationId?: string }; currency: string }
    ) {
      if (payload.metadata?.organizationId && payload.metadata.organizationId !== client.organization_id) {
        throw new Error("TENANT_MISMATCH");
      }
      if (client.currency.toUpperCase() !== payload.currency.toUpperCase()) {
        throw new Error("CURRENCY_MISMATCH");
      }
      return true;
    }

    const client = { organization_id: "org_alpha_123", currency: "BRL" };

    // Sucesso com mesmo tenant e mesma moeda
    assert.equal(
      validateTenantAndCurrency(client, { metadata: { organizationId: "org_alpha_123" }, currency: "BRL" }),
      true
    );

    // Rejeição por Tenant Mismatch (Tentativa de cross-org hijacking)
    assert.throws(
      () => validateTenantAndCurrency(client, { metadata: { organizationId: "org_beta_999" }, currency: "BRL" }),
      /TENANT_MISMATCH/
    );

    // Rejeição por Currency Mismatch (Divergência cambial BRL vs USD)
    assert.throws(
      () => validateTenantAndCurrency(client, { currency: "USD" }),
      /CURRENCY_MISMATCH/
    );
  });
});
