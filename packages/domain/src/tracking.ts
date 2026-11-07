import { z } from "zod";

/**
 * Contrato Oficial de Parâmetros UTM e Rastreamento de Aquisição
 * Padronização estrita conforme diretrizes de atribuição determinística.
 */
export const UtmParametersSchema = z.object({
  utm_source: z.string().min(1).toLowerCase().trim(),
  utm_medium: z.string().min(1).toLowerCase().trim(),
  utm_campaign: z.string().min(1).toLowerCase().trim(),
  utm_content: z.string().optional(),
  utm_term: z.string().optional()
});
export type UtmParameters = z.infer<typeof UtmParametersSchema>;

export interface TrackingUrlOptions {
  preserveExistingParams?: boolean;
  extraParams?: Record<string, string>;
}

/**
 * Constrói uma URL rastreável determinística preservando parâmetros pré-existentes
 * e aplicando encoding seguro em todos os componentes.
 */
export function buildTrackingUrl(
  baseUrl: string,
  utms: UtmParameters,
  options: TrackingUrlOptions = { preserveExistingParams: true }
): string {
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error("baseUrl inválida ou ausente.");
  }

  // Garantir protocolo para parsing correto
  const hasProtocol = baseUrl.startsWith("http://") || baseUrl.startsWith("https://");
  const urlToParse = hasProtocol ? baseUrl : `https://${baseUrl}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlToParse);
  } catch (err) {
    throw new Error(`Falha ao processar URL base: ${(err as Error).message}`);
  }

  // Se preserveExistingParams for falso, limpa os parâmetros existentes
  if (!options.preserveExistingParams) {
    parsedUrl.search = "";
  }

  // Aplicar parâmetros UTM normalizados em minúsculas
  parsedUrl.searchParams.set("utm_source", utms.utm_source.toLowerCase().trim());
  parsedUrl.searchParams.set("utm_medium", utms.utm_medium.toLowerCase().trim());
  parsedUrl.searchParams.set("utm_campaign", utms.utm_campaign.toLowerCase().trim());

  if (utms.utm_content) {
    parsedUrl.searchParams.set("utm_content", utms.utm_content.trim());
  } else {
    parsedUrl.searchParams.delete("utm_content");
  }

  if (utms.utm_term) {
    parsedUrl.searchParams.set("utm_term", utms.utm_term.trim());
  } else {
    parsedUrl.searchParams.delete("utm_term");
  }

  // Aplicar parâmetros extras (ex: ref, ad_id)
  if (options.extraParams) {
    for (const [key, val] of Object.entries(options.extraParams)) {
      if (val !== undefined && val !== null) {
        parsedUrl.searchParams.set(key, String(val));
      }
    }
  }

  // Se a baseUrl original não tinha protocolo, removemos https:// apenas para manter consistência
  return hasProtocol ? parsedUrl.toString() : parsedUrl.toString().replace(/^https:\/\//, "");
}

/**
 * Extrai e valida parâmetros UTM a partir de uma URL ou string de query
 */
export function extractUtmParameters(urlOrQuery: string): Partial<UtmParameters> | null {
  if (!urlOrQuery) return null;

  try {
    const hasProtocol = urlOrQuery.startsWith("http://") || urlOrQuery.startsWith("https://");
    const fullUrl = hasProtocol ? urlOrQuery : `https://dummy.local${urlOrQuery.startsWith("?") ? "" : "/"}${urlOrQuery}`;
    const parsed = new URL(fullUrl);

    const utm_source = parsed.searchParams.get("utm_source")?.toLowerCase().trim() || undefined;
    const utm_medium = parsed.searchParams.get("utm_medium")?.toLowerCase().trim() || undefined;
    const utm_campaign = parsed.searchParams.get("utm_campaign")?.toLowerCase().trim() || undefined;
    const utm_content = parsed.searchParams.get("utm_content")?.trim() || undefined;
    const utm_term = parsed.searchParams.get("utm_term")?.trim() || undefined;

    if (!utm_source && !utm_medium && !utm_campaign) {
      return null;
    }

    return {
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term
    };
  } catch {
    return null;
  }
}

// --- Contrato de Eventos de Conversão e Atribuição ---

export const AttributionChannelSchema = z.enum([
  "meta_ads",
  "google_ads",
  "whatsapp_direct",
  "organic_search",
  "direct",
  "unknown"
]);
export type AttributionChannel = z.infer<typeof AttributionChannelSchema>;

export const ConversionEventTypeSchema = z.enum([
  "lead_capture",
  "free_trial_started",
  "subscription_activated",
  "billing_refund",
  "billing_chargeback",
  "billing_dispute_reversed"
]);
export type ConversionEventType = z.infer<typeof ConversionEventTypeSchema>;

/**
 * Contrato de Ingestão de Evento de Aquisição (Payload recebido no endpoint)
 */
export const IngestionEventPayloadSchema = z.object({
  eventId: z.string().min(1).max(128),
  eventName: ConversionEventTypeSchema,
  eventTimestamp: z.string().datetime(),
  
  // Parâmetros opcionais fornecidos na chamada (validados contra a credencial)
  organizationId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  
  // Parâmetros UTM e contexto de página
  utms: UtmParametersSchema.partial().optional().default({}),
  pageUrl: z.string().url().max(2048).optional(),
  referrerUrl: z.string().url().max(2048).optional(),
  campaignId: z.string().max(128).optional(),
  
  // Dados do usuário minimizados (apenas identificadores para pseudonimização)
  userTraits: z.object({
    userId: z.string().max(128).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(32).optional()
  }).optional().default({}),

  // Integridade Financeira (Somente para subscription_activated)
  value: z.number().nonnegative().max(1000000).optional(),
  currency: z.string().length(3).default("BRL"),
  billingEventId: z.string().max(128).optional(),
  billingSignature: z.string().max(256).optional()
});
export type IngestionEventPayload = z.infer<typeof IngestionEventPayloadSchema>;

export const ConversionEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: ConversionEventTypeSchema,
  timestamp: z.string().datetime(),
  clientDomain: z.string().optional(),
  url: z.string().url().optional(),
  utmParams: UtmParametersSchema.partial().default({}),
  resolvedChannel: AttributionChannelSchema,
  attributionConfidence: z.enum(["EXACT_UTM", "HEURISTIC", "ORGANIC_FALLBACK", "UNATTRIBUTED"]),
  value: z.number().nonnegative().optional(),
  currency: z.string().default("BRL")
});
export type ConversionEvent = z.infer<typeof ConversionEventSchema>;

/**
 * Resolve o canal de atribuição determinístico a partir dos parâmetros UTM observados
 */
export function resolveAttributionChannel(utms?: Partial<UtmParameters> | null): {
  channel: AttributionChannel;
  confidence: "EXACT_UTM" | "ORGANIC_FALLBACK" | "UNATTRIBUTED";
} {
  if (!utms || !utms.utm_source) {
    return { channel: "direct", confidence: "UNATTRIBUTED" };
  }

  const src = utms.utm_source.toLowerCase();
  const med = utms.utm_medium?.toLowerCase() || "";

  if (src.includes("meta") || src.includes("facebook") || src.includes("instagram")) {
    return { channel: "meta_ads", confidence: "EXACT_UTM" };
  }

  if (src.includes("google")) {
    if (med.includes("cpc") || med.includes("paid") || med.includes("search")) {
      return { channel: "google_ads", confidence: "EXACT_UTM" };
    }
    return { channel: "organic_search", confidence: "EXACT_UTM" };
  }

  if (src.includes("whatsapp") || med.includes("whatsapp")) {
    return { channel: "whatsapp_direct", confidence: "EXACT_UTM" };
  }

  return { channel: "unknown", confidence: "UNATTRIBUTED" };
}

/**
 * Validação da janela temporal de aceitação do evento.
 * Rejeita eventos no futuro (> 5 min) e eventos muito antigos (> 30 dias).
 */
export function validateEventTimeWindow(
  eventTimestamp: string,
  now: Date = new Date(),
  maxAgeDays: number = 30,
  maxFutureMinutes: number = 5
): { valid: boolean; reason?: string } {
  const ts = new Date(eventTimestamp).getTime();
  if (isNaN(ts)) {
    return { valid: false, reason: "Timestamp inválido ou malformado." };
  }

  const nowMs = now.getTime();
  const futureAllowanceMs = maxFutureMinutes * 60 * 1000;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  if (ts > nowMs + futureAllowanceMs) {
    return { valid: false, reason: "Evento rejeitado: timestamp está no futuro." };
  }

  if (ts < nowMs - maxAgeMs) {
    return { valid: false, reason: `Evento rejeitado: timestamp excede o limite de retenção de ${maxAgeDays} dias.` };
  }

  return { valid: true };
}

/**
 * Implementação universal e determinística de SHA-256 em TypeScript puro.
 * Compatível 100% com Node.js, Webpack, Next.js client/server bundles e navegadores.
 */
function sha256Bytes(inputBytes: number[]): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0, j = 0;
  let result = "";

  const words: number[] = [];
  const bitLength = inputBytes.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  const paddedBytes = inputBytes.slice();
  paddedBytes.push(0x80);
  while ((paddedBytes.length % 64) !== 56) {
    paddedBytes.push(0x00);
  }

  for (i = 0; i < paddedBytes.length; i++) {
    const byteVal = paddedBytes[i] ?? 0;
    words[i >> 2] |= (byteVal & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (bitLength / maxWord) | 0;
  words[words.length] = bitLength & 0xffffffff;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15] ?? 0,
        w2 = w[i - 2] ?? 0;

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? (w[i] ?? 0)
          : (((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) | 0);

      const s1Final = rightRotate(hash[4] ?? 0, 6) ^ rightRotate(hash[4] ?? 0, 11) ^ rightRotate(hash[4] ?? 0, 25);
      const ch = ((hash[4] ?? 0) & (hash[5] ?? 0)) ^ (~(hash[4] ?? 0) & (hash[6] ?? 0));
      const temp1 = ((hash[7] ?? 0) + s1Final + ch + (k[i] ?? 0) + (w[i] ?? 0)) | 0;
      const s0Final = rightRotate(hash[0] ?? 0, 2) ^ rightRotate(hash[0] ?? 0, 13) ^ rightRotate(hash[0] ?? 0, 22);
      const maj = ((hash[0] ?? 0) & (hash[1] ?? 0)) ^ ((hash[0] ?? 0) & (hash[2] ?? 0)) ^ ((hash[1] ?? 0) & (hash[2] ?? 0));
      const temp2 = (s0Final + maj) | 0;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = ((hash[4] ?? 0) + temp1) | 0;
      hash.pop();
    }

    for (i = 0; i < 8; i++) {
      hash[i] = ((hash[i] ?? 0) + (oldHash[i] ?? 0)) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = ((hash[i] ?? 0) >> (b * 8)) & 255;
      result += (byte < 16 ? "0" : "") + byte.toString(16);
    }
  }
  return result;
}

function stringToUtf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      bytes.push(charCode);
    } else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
    } else {
      i++;
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }
  return bytes;
}

function sha256Hex(ascii: string): string {
  return sha256Bytes(stringToUtf8Bytes(ascii));
}

/**
 * Implementação de HMAC-SHA-256 em TypeScript puro conforme RFC 2104.
 */
export function hmacSha256Hex(key: string, message: string): string {
  const blockSize = 64; // SHA-256 block size em bytes

  let keyBytes = stringToUtf8Bytes(key);
  const msgBytes = stringToUtf8Bytes(message);

  if (keyBytes.length > blockSize) {
    const keyHashHex = sha256Bytes(keyBytes);
    keyBytes = [];
    for (let i = 0; i < keyHashHex.length; i += 2) {
      keyBytes.push(parseInt(keyHashHex.substr(i, 2), 16));
    }
  }

  while (keyBytes.length < blockSize) {
    keyBytes.push(0);
  }

  const oKeyPad: number[] = [];
  const iKeyPad: number[] = [];
  for (let i = 0; i < blockSize; i++) {
    const k = keyBytes[i] ?? 0;
    oKeyPad.push(k ^ 0x5c);
    iKeyPad.push(k ^ 0x36);
  }

  const innerHashHex = sha256Bytes(iKeyPad.concat(msgBytes));
  const innerHashBytes: number[] = [];
  for (let i = 0; i < innerHashHex.length; i += 2) {
    innerHashBytes.push(parseInt(innerHashHex.substr(i, 2), 16));
  }

  return sha256Bytes(oKeyPad.concat(innerHashBytes));
}

/**
 * Pseudonimização determinística de identificadores de usuário (LGPD/GDPR).
 * Se fornecido um segredo exclusivo do servidor (pepper), utiliza HMAC-SHA-256
 * para proteção contra ataques de dicionário e rainbow tables.
 */
export function pseudonimizeUserTraits(
  traits?: { userId?: string; email?: string; phone?: string },
  serverPepper?: string
): string | null {
  if (!traits) return null;
  const rawId = traits.userId || traits.email?.toLowerCase().trim() || traits.phone?.trim();
  if (!rawId) return null;

  if (serverPepper && typeof serverPepper === "string" && serverPepper.length > 0) {
    return hmacSha256Hex(serverPepper, rawId);
  }

  return sha256Hex(rawId);
}

/**
/**
 * Comparação em tempo constante (Timing-Attack Resistant) para hashes e assinaturas.
 * Utiliza crypto.timingSafeEqual quando disponível em runtime Node.js, com fallback
 * bitwise constante universal para qualquer ambiente sem vazar tamanho de buffer.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  // Se estivermos em ambiente Node.js com Buffer e crypto nativo
  if (typeof Buffer !== "undefined") {
    try {
      const bufA = Buffer.from(a, "utf-8");
      const bufB = Buffer.from(b, "utf-8");
      if (bufA.length === bufB.length) {
        const cryptoMod = (globalThis as any).crypto || (typeof require !== "undefined" ? require("crypto") : null);
        if (cryptoMod && typeof cryptoMod.timingSafeEqual === "function") {
          return cryptoMod.timingSafeEqual(bufA, bufB);
        }
      }
    } catch {
      // prosseguir para comparação bitwise
    }
  }

  // Comparação bitwise em tempo constante (executa sempre sobre o maior comprimento)
  const lenA = a.length;
  const lenB = b.length;
  let mismatch = lenA === lenB ? 0 : 1;
  const maxLen = Math.max(lenA, lenB);

  for (let i = 0; i < maxLen; i++) {
    const charA = i < lenA ? a.charCodeAt(i) : 0;
    const charB = i < lenB ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }

  return mismatch === 0;
}

/**
 * Validação criptográfica de assinatura de Webhook de Pagamento (HMAC-SHA-256).
 * Verifica se a assinatura recebida coincide exatamente com o HMAC gerado
 * a partir do payload bruto ou concatenado usando o segredo exclusivo do servidor.
 */
export function verifyWebhookSignature(
  rawPayload: string,
  providedSignature: string,
  webhookSecret: string
): boolean {
  if (!rawPayload || !providedSignature || !webhookSecret) {
    return false;
  }

  // Tratamento de formato de assinatura (ex: 'v1=hash...' ou hash direto)
  let cleanSignature = providedSignature.trim();
  if (cleanSignature.startsWith("v1=")) {
    cleanSignature = cleanSignature.substring(3).trim();
  }

  const expectedSignature = hmacSha256Hex(webhookSecret.trim(), rawPayload);

  // Comparação segura imune a timing-attacks
  return timingSafeEqualStrings(cleanSignature, expectedSignature);
}

/**
 * Contrato Oficial do Webhook de Faturamento Confiável (Billing Webhook)
 * Suporta pagamentos confirmados, estornos totais, reembolsos parciais e disputas.
 */
export const BillingWebhookPayloadSchema = z.object({
  eventId: z.string().min(1).max(128),
  clientId: z.string().uuid(),
  paymentId: z.string().min(1).max(128),
  status: z.enum([
    "CONFIRMED",
    "PAID",
    "RECEIVED",
    "PENDING",
    "REFUNDED",
    "FAILED",
    "CANCELLED",
    "DISPUTED",
    "DISPUTE_REVERSED"
  ]),
  amount: z.number().positive().max(1000000),
  refundAmount: z.number().positive().max(1000000).optional(),
  originalPaymentId: z.string().max(128).optional(),
  reason: z.string().max(256).optional(),
  currency: z.string().length(3).default("BRL"),
  customer: z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional()
  }).optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.string()).optional()
});
export type BillingWebhookPayload = z.infer<typeof BillingWebhookPayloadSchema>;

/**
 * Gera hash SHA-256 para armazenamento e comparação de ApiKeys.
 */
export function hashApiKey(key: string): string {
  if (!key || typeof key !== "string") {
    throw new Error("Chave de API inválida para hashing.");
  }
  return sha256Hex(key.trim());
}



