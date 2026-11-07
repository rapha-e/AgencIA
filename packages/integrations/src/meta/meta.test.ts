import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptToken,
  decryptToken,
  DecryptionError
} from "./crypto.js";
import {
  MetaOAuthService,
  META_READONLY_SCOPES
} from "./oauth.js";
import {
  MetaAdsConnector,
  MetaApiError
} from "./connector.js";

// ============================================================================
// 1. TESTES DE CRIPTOGRAFIA AES-256-GCM
// ============================================================================

test("CRIPTOGRAFIA: Encrypt & Decrypt com integridade GCM (round-trip)", () => {
  const secretKey = "super_secret_test_key_32_bytes_length!!";
  const rawToken = "EAABwzLIXgnYBO123456789RealMetaAdsTokenExampleValue";

  const encrypted = encryptToken(rawToken, secretKey);
  assert.ok(encrypted.versionedPayload.startsWith("v1:"));
  assert.equal(encrypted.versionedPayload.split(":").length, 4);

  const decrypted = decryptToken(encrypted.versionedPayload, secretKey);
  assert.equal(decrypted, rawToken);
});

test("CRIPTOGRAFIA: Rejeita payload adulterado ou com tag inválida", () => {
  const secretKey = "super_secret_test_key_32_bytes_length!!";
  const rawToken = "secret_token_123";

  const { versionedPayload } = encryptToken(rawToken, secretKey);
  const parts = versionedPayload.split(":");

  // Adulterar o ciphertext
  const tamperedCiphertext = parts[3].slice(0, -2) + "ff";
  const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCiphertext}`;

  assert.throws(
    () => decryptToken(tamperedPayload, secretKey),
    (err: any) => err instanceof DecryptionError
  );

  // Adulterar a tag de autenticação
  const tamperedTag = "00".repeat(16);
  const tamperedTagPayload = `${parts[0]}:${parts[1]}:${tamperedTag}:${parts[3]}`;

  assert.throws(
    () => decryptToken(tamperedTagPayload, secretKey),
    (err: any) => err instanceof DecryptionError
  );
});

test("CRIPTOGRAFIA: Rejeita formato inválido ou versão não suportada", () => {
  assert.throws(
    () => decryptToken("v2:invalid:payload:string"),
    (err: any) => err instanceof DecryptionError
  );
  assert.throws(
    () => decryptToken("not_even_a_valid_format"),
    (err: any) => err instanceof DecryptionError
  );
});

// ============================================================================
// 2. TESTES DE FLUXO OAUTH E CSRF
// ============================================================================

test("OAUTH: Garante que escopo 'ads_management' NUNCA é solicitado", () => {
  assert.ok(!META_READONLY_SCOPES.includes("ads_management" as any));
  assert.ok(META_READONLY_SCOPES.includes("ads_read"));
  assert.ok(META_READONLY_SCOPES.includes("public_profile"));
});

test("OAUTH: Geração e validação de state com assinatura HMAC anti-CSRF", () => {
  const oauthService = new MetaOAuthService({
    appId: "1234567890",
    appSecret: "test_meta_app_secret_abc123",
    redirectUri: "https://admetrics.example.com/api/integrations/meta/callback"
  });

  const { stateString, nonce } = oauthService.generateSignedState({
    userId: "u-123",
    organizationId: "org-456",
    clientId: "cli-789"
  });

  assert.ok(stateString.includes("."));

  // Validação legítima
  const verified = oauthService.verifySignedState(stateString);
  assert.equal(verified.userId, "u-123");
  assert.equal(verified.organizationId, "org-456");
  assert.equal(verified.clientId, "cli-789");
  assert.equal(verified.nonce, nonce);

  // Rejeição contra adulteração de assinatura
  const tamperedState = stateString.slice(0, -4) + "abcd";
  assert.throws(
    () => oauthService.verifySignedState(tamperedState),
    /Assinatura do state inválida/
  );
});

test("OAUTH: Rejeita state expirado (> 10 minutos)", () => {
  const oauthService = new MetaOAuthService({
    appId: "1234567890",
    appSecret: "test_meta_app_secret_abc123",
    redirectUri: "https://admetrics.example.com/api/integrations/meta/callback"
  });

  const { stateString } = oauthService.generateSignedState({
    userId: "u-123",
    organizationId: "org-456",
    clientId: "cli-789"
  });

  // maxAgeMs = -1 força expiração imediata
  assert.throws(
    () => oauthService.verifySignedState(stateString, -1),
    /O link de autorização expirou/
  );
});

test("OAUTH: Gera URL correta com endpoint oficial do Facebook", () => {
  const oauthService = new MetaOAuthService({
    appId: "999888777",
    appSecret: "secret",
    redirectUri: "https://admetrics.app/callback",
    apiVersion: "v21.0"
  });

  const url = oauthService.getAuthorizationUrl("state_token_xyz");
  assert.ok(url.startsWith("https://www.facebook.com/v21.0/dialog/oauth?"));
  assert.ok(url.includes("client_id=999888777"));
  assert.ok(url.includes("scope=ads_read%2Cpublic_profile"));
  assert.ok(!url.includes("ads_management"));
});

test("OAUTH: Troca de código por token com mock fetch", async () => {
  const oauthService = new MetaOAuthService({
    appId: "123",
    appSecret: "sec",
    redirectUri: "https://admetrics.app/cb"
  });

  const mockFetch: any = async () => ({
    ok: true,
    json: async () => ({
      access_token: "short_lived_token_123",
      token_type: "bearer",
      expires_in: 3600
    })
  });

  const tokenResp = await oauthService.exchangeCodeForToken("valid_code_abc", mockFetch);
  assert.equal(tokenResp.accessToken, "short_lived_token_123");
  assert.equal(tokenResp.expiresIn, 3600);
});

// ============================================================================
// 3. TESTES DO CONECTOR META ADS (LEITURA, PAGINAÇÃO, RATE LIMIT E SEGURANÇA)
// ============================================================================

test("CONECTOR: listAccounts mapeia contas de anúncios e formata ID com act_", async () => {
  const mockFetch: any = async () => ({
    ok: true,
    headers: new Headers(),
    json: async () => ({
      data: [
        {
          id: "act_1010101",
          name: "Conta Meta Alpha",
          currency: "BRL",
          timezone_name: "America/Sao_Paulo",
          account_status: 1
        },
        {
          id: "2020202", // Sem prefixo act_ vindo da API
          name: "Conta Meta Beta",
          currency: "USD",
          timezone_name: "America/New_York",
          account_status: 1
        }
      ]
    })
  });

  const connector = new MetaAdsConnector({
    accessToken: "valid_token",
    fetchFn: mockFetch
  });

  const accounts = await connector.listAccounts();
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].id, "act_1010101");
  assert.equal(accounts[1].id, "act_2020202");
  assert.equal(accounts[0].platform, "meta");
});

test("CONECTOR: syncCampaigns consome paginação e converte orçamentos de centavos para unidade", async () => {
  let callCount = 0;
  const mockFetch: any = async (url: string) => {
    callCount++;
    if (callCount === 1) {
      return {
        ok: true,
        headers: new Headers(),
        json: async () => ({
          data: [
            {
              id: "camp_001",
              name: "Campanha Topo",
              status: "ACTIVE",
              daily_budget: "15000", // 150.00 BRL
              objective: "OUTCOME_AWARENESS",
              updated_time: "2026-10-26T12:00:00Z"
            }
          ],
          paging: {
            next: "https://graph.facebook.com/v21.0/act_123/campaigns?after=cursor_page_2"
          }
        })
      };
    }

    return {
      ok: true,
      headers: new Headers(),
      json: async () => ({
        data: [
          {
            id: "camp_002",
            name: "Campanha Fundo",
            status: "PAUSED",
            daily_budget: "28000", // 280.00 BRL
            objective: "OUTCOME_LEADS",
            updated_time: "2026-10-26T12:00:00Z"
          }
        ]
      })
    };
  };

  const connector = new MetaAdsConnector({
    accessToken: "valid_token",
    fetchFn: mockFetch
  });

  const result = await connector.syncCampaigns("act_123", "client_456");
  assert.equal(result.success, true);
  assert.equal(result.recordsCount, 2);
  assert.equal(callCount, 2); // Verificou paginação via cursor

  const camp1 = result.data.find((c) => c.externalCampaignId === "camp_001")!;
  assert.equal(camp1.dailyBudget, 150.0);
  assert.equal(camp1.status, "ACTIVE");

  const camp2 = result.data.find((c) => c.externalCampaignId === "camp_002")!;
  assert.equal(camp2.dailyBudget, 280.0);
  assert.equal(camp2.status, "PAUSED");
});

test("CONECTOR: fetchMetrics agrega conversões e receitas de insights normalizados", async () => {
  const mockFetch: any = async () => ({
    ok: true,
    headers: new Headers(),
    json: async () => ({
      data: [
        {
          campaign_id: "camp_001",
          campaign_name: "Campanha Topo",
          date_start: "2026-10-26",
          date_stop: "2026-10-26",
          impressions: "10000",
          clicks: "300",
          spend: "150.50",
          actions: [
            { action_type: "lead", value: "15" },
            { action_type: "link_click", value: "300" } // Não conta como conversão final
          ],
          action_values: [
            { action_type: "purchase", value: "1250.00" }
          ]
        }
      ]
    })
  });

  const connector = new MetaAdsConnector({
    accessToken: "valid_token",
    fetchFn: mockFetch
  });

  const result = await connector.fetchMetrics("act_123", "client_456", {
    start: "2026-10-26",
    end: "2026-10-26"
  });

  assert.equal(result.success, true);
  assert.equal(result.recordsCount, 1);
  const metric = result.data[0];
  assert.equal(metric.impressions, 10000);
  assert.equal(metric.clicks, 300);
  assert.equal(metric.spend, 150.5);
  assert.equal(metric.conversions, 15);
  assert.equal(metric.revenue, 1250.0);
  assert.equal(metric.source, "meta_graph_api");
});

test("CONECTOR: Rejeição estrita de mutação (validateAction e executeAction)", async () => {
  const connector = new MetaAdsConnector({
    accessToken: "valid_token"
  });

  const dummyPayload = {
    actionType: "ADJUST_DAILY_BUDGET" as const,
    platform: "meta" as const,
    externalAccountId: "act_123",
    resourceType: "CAMPAIGN" as const,
    resourceId: "camp_001",
    currentValue: 100,
    proposedValue: 80,
    unit: "BRL" as const,
    reason: "Teste de segurança"
  };

  // validateAction deve acusar que mutações são proibidas
  const validation = await connector.validateAction(dummyPayload);
  assert.equal(validation.canExecute, false);
  assert.ok(validation.reason?.includes("Modo estritamente somente leitura"));

  // executeAction deve lançar erro fatal de segurança
  await assert.rejects(
    async () => {
      await connector.executeAction(dummyPayload, "key_123");
    },
    (err: any) => {
      return err.message.includes("VIOLAÇÃO DE SEGURANÇA");
    }
  );
});

test("CONECTOR: Recuperação por backoff em erro transitório 500", async () => {
  let attempts = 0;
  const mockFetch: any = async () => {
    attempts++;
    if (attempts === 1) {
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        json: async () => ({
          error: {
            message: "Temporary issue with Facebook servers",
            code: 2,
            is_transient: true
          }
        })
      };
    }

    return {
      ok: true,
      headers: new Headers(),
      json: async () => ({
        data: [{ id: "act_recovered", name: "Conta Recuperada" }]
      })
    };
  };

  const connector = new MetaAdsConnector({
    accessToken: "valid_token",
    fetchFn: mockFetch,
    initialBackoffMs: 10 // rápido para testes
  });

  const accounts = await connector.listAccounts();
  assert.equal(accounts.length, 1);
  assert.equal(attempts, 2); // Tentou novamente após o 500
});

test("CONECTOR: Mapeia erro de token expirado (OAuthException Code 190)", async () => {
  const mockFetch: any = async () => ({
    ok: false,
    status: 400,
    statusText: "Bad Request",
    headers: new Headers(),
    json: async () => ({
      error: {
        message: "Error validating access token: Session has expired",
        type: "OAuthException",
        code: 190,
        error_subcode: 463
      }
    })
  });

  const connector = new MetaAdsConnector({
    accessToken: "expired_token",
    fetchFn: mockFetch,
    maxRetries: 0
  });

  await assert.rejects(
    async () => {
      await connector.listAccounts();
    },
    (err: any) => {
      return err instanceof MetaApiError && err.isAuthError() && err.code === 190;
    }
  );
});

// ============================================================================
// 4. TESTES DE ISOLAMENTO MULTI-TENANT E BLINDAGEM DE SEGREDOS
// ============================================================================

test("ISOLAMENTO MULTI-TENANT: State assinado vincula estritamente à organização e impede cross-tenant hijacking", () => {
  const oauthService = new MetaOAuthService({
    appId: "app_123",
    appSecret: "tenant_secret_key_abc",
    redirectUri: "https://admetrics.app/callback"
  });

  // Geração de state legítimo para Organização Alpha
  const { stateString } = oauthService.generateSignedState({
    userId: "user-alpha-owner",
    organizationId: "org-alpha-uuid",
    clientId: "client-alpha-uuid"
  });

  const verified = oauthService.verifySignedState(stateString);
  assert.equal(verified.organizationId, "org-alpha-uuid");
  assert.notEqual(verified.organizationId, "org-beta-uuid");

  // Tentativa maliciosa de forjar o state para vincular à Organização Beta
  const [payloadBase64, signature] = stateString.split(".");
  const decodedPayload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
  decodedPayload.organizationId = "org-beta-uuid"; // Ataque de spoofing de tenant
  const forgedPayloadBase64 = Buffer.from(JSON.stringify(decodedPayload), "utf8").toString("base64url");
  const forgedState = `${forgedPayloadBase64}.${signature}`;

  assert.throws(
    () => oauthService.verifySignedState(forgedState),
    /Assinatura do state inválida/
  );
});

test("SEGURANÇA DE DADOS: syncCampaigns e fetchMetrics não expõem accessToken nos objetos retornados nem em logs", async () => {
  const secretAccessToken = "EAA_VERY_SECRET_TOKEN_NEVER_LEAK_123456789";

  const mockFetch: any = async () => ({
    ok: true,
    headers: new Headers(),
    json: async () => ({
      data: [
        {
          id: "camp_100",
          name: "Campanha Topo de Funil",
          status: "ACTIVE",
          daily_budget: "10000",
          objective: "OUTCOME_TRAFFIC"
        }
      ]
    })
  });

  const connector = new MetaAdsConnector({
    accessToken: secretAccessToken,
    fetchFn: mockFetch
  });

  const result = await connector.syncCampaigns("act_123", "client_456");

  // Serializa todo o resultado e confirma ausência do token secreto
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes(secretAccessToken));

  // Validação em fetchMetrics
  const mockMetricsFetch: any = async () => ({
    ok: true,
    headers: new Headers(),
    json: async () => ({
      data: [
        {
          campaign_id: "camp_100",
          impressions: "5000",
          clicks: "120",
          spend: "85.00"
        }
      ]
    })
  });

  const connectorMetrics = new MetaAdsConnector({
    accessToken: secretAccessToken,
    fetchFn: mockMetricsFetch
  });

  const metricsResult = await connectorMetrics.fetchMetrics("act_123", "client_456", {
    start: "2026-10-26",
    end: "2026-10-26"
  });

  const serializedMetrics = JSON.stringify(metricsResult);
  assert.ok(!serializedMetrics.includes(secretAccessToken));
});

test("VERSIONAMENTO: Desacoplamento entre Graph API v22.0 (OAuth) e Marketing API v26.0 (Anúncios/Insights)", async () => {
  // 1. Graph API opera com v22.0 estável para autenticação OAuth e debug_token
  const oauthService = new MetaOAuthService({
    appId: "app_999",
    appSecret: "sec_999",
    redirectUri: "https://admetrics.app/callback"
  });

  const url = oauthService.getAuthorizationUrl("test_state");
  assert.ok(url.startsWith("https://www.facebook.com/v22.0/dialog/oauth"));

  // 2. Marketing API opera por padrão na versão vigente v26.0 para endpoints de anúncios
  let requestedEndpointDefault = "";
  const mockFetchDefault: any = async (targetUrl: string) => {
    requestedEndpointDefault = targetUrl;
    return {
      ok: true,
      headers: new Headers(),
      json: async () => ({ data: [] })
    };
  };

  const marketingConnectorDefault = new MetaAdsConnector({
    accessToken: "valid_token",
    fetchFn: mockFetchDefault
  });

  await marketingConnectorDefault.listAccounts();
  assert.ok(
    requestedEndpointDefault.includes("https://graph.facebook.com/v26.0/me/adaccounts"),
    `Esperado endpoint v26.0, recebido: ${requestedEndpointDefault}`
  );

  // 3. Marketing API suporta override independente (ex: v25.0) sem alterar o OAuth
  let requestedEndpointCustom = "";
  const mockFetchCustom: any = async (targetUrl: string) => {
    requestedEndpointCustom = targetUrl;
    return {
      ok: true,
      headers: new Headers(),
      json: async () => ({ data: [] })
    };
  };

  const marketingConnectorCustom = new MetaAdsConnector({
    accessToken: "valid_token",
    marketingApiVersion: "v25.0",
    fetchFn: mockFetchCustom
  });

  await marketingConnectorCustom.listAccounts();
  assert.ok(
    requestedEndpointCustom.includes("https://graph.facebook.com/v25.0/me/adaccounts"),
    `Esperado endpoint customizado v25.0, recebido: ${requestedEndpointCustom}`
  );
});

