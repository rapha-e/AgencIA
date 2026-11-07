import test from "node:test";
import assert from "node:assert/strict";
import { IngestionEventPayloadSchema, validateEventTimeWindow, pseudonimizeUserTraits, hashApiKey, resolveAttributionChannel } from "./index.js";
test("INGESTÃO & AUTENTICAÇÃO: Deve gerar e comparar hashes de API Key com precisão", () => {
    const secret = "admk_live_secret_torxos_2026";
    const hash = hashApiKey(secret);
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 64);
    assert.equal(hash, hashApiKey(secret));
    assert.notEqual(hash, hashApiKey("admk_live_secret_outro_cliente"));
});
test("INGESTÃO & PRIVACIDADE: Pseudonimização LGPD/GDPR sem vazamento de PII", () => {
    const email1 = "contato@assistencia.com.br";
    const pseudo1 = pseudonimizeUserTraits({ email: email1 });
    const pseudo2 = pseudonimizeUserTraits({ email: " CONTATO@assistencia.com.br " });
    assert.notEqual(pseudo1, null);
    assert.equal(pseudo1, pseudo2);
    assert.equal(pseudo1?.includes("@"), false);
    assert.equal(pseudo1?.includes("assistencia"), false);
});
test("INGESTÃO & TEMPO: Rejeição estrita de timestamps futuros e velhos", () => {
    const now = new Date("2026-10-27T15:30:00.000Z");
    // Válido (5 min atrás)
    const validTime = new Date("2026-10-27T15:25:00.000Z").toISOString();
    const resValid = validateEventTimeWindow(validTime, now);
    assert.equal(resValid.valid, true);
    // Inválido: Futuro (> 5 min)
    const futureTime = new Date("2026-10-27T15:40:00.000Z").toISOString();
    const resFuture = validateEventTimeWindow(futureTime, now);
    assert.equal(resFuture.valid, false);
    assert.match(resFuture.reason || "", /futuro/i);
    // Inválido: Muito antigo (> 30 dias)
    const oldTime = new Date("2026-09-01T10:00:00.000Z").toISOString();
    const resOld = validateEventTimeWindow(oldTime, now);
    assert.equal(resOld.valid, false);
    assert.match(resOld.reason || "", /retenção/i);
});
test("INGESTÃO & PAYLOAD: Validação dos tipos de eventos do projeto", () => {
    const events = ["lead_capture", "free_trial_started", "subscription_activated"];
    for (const eventName of events) {
        const payload = {
            eventId: `evt_${eventName}_123`,
            eventName,
            eventTimestamp: "2026-10-27T15:20:00.000Z",
            utms: {
                utm_source: "meta",
                utm_medium: "reels",
                utm_campaign: "os_whatsapp_v1"
            }
        };
        const res = IngestionEventPayloadSchema.safeParse(payload);
        assert.equal(res.success, true);
    }
    // Evento desconhecido deve falhar
    const invalidPayload = {
        eventId: "evt_invalid",
        eventName: "compra_nao_cadastrada",
        eventTimestamp: "2026-10-27T15:20:00.000Z"
    };
    const resInvalid = IngestionEventPayloadSchema.safeParse(invalidPayload);
    assert.equal(resInvalid.success, false);
});
test("INTEGRIDADE FINANCEIRA: Separação de receita e validação de origem confiável", () => {
    // 1. Assinatura declarada pelo cliente sem metadados de webhook
    const unverifiedSubscription = {
        eventId: "sub_unverified_1",
        eventName: "subscription_activated",
        eventTimestamp: "2026-10-27T15:20:00.000Z",
        value: 97.00
    };
    const parse1 = IngestionEventPayloadSchema.safeParse(unverifiedSubscription);
    assert.equal(parse1.success, true);
    assert.equal(parse1.data?.billingEventId, undefined);
    // 2. Assinatura com metadados de billing/webhook confiável
    const verifiedSubscription = {
        eventId: "sub_verified_1",
        eventName: "subscription_activated",
        eventTimestamp: "2026-10-27T15:20:00.000Z",
        value: 97.00,
        currency: "BRL",
        billingEventId: "evt_asaas_pay_19283",
        billingSignature: "sig_hmac_valid_99812"
    };
    const parse2 = IngestionEventPayloadSchema.safeParse(verifiedSubscription);
    assert.equal(parse2.success, true);
    assert.equal(parse2.data?.billingEventId, "evt_asaas_pay_19283");
    assert.equal(parse2.data?.value, 97.00);
});
test("ATRIBUIÇÃO & MULTI-CANAL: Separação determinística de origens", () => {
    // Tráfego Meta
    const meta = resolveAttributionChannel({ utm_source: "meta", utm_medium: "reels" });
    assert.equal(meta.channel, "meta_ads");
    assert.equal(meta.confidence, "EXACT_UTM");
    // Tráfego Google Pago
    const google = resolveAttributionChannel({ utm_source: "google", utm_medium: "cpc" });
    assert.equal(google.channel, "google_ads");
    // Tráfego Orgânico
    const organic = resolveAttributionChannel({ utm_source: "google", utm_medium: "organic" });
    assert.equal(organic.channel, "organic_search");
    // Desconhecido / Sem UTM
    const direct = resolveAttributionChannel({});
    assert.equal(direct.channel, "direct");
    assert.equal(direct.confidence, "UNATTRIBUTED");
});
//# sourceMappingURL=ingestion.test.js.map