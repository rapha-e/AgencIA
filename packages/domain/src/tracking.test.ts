import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTrackingUrl,
  extractUtmParameters,
  resolveAttributionChannel,
  ConversionEventSchema,
  IngestionEventPayloadSchema,
  validateEventTimeWindow,
  hashApiKey,
  pseudonimizeUserTraits
} from "./tracking.js";

test("buildTrackingUrl deve construir URLs com UTMs normalizadas e codificação segura", () => {
  const url = buildTrackingUrl(
    "https://torxos.tech",
    {
      utm_source: "META",
      utm_medium: "REELS",
      utm_campaign: "OS_WHATSAPP_V1",
      utm_content: "vídeo bancada com acentuação & espaços",
      utm_term: "conserto celular"
    }
  );

  assert.equal(url.includes("utm_source=meta"), true);
  assert.equal(url.includes("utm_medium=reels"), true);
  assert.equal(url.includes("utm_campaign=os_whatsapp_v1"), true);
  const extracted = extractUtmParameters(url);
  assert.equal(extracted?.utm_content, "vídeo bancada com acentuação & espaços");
});

test("buildTrackingUrl deve preservar parâmetros pré-existentes na URL", () => {
  const url = buildTrackingUrl(
    "https://torxos.tech/planos?ref=parceiro_sp&desconto=10",
    {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "search_assistencia"
    }
  );

  assert.equal(url.includes("ref=parceiro_sp"), true);
  assert.equal(url.includes("desconto=10"), true);
  assert.equal(url.includes("utm_source=google"), true);
  assert.equal(url.includes("utm_medium=cpc"), true);
});

test("extractUtmParameters deve extrair e normalizar parâmetros de uma URL", () => {
  const url = "https://torxos.tech/?utm_source=Meta&utm_medium=FEED&utm_campaign=Estoque_V1&utm_content=card1";
  const utms = extractUtmParameters(url);

  assert.notEqual(utms, null);
  assert.equal(utms?.utm_source, "meta");
  assert.equal(utms?.utm_medium, "feed");
  assert.equal(utms?.utm_campaign, "estoque_v1");
  assert.equal(utms?.utm_content, "card1");
});

test("resolveAttributionChannel deve mapear canais determinísticos com base nas UTMs", () => {
  // Meta Ads
  const meta = resolveAttributionChannel({ utm_source: "meta", utm_medium: "reels" });
  assert.equal(meta.channel, "meta_ads");
  assert.equal(meta.confidence, "EXACT_UTM");

  // Google Ads (CPC / Busca Paga)
  const googlePaid = resolveAttributionChannel({ utm_source: "google", utm_medium: "cpc" });
  assert.equal(googlePaid.channel, "google_ads");
  assert.equal(googlePaid.confidence, "EXACT_UTM");

  // Google Orgânico
  const googleOrganic = resolveAttributionChannel({ utm_source: "google", utm_medium: "organic" });
  assert.equal(googleOrganic.channel, "organic_search");

  // WhatsApp Direto
  const wpp = resolveAttributionChannel({ utm_source: "whatsapp", utm_medium: "direct" });
  assert.equal(wpp.channel, "whatsapp_direct");

  // Sem UTMs (Direct / Tráfego Direto)
  const direct = resolveAttributionChannel(null);
  assert.equal(direct.channel, "direct");
  assert.equal(direct.confidence, "UNATTRIBUTED");
});

test("ConversionEventSchema deve validar eventos com chave única de deduplicação (event_id)", () => {
  const validEvent = {
    eventId: "evt_meta_conv_1793123000_user123",
    eventType: "free_trial_started",
    timestamp: new Date().toISOString(),
    clientDomain: "torxos.tech",
    url: "https://torxos.tech/?utm_source=meta&utm_medium=reels&utm_campaign=os_whatsapp",
    utmParams: {
      utm_source: "meta",
      utm_medium: "reels",
      utm_campaign: "os_whatsapp"
    },
    resolvedChannel: "meta_ads",
    attributionConfidence: "EXACT_UTM",
    value: 0,
    currency: "BRL"
  };

  const parsed = ConversionEventSchema.safeParse(validEvent);
  assert.equal(parsed.success, true);
});

test("IngestionEventPayloadSchema e validateEventTimeWindow devem validar payload e barrar timestamps inválidos", () => {
  // 1. Payload Válido de Ingestão
  const validPayload = {
    eventId: "evt_trial_102938",
    eventName: "free_trial_started",
    eventTimestamp: new Date().toISOString(),
    utms: {
      utm_source: "meta",
      utm_medium: "reels",
      utm_campaign: "os_whatsapp_v1"
    },
    userTraits: {
      email: "dono@assistenciatec.com.br",
      phone: "+5511999998888"
    }
  };

  const parseRes = IngestionEventPayloadSchema.safeParse(validPayload);
  assert.equal(parseRes.success, true);

  // 2. Janela Temporal: Rejeitar evento no futuro (> 5 min)
  const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const futureCheck = validateEventTimeWindow(futureDate);
  assert.equal(futureCheck.valid, false);
  assert.match(futureCheck.reason || "", /futuro/i);

  // 3. Janela Temporal: Rejeitar evento muito antigo (> 30 dias)
  const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const oldCheck = validateEventTimeWindow(oldDate);
  assert.equal(oldCheck.valid, false);
  assert.match(oldCheck.reason || "", /limite de retenção/i);

  // 4. Janela Temporal: Aceitar evento dentro da janela
  const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const recentCheck = validateEventTimeWindow(recentDate);
  assert.equal(recentCheck.valid, true);

  // 5. Hash determinístico de API Key
  const rawKey = "admk_live_secretkey123";
  const hash1 = hashApiKey(rawKey);
  const hash2 = hashApiKey(rawKey);
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64); // SHA-256 hex length

  // 6. Pseudonimização de dados pessoais (PII)
  const pseudo1 = pseudonimizeUserTraits({ email: "cliente@teste.com" });
  const pseudo2 = pseudonimizeUserTraits({ email: "CLIENTE@teste.com " });
  assert.equal(pseudo1, pseudo2); // Insensível a caixa/espaço
  assert.equal(pseudo1?.length, 64);
});

