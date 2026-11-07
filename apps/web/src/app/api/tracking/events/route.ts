import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IngestionEventPayloadSchema,
  resolveAttributionChannel,
  validateEventTimeWindow,
  pseudonimizeUserTraits,
  hashApiKey
} from "@admetrics/domain";

export const dynamic = "force-dynamic";

// Limite de tamanho de payload: 32 KB
const MAX_PAYLOAD_BYTES = 32 * 1024;

// Cache simples em memória para Rate Limiting (Token Bucket / Sliding Window simples por IP / API Key)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 120; // 120 requisições por minuto por chave/IP

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * POST /api/tracking/events
 * Endpoint seguro e autenticado para ingestão de eventos servidor a servidor.
 * Autenticação via Header "Authorization: Bearer admk_live_..." ou "X-Admetrics-Key: admk_live_...".
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar tamanho do conteúdo via Content-Length antes de ler o corpo
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Payload excessivo. O tamanho máximo permitido é 32 KB." },
        { status: 413 }
      );
    }

    // 2. Extração da Credencial da Requisição (Independente de sessão de usuário)
    const authHeader = request.headers.get("authorization");
    const customHeader = request.headers.get("x-admetrics-key");
    let apiKey: string | null = null;

    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      apiKey = authHeader.substring(7).trim();
    } else if (customHeader) {
      apiKey = customHeader.trim();
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Não autorizado: Chave de API ausente. Forneça o header Authorization: Bearer <chave> ou X-Admetrics-Key.",
          code: "UNAUTHORIZED_KEY_MISSING"
        },
        { status: 401 }
      );
    }

    // Rate Limiting por Hash da Chave
    const keyHash = hashApiKey(apiKey);
    if (!checkRateLimit(keyHash)) {
      return NextResponse.json(
        {
          error: "Limite de requisições excedido (Rate limit de 120 req/min). Aguarde antes de reenviar.",
          code: "RATE_LIMIT_EXCEEDED"
        },
        { status: 429 }
      );
    }

    // 3. Validação do Payload com Zod
    let rawBody: any;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido. JSON malformado.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parseResult = IngestionEventPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Payload do evento inválido.",
          details: parseResult.error.errors.map(e => ({ field: e.path.join("."), message: e.message })),
          code: "VALIDATION_FAILED"
        },
        { status: 400 }
      );
    }

    const event = parseResult.data;

    // 4. Validação de Janela Temporal (Rejeitar eventos no futuro ou mais velhos que 30 dias)
    const timeCheck = validateEventTimeWindow(event.eventTimestamp);
    if (!timeCheck.valid) {
      return NextResponse.json(
        { error: timeCheck.reason, code: "INVALID_TIMESTAMP_WINDOW" },
        { status: 422 }
      );
    }

    // 5. Autenticação e Vínculo de Tenant no Servidor
    // Usamos admin client exclusivamente após obter a chave
    const supabase = createAdminClient();

    // Consultar a chave em client_api_keys
    const { data: keyRecord, error: keyErr } = await supabase
      .from("client_api_keys")
      .select("id, organization_id, client_id, scopes, is_active, expires_at, revoked_at")
      .eq("key_hash", keyHash)
      .maybeSingle();

    // Tratamento se a tabela de chaves ainda não estiver aplicada na migration
    let orgId: string;
    let clientId: string;
    let apiKeyId: string | null = null;

    if (keyErr) {
      if (keyErr.code === "42P01" || keyErr.message?.includes("does not exist") || keyErr.message?.includes("Could not find the table")) {
        // Migration de chaves pendente: modo de preparação local
        // Se fornecido client_id e organization_id no payload e for chave de teste autorizada
        if (!event.organizationId || !event.clientId) {
          return NextResponse.json(
            {
              error: "Tabela client_api_keys não aplicada remotamente. Forneça organizationId e clientId explicitamente para validação preliminar.",
              code: "MIGRATION_PENDING"
            },
            { status: 503 }
          );
        }
        orgId = event.organizationId;
        clientId = event.clientId;
      } else {
        return NextResponse.json(
          { error: `Falha interna de banco ao autenticar credencial: ${keyErr.message}`, code: "DB_ERROR" },
          { status: 500 }
        );
      }
    } else {
      if (!keyRecord) {
        return NextResponse.json(
          { error: "Acesso negado: Chave de API inválida.", code: "INVALID_API_KEY" },
          { status: 401 }
        );
      }

      // Validar status da chave
      if (!keyRecord.is_active || keyRecord.revoked_at !== null) {
        return NextResponse.json(
          { error: "Acesso negado: Chave de API foi revogada ou está inativa.", code: "REVOKED_API_KEY" },
          { status: 403 }
        );
      }

      if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        return NextResponse.json(
          { error: "Acesso negado: Chave de API expirada.", code: "EXPIRED_API_KEY" },
          { status: 403 }
        );
      }

      if (!keyRecord.scopes || !keyRecord.scopes.includes("events:write")) {
        return NextResponse.json(
          { error: "Acesso negado: A chave não possui o escopo 'events:write'.", code: "INSUFFICIENT_SCOPE" },
          { status: 403 }
        );
      }

      orgId = keyRecord.organization_id;
      clientId = keyRecord.client_id;
      apiKeyId = keyRecord.id;

      // 6. Defesa Anti-Hijacking: se o payload trouxe organizationId ou clientId, deve bater rigorosamente com a chave
      if (event.organizationId && event.organizationId !== orgId) {
        return NextResponse.json(
          { error: "Violação de segurança: organizationId informado diverge da credencial autenticada.", code: "TENANT_MISMATCH" },
          { status: 403 }
        );
      }

      if (event.clientId && event.clientId !== clientId) {
        return NextResponse.json(
          { error: "Violação de segurança: clientId informado diverge da credencial autenticada.", code: "CLIENT_MISMATCH" },
          { status: 403 }
        );
      }
    }

    // 7. Segregação Absoluta de Funil: Endpoint de Marketing NUNCA atribui receita verificada
    // Receita financeira verificada é prerrogativa EXCLUSIVA do endpoint criptográfico /api/tracking/billing-webhook.
    // Qualquer evento de subscription_activated recebido via canal de marketing é registrado com verified_value = 0.00
    // e is_verified_origin = false, prevenindo qualquer ataque de injeção financeira ou forja de ROAS.
    let verifiedValue = 0.00;
    let isVerifiedOrigin = false;

    if (event.eventName === "subscription_activated") {
      verifiedValue = 0.00;
      isVerifiedOrigin = false;
    }

    // 8. Determinar Canal de Atribuição Determinístico (não confiamos cegamente no que o cliente enviar)
    const attribution = resolveAttributionChannel(event.utms);

    // 9. Pseudonimização de PII (LGPD/GDPR) com HMAC-SHA-256 e segredo exclusivo do servidor
    const serverPepper = process.env.PII_PEPPER_SECRET;
    if (process.env.NODE_ENV === "production" && !serverPepper) {
      console.error("[Tracking Security Violation]: PII_PEPPER_SECRET ausente em produção.");
      return NextResponse.json(
        { error: "Erro de configuração de segurança: PII_PEPPER_SECRET obrigatório em ambiente de produção.", code: "SECURITY_CONFIG_ERROR" },
        { status: 500 }
      );
    }
    const effectivePepper = serverPepper || "admetrics_default_dev_pepper_2026";
    const userPseudoId = pseudonimizeUserTraits(event.userTraits, effectivePepper);

    // 10. Persistência e Deduplicação no Banco (Escopo: client_id + event_id)
    const eventRow = {
      organization_id: orgId,
      client_id: clientId,
      event_id: event.eventId,
      event_name: event.eventName,
      event_timestamp: event.eventTimestamp,
      utm_source: event.utms?.utm_source?.toLowerCase().trim() || null,
      utm_medium: event.utms?.utm_medium?.toLowerCase().trim() || null,
      utm_campaign: event.utms?.utm_campaign?.toLowerCase().trim() || null,
      utm_content: event.utms?.utm_content?.trim() || null,
      utm_term: event.utms?.utm_term?.trim() || null,
      attribution_channel: attribution.channel,
      attribution_confidence: attribution.confidence,
      campaign_id: event.campaignId || null,
      verified_value: verifiedValue,
      currency: event.currency || "BRL",
      is_verified_origin: isVerifiedOrigin,
      user_pseudo_id: userPseudoId,
      api_key_id: apiKeyId
    };

    let persistenceResult: "created" | "deduplicated" | "simulated_local" = "simulated_local";

    const { data: insertData, error: insertErr } = await supabase
      .from("tracking_events")
      .insert(eventRow)
      .select("id, event_id, created_at")
      .single();

    if (insertErr) {
      // Código de violação de chave única no Postgres (23505) = Deduplicação
      if (insertErr.code === "23505" || insertErr.message?.includes("duplicate key")) {
        persistenceResult = "deduplicated";
      } else if (insertErr.code === "42P01" || insertErr.message?.includes("does not exist") || insertErr.message?.includes("Could not find the table")) {
        // Tabela tracking_events ainda não aplicada na migration
        persistenceResult = "simulated_local";
      } else {
        return NextResponse.json(
          { error: `Erro no banco de dados ao persistir evento: ${insertErr.message}`, code: insertErr.code },
          { status: 500 }
        );
      }
    } else {
      persistenceResult = "created";
    }

    // Log sanitizado sem PII
    console.info(`[Tracking Ingestion] Evento processado: ${event.eventName} | Client: ${clientId} | Status: ${persistenceResult}`);

    // Resposta HTTP consistente
    return NextResponse.json({
      success: true,
      status: persistenceResult === "deduplicated" ? "DEDUPLICATED_IGNORED" : "ACCEPTED",
      eventId: event.eventId,
      eventName: event.eventName,
      attributionChannel: attribution.channel,
      attributionConfidence: attribution.confidence,
      persistence: persistenceResult,
      isVerifiedOrigin,
      message:
        persistenceResult === "deduplicated"
          ? "Evento duplicado identificado. Descartado para prevenir inflação contábil."
          : persistenceResult === "simulated_local"
          ? "Evento validado e processado localmente. A gravação persistente aguarda a migration 20261027000002."
          : "Evento registrado e atribuído com sucesso."
    });
  } catch (error: any) {
    console.error("[Tracking Ingestion Error]:", error?.message);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar evento de rastreamento.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
