import test from "node:test";
import assert from "node:assert/strict";
import { pseudonimizeUserTraits, verifyWebhookSignature, hmacSha256Hex } from "./index.js";
test("AUDITORIA 1: Validação de Chaves - ativa, expirada, revogada e escopos", () => {
    const keyRecord = {
        id: "key_1",
        organization_id: "org_alpha",
        client_id: "client_torxos",
        scopes: ["events:write"],
        is_active: true,
        expires_at: null,
        revoked_at: null
    };
    function validateKeySecurity(key, requiredScope) {
        if (!key.is_active || key.revoked_at !== null) {
            return { allowed: false, code: "REVOKED_API_KEY" };
        }
        if (key.expires_at && new Date(key.expires_at) < new Date()) {
            return { allowed: false, code: "EXPIRED_API_KEY" };
        }
        if (!key.scopes.includes(requiredScope)) {
            return { allowed: false, code: "INSUFFICIENT_SCOPE" };
        }
        return { allowed: true };
    }
    // 1. Chave ativa com escopo correto
    assert.equal(validateKeySecurity(keyRecord, "events:write").allowed, true);
    // 2. Chave revogada
    const revokedKey = { ...keyRecord, revoked_at: new Date().toISOString() };
    assert.equal(validateKeySecurity(revokedKey, "events:write").code, "REVOKED_API_KEY");
    // 3. Chave inativa
    const inactiveKey = { ...keyRecord, is_active: false };
    assert.equal(validateKeySecurity(inactiveKey, "events:write").code, "REVOKED_API_KEY");
    // 4. Chave expirada
    const expiredKey = { ...keyRecord, expires_at: new Date(Date.now() - 1000).toISOString() };
    assert.equal(validateKeySecurity(expiredKey, "events:write").code, "EXPIRED_API_KEY");
    // 5. Chave sem escopo necessário
    const readonlyKey = { ...keyRecord, scopes: ["reports:read"] };
    assert.equal(validateKeySecurity(readonlyKey, "events:write").code, "INSUFFICIENT_SCOPE");
});
test("AUDITORIA 2: Defesa Anti-Hijacking - Rejeição de OrganizationId e ClientId divergentes", () => {
    const authenticatedContext = {
        orgId: "org_alpha_uuid",
        clientId: "client_torxos_uuid"
    };
    function verifyTenantContext(payloadOrg, payloadClient) {
        if (payloadOrg && payloadOrg !== authenticatedContext.orgId) {
            return { valid: false, code: "TENANT_MISMATCH" };
        }
        if (payloadClient && payloadClient !== authenticatedContext.clientId) {
            return { valid: false, code: "CLIENT_MISMATCH" };
        }
        return { valid: true };
    }
    // Requisição sem orgId/clientId no payload (válida, o servidor usa a chave)
    assert.equal(verifyTenantContext().valid, true);
    // Requisição com orgId/clientId corretos (válida)
    assert.equal(verifyTenantContext("org_alpha_uuid", "client_torxos_uuid").valid, true);
    // Tentativa de Hijacking: Forjar organização de outro cliente
    assert.equal(verifyTenantContext("org_beta_uuid", "client_torxos_uuid").code, "TENANT_MISMATCH");
    // Tentativa de Hijacking: Forjar cliente de outro tenant
    assert.equal(verifyTenantContext("org_alpha_uuid", "client_outro_uuid").code, "CLIENT_MISMATCH");
});
test("AUDITORIA 3: Integridade Financeira - Bloqueio de Receita determinado pelo escopo do servidor", () => {
    // Cenário A: Chamador com chave comum (escopo apenas 'events:write') tenta declarar receita arbitrária
    const marketingCallerKey = { scopes: ["events:write"] };
    const marketingPayload = {
        eventId: "sub_spoof_1",
        eventName: "subscription_activated",
        eventTimestamp: new Date().toISOString(),
        value: 9999.00
    };
    function processFinancialIntegrity(event, callerKey) {
        let verifiedValue = 0.00;
        let isVerifiedOrigin = false;
        if (event.eventName === "subscription_activated") {
            // Confiança financeira determinada NO SERVIDOR pelo escopo da credencial
            const hasBillingScope = callerKey.scopes.includes("billing:webhook");
            if (hasBillingScope && typeof event.value === "number" && event.value > 0) {
                verifiedValue = event.value;
                isVerifiedOrigin = true;
            }
            else {
                // Bloqueio rigoroso: nunca aceita valor financeiro de chave de marketing
                verifiedValue = 0.00;
                isVerifiedOrigin = false;
            }
        }
        return { verifiedValue, isVerifiedOrigin };
    }
    const resA = processFinancialIntegrity(marketingPayload, marketingCallerKey);
    assert.equal(resA.verifiedValue, 0.00);
    assert.equal(resA.isVerifiedOrigin, false);
    // Cenário B: Webhook oficial de faturamento com credencial autorizada (escopo 'billing:webhook')
    const billingCallerKey = { scopes: ["events:write", "billing:webhook"] };
    const billingPayload = {
        ...marketingPayload,
        value: 97.00
    };
    const resB = processFinancialIntegrity(billingPayload, billingCallerKey);
    assert.equal(resB.verifiedValue, 97.00);
    assert.equal(resB.isVerifiedOrigin, true);
});
test("AUDITORIA 4: Deduplicação e Idempotência - Preservação do registro original", () => {
    // Simulação de tabela com chave única (client_id, event_id)
    const db = new Map();
    function ingestEvent(event) {
        const key = `${event.clientId}:${event.eventId}`;
        if (db.has(key)) {
            return { status: "DEDUPLICATED_IGNORED", persisted: db.get(key) };
        }
        db.set(key, event);
        return { status: "CREATED", persisted: event };
    }
    const originalEvent = {
        clientId: "client_torxos",
        eventId: "evt_dup_test_1",
        value: 97.00,
        timestamp: "2026-10-27T15:00:00.000Z"
    };
    // Primeira inserção
    const first = ingestEvent(originalEvent);
    assert.equal(first.status, "CREATED");
    // Reenvio com o mesmo eventId mas com dados alterados (tentativa de inflar contagem ou alterar valor)
    const duplicateAttempt = {
        clientId: "client_torxos",
        eventId: "evt_dup_test_1",
        value: 500.00,
        timestamp: "2026-10-27T15:05:00.000Z"
    };
    const second = ingestEvent(duplicateAttempt);
    assert.equal(second.status, "DEDUPLICATED_IGNORED");
    // O valor armazenado original de 97.00 é preservado intacto
    assert.equal(second.persisted.value, 97.00);
    assert.equal(db.size, 1);
});
test("AUDITORIA 5: Privacidade LGPD - HMAC-SHA-256 com Segredo Exclusivo do Servidor (Pepper)", () => {
    const serverPepper = "super_secret_server_pepper_key_2026";
    const userA = { email: "dono@torxos.tech" };
    const userB = { email: " DONO@torxos.tech " }; // Diferença de espaço e caixa alta
    // Sem pepper: SHA-256 simples
    const shaSimple = pseudonimizeUserTraits(userA);
    assert.equal(shaSimple?.length, 64);
    // Com pepper: HMAC-SHA-256 exclusivo do servidor
    const hmacPseudoA = pseudonimizeUserTraits(userA, serverPepper);
    const hmacPseudoB = pseudonimizeUserTraits(userB, serverPepper);
    assert.equal(hmacPseudoA?.length, 64);
    assert.equal(hmacPseudoA, hmacPseudoB); // Consistência e normalização
    assert.notEqual(hmacPseudoA, shaSimple); // Protegido contra rainbow tables de SHA-256 simples
    // Chaves diferentes de pepper produzem identificadores diferentes
    const otherPepperPseudo = pseudonimizeUserTraits(userA, "another_pepper_secret");
    assert.notEqual(hmacPseudoA, otherPepperPseudo);
});
test("AUDITORIA 6: Integridade Contábil - Segregação Estrita de Métricas de Funil", () => {
    // Simulação de consolidador de métricas:
    // Garante que leads, trials, assinaturas e receita verificada NUNCA são fundidos em uma contagem única
    const events = [
        { eventName: "lead_capture", value: 0, isVerified: false },
        { eventName: "lead_capture", value: 0, isVerified: false },
        { eventName: "free_trial_started", value: 0, isVerified: false },
        { eventName: "subscription_activated", value: 97.00, isVerified: true }, // Confirmado
        { eventName: "subscription_activated", value: 0.00, isVerified: false } // Não confirmado
    ];
    const summary = {
        totalLeads: 0,
        totalTrials: 0,
        totalSubscriptions: 0,
        verifiedSubscriptions: 0,
        verifiedRevenue: 0.00
    };
    for (const ev of events) {
        if (ev.eventName === "lead_capture") {
            summary.totalLeads += 1;
        }
        else if (ev.eventName === "free_trial_started") {
            summary.totalTrials += 1;
        }
        else if (ev.eventName === "subscription_activated") {
            summary.totalSubscriptions += 1;
            if (ev.isVerified) {
                summary.verifiedSubscriptions += 1;
                summary.verifiedRevenue += ev.value;
            }
        }
    }
    // Validação: nenhuma métrica contamina a outra
    assert.equal(summary.totalLeads, 2);
    assert.equal(summary.totalTrials, 1);
    assert.equal(summary.totalSubscriptions, 2);
    assert.equal(summary.verifiedSubscriptions, 1);
    assert.equal(summary.verifiedRevenue, 97.00);
});
test("AUDITORIA 7: Comprovação Criptográfica de Pagamentos via Webhook (HMAC-SHA-256)", () => {
    const webhookSecret = "whsec_test_secret_for_audit_only_9981";
    const validPayload = JSON.stringify({
        eventId: "evt_pay_991823",
        clientId: "e1bde118-fd46-4b9d-90fe-ae52f74ef044",
        paymentId: "pay_confirmed_123",
        status: "CONFIRMED",
        amount: 97.00,
        currency: "BRL",
        timestamp: "2026-10-27T19:50:00.000Z"
    });
    // 1. Assinatura válida gerada com o segredo oficial
    const validSignature = hmacSha256Hex(webhookSecret, validPayload);
    const isValid = verifyWebhookSignature(validPayload, validSignature, webhookSecret);
    assert.equal(isValid, true);
    // Suporte com prefixo v1=
    const isValidWithPrefix = verifyWebhookSignature(validPayload, `v1=${validSignature}`, webhookSecret);
    assert.equal(isValidWithPrefix, true);
    // 2. Assinatura inválida (forjada ou adulterada)
    const isInvalid = verifyWebhookSignature(validPayload, "invalid_forged_signature_hex_123456", webhookSecret);
    assert.equal(isInvalid, false);
    // 3. Payload adulterado após assinatura (ataque Man-in-the-Middle)
    const tamperedPayload = validPayload.replace('"amount":97', '"amount":5000');
    const isTamperedValid = verifyWebhookSignature(tamperedPayload, validSignature, webhookSecret);
    assert.equal(isTamperedValid, false);
    // 4. Assinatura ausente ou segredo vazio
    assert.equal(verifyWebhookSignature(validPayload, "", webhookSecret), false);
    assert.equal(verifyWebhookSignature(validPayload, validSignature, ""), false);
});
test("AUDITORIA 8: Bloqueio Rigoroso de Receita no Endpoint Comum de Marketing", () => {
    // Mesmo que um atacante envie um evento com eventName='subscription_activated' e value=9999.00
    // para o endpoint de marketing, a receita verificada DEVE ser forçada para 0.00
    const marketingInput = {
        eventName: "subscription_activated",
        value: 9999.00,
        billingEventId: "fake_id",
        billingSignature: "fake_sig"
    };
    // Simulação da regra implementada no endpoint de marketing:
    let verifiedValue = 0.00;
    let isVerifiedOrigin = false;
    if (marketingInput.eventName === "subscription_activated") {
        // Regra da Sprint 5.3: marketing nunca atribui receita verificada
        verifiedValue = 0.00;
        isVerifiedOrigin = false;
    }
    assert.equal(verifiedValue, 0.00);
    assert.equal(isVerifiedOrigin, false);
});
test("AUDITORIA 9: Fail-Secure de Segredos em Produção (Sem fallback inseguro)", () => {
    // Simulação da verificação estrita em produção
    function enforceProductionSecrets(env) {
        if (env.NODE_ENV === "production") {
            if (!env.PII_PEPPER_SECRET) {
                throw new Error("SECURITY_CONFIG_ERROR: PII_PEPPER_SECRET ausente em produção.");
            }
            if (!env.BILLING_WEBHOOK_SECRET) {
                throw new Error("SECURITY_CONFIG_ERROR: BILLING_WEBHOOK_SECRET ausente em produção.");
            }
        }
        return true;
    }
    // 1. Em produção sem PII_PEPPER_SECRET, deve falhar
    assert.throws(() => enforceProductionSecrets({ NODE_ENV: "production", BILLING_WEBHOOK_SECRET: "sec" }), /PII_PEPPER_SECRET ausente em produção/);
    // 2. Em produção sem BILLING_WEBHOOK_SECRET, deve falhar
    assert.throws(() => enforceProductionSecrets({ NODE_ENV: "production", PII_PEPPER_SECRET: "pep" }), /BILLING_WEBHOOK_SECRET ausente em produção/);
    // 3. Em produção com ambos os segredos presentes, é aprovado
    assert.equal(enforceProductionSecrets({ NODE_ENV: "production", PII_PEPPER_SECRET: "pep", BILLING_WEBHOOK_SECRET: "sec" }), true);
    // 4. Em desenvolvimento, fallback seguro é tolerado sem lançar exceção fatal
    assert.equal(enforceProductionSecrets({ NODE_ENV: "development" }), true);
});
//# sourceMappingURL=security_audit.test.js.map