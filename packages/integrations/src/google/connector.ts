import {
  Campaign,
  MetricFact,
  PlatformType,
  ProposedActionPayload
} from "@admetrics/domain";
import {
  ActionExecutionResult,
  AdsConnector,
  ExternalAccount,
  SyncResult
} from "../contracts.js";

export interface GoogleAdsConnectorOptions {
  accessToken: string;
  developerToken?: string;
  loginCustomerId?: string;
  apiVersion?: string;
  fetchFn?: typeof fetch;
  maxRetries?: number;
  initialBackoffMs?: number;
}

export class GoogleAdsApiError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;

  constructor(message: string, statusCode: number, statusText = "GOOGLE_ADS_ERROR") {
    super(`[Google Ads API] ${message} (HTTP ${statusCode} - ${statusText})`);
    this.name = "GoogleAdsApiError";
    this.statusCode = statusCode;
    this.statusText = statusText;
  }

  public isAuthError(): boolean {
    return this.statusCode === 401 || this.statusText === "UNAUTHENTICATED";
  }

  public isRateLimit(): boolean {
    return this.statusCode === 429 || this.statusText === "RESOURCE_EXHAUSTED";
  }
}

/**
 * Conector Oficial para Google Ads REST API (GAQL searchStream)
 *
 * RESTRIÇÃO CRÍTICA DE ARQUITETURA E SEGURANÇA:
 * - Consultas estritamente de leitura via Google Ads Query Language (GAQL).
 * - Conversão determinística de micros (1 unidade monetária = 1.000.000 micros).
 * - Bloqueio estrito contra mutações diretas não autorizadas.
 */
export class GoogleAdsConnector implements AdsConnector {
  public readonly platform: PlatformType = "google_ads";
  private readonly accessToken: string;
  private readonly developerToken: string;
  private readonly loginCustomerId?: string;
  private readonly apiVersion: string;
  private readonly fetchFn: typeof fetch;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  constructor(options: GoogleAdsConnectorOptions) {
    if (!options.accessToken) {
      throw new Error("GoogleAdsConnector requer um accessToken válido.");
    }
    this.accessToken = options.accessToken;
    this.developerToken =
      options.developerToken ||
      (typeof process !== "undefined" ? process.env?.GOOGLE_ADS_DEVELOPER_TOKEN || "dev_token_unset" : "dev_token_unset");
    this.loginCustomerId = options.loginCustomerId
      ? options.loginCustomerId.replace(/\D/g, "")
      : undefined;
    this.apiVersion = options.apiVersion || "v18";
    this.fetchFn = options.fetchFn || fetch;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 500;
  }

  /**
   * Normaliza o Customer ID do Google Ads (remove hífens: 123-456-7890 -> 1234567890)
   */
  public static normalizeCustomerId(accountId: string): string {
    return accountId.replace(/^customers\//, "").replace(/\D/g, "");
  }

  /**
   * Converte valores em micros do Google Ads para unidade monetária (ex: 150000000 -> 150.00)
   */
  public static microsToCurrency(micros: string | number | null | undefined): number {
    if (micros === null || micros === undefined) return 0;
    const num = typeof micros === "string" ? parseFloat(micros) : micros;
    if (isNaN(num)) return 0;
    return Math.round((num / 1_000_000) * 100) / 100;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "developer-token": this.developerToken,
      "Content-Type": "application/json"
    };
    if (this.loginCustomerId) {
      headers["login-customer-id"] = this.loginCustomerId;
    }
    return headers;
  }

  /**
   * Executa consulta GAQL via endpoint searchStream da Google Ads API
   */
  private async executeGaqlStream<T>(customerId: string, query: string): Promise<T[]> {
    const cleanCustomerId = GoogleAdsConnector.normalizeCustomerId(customerId);
    const url = `https://googleads.googleapis.com/${this.apiVersion}/customers/${cleanCustomerId}/googleAds:searchStream`;

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const response = await this.fetchFn(url, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({ query })
        });

        const payload = (await response.json()) as any;

        if (!response.ok || payload?.error || (Array.isArray(payload) && payload[0]?.error)) {
          const errObj = payload?.error || (Array.isArray(payload) ? payload[0]?.error : {}) || {};
          const apiError = new GoogleAdsApiError(
            errObj.message || response.statusText || "Erro na consulta GAQL",
            errObj.code || response.status,
            errObj.status || "UNKNOWN"
          );

          if ((apiError.isRateLimit() || response.status >= 500) && attempt <= this.maxRetries) {
            const backoff = this.initialBackoffMs * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          throw apiError;
        }

        // searchStream retorna um array de batches [{ results: [...] }, ...]
        const batches = Array.isArray(payload) ? payload : [payload];
        const rows: T[] = [];
        for (const batch of batches) {
          if (batch && Array.isArray(batch.results)) {
            rows.push(...batch.results);
          }
        }
        return rows;
      } catch (err: any) {
        if (err instanceof GoogleAdsApiError) {
          throw err;
        }
        if (attempt <= this.maxRetries) {
          const backoff = this.initialBackoffMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw new Error(`Falha de rede na comunicação com Google Ads API: ${err.message}`);
      }
    }

    return [];
  }

  /**
   * Lista todas as contas Google Ads acessíveis pelo token OAuth
   */
  async listAccounts(): Promise<ExternalAccount[]> {
    const url = `https://googleads.googleapis.com/${this.apiVersion}/customers:listAccessibleCustomers`;
    const response = await this.fetchFn(url, {
      method: "GET",
      headers: this.getHeaders()
    });

    const data = (await response.json()) as any;
    if (!response.ok || data?.error) {
      const errObj = data?.error || {};
      throw new GoogleAdsApiError(
        errObj.message || response.statusText || "Falha ao listar contas Google Ads",
        errObj.code || response.status,
        errObj.status || "UNKNOWN"
      );
    }

    const resourceNames: string[] = data?.resourceNames || [];
    const accounts: ExternalAccount[] = [];

    for (const resourceName of resourceNames) {
      const customerId = GoogleAdsConnector.normalizeCustomerId(resourceName);
      if (!customerId) continue;

      try {
        interface CustomerRow {
          customer?: {
            id?: string;
            descriptiveName?: string;
            currencyCode?: string;
            timeZone?: string;
          };
        }
        const rows = await this.executeGaqlStream<CustomerRow>(
          customerId,
          "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1"
        );
        const cust = rows[0]?.customer;
        accounts.push({
          id: customerId,
          name: cust?.descriptiveName || `Google Ads (${customerId})`,
          platform: this.platform,
          currency: cust?.currencyCode || "BRL",
          timezone: cust?.timeZone || "America/Sao_Paulo"
        });
      } catch {
        // Caso uma subconta MCC exija login-customer-id diferente, registra ID básico
        accounts.push({
          id: customerId,
          name: `Google Ads (${customerId})`,
          platform: this.platform,
          currency: "BRL",
          timezone: "America/Sao_Paulo"
        });
      }
    }

    return accounts;
  }

  /**
   * Sincroniza a estrutura de campanhas via GAQL
   */
  async syncCampaigns(accountId: string, clientId: string): Promise<SyncResult<Campaign>> {
    const cleanCustomerId = GoogleAdsConnector.normalizeCustomerId(accountId);

    const gaql = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `.trim();

    interface CampaignGaqlRow {
      campaign?: {
        id?: string;
        name?: string;
        status?: string;
        advertisingChannelType?: string;
      };
      campaignBudget?: {
        amountMicros?: string | number;
      };
    }

    const rows = await this.executeGaqlStream<CampaignGaqlRow>(cleanCustomerId, gaql);

    const campaigns: Campaign[] = rows.map((row) => {
      const rawStatus = row.campaign?.status || "UNKNOWN";
      let status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "UNKNOWN" = "UNKNOWN";
      if (rawStatus === "ENABLED" || rawStatus === "ACTIVE") status = "ACTIVE";
      else if (rawStatus === "PAUSED") status = "PAUSED";
      else if (rawStatus === "REMOVED") status = "ARCHIVED";

      const dailyBudget = row.campaignBudget?.amountMicros !== undefined
        ? GoogleAdsConnector.microsToCurrency(row.campaignBudget.amountMicros)
        : null;

      return {
        id: crypto.randomUUID(),
        connectionId: `conn_google_${cleanCustomerId}`,
        clientId,
        platform: this.platform,
        externalCampaignId: String(row.campaign?.id || ""),
        name: row.campaign?.name || "Campanha Google Ads",
        status,
        dailyBudget,
        lifetimeBudget: null,
        objective: row.campaign?.advertisingChannelType || "SEARCH",
        lastUpdatedRemote: new Date().toISOString()
      };
    });

    return {
      success: true,
      recordsCount: campaigns.length,
      data: campaigns,
      syncedAt: new Date().toISOString()
    };
  }

  /**
   * Busca métricas diárias normalizadas via GAQL convertendo cost_micros em unidade monetária
   */
  async fetchMetrics(
    accountId: string,
    clientId: string,
    dateRange: { start: string; end: string }
  ): Promise<SyncResult<MetricFact>> {
    const cleanCustomerId = GoogleAdsConnector.normalizeCustomerId(accountId);

    const gaql = `
      SELECT
        campaign.id,
        campaign.name,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
    `.trim();

    interface MetricsGaqlRow {
      campaign?: {
        id?: string;
        name?: string;
      };
      segments?: {
        date?: string;
      };
      metrics?: {
        impressions?: string | number;
        clicks?: string | number;
        costMicros?: string | number;
        conversions?: string | number;
        conversionsValue?: string | number;
      };
    }

    const rows = await this.executeGaqlStream<MetricsGaqlRow>(cleanCustomerId, gaql);

    const metrics: MetricFact[] = rows.map((row) => {
      const impressions = Number(row.metrics?.impressions || 0);
      const clicks = Number(row.metrics?.clicks || 0);
      const spend = GoogleAdsConnector.microsToCurrency(row.metrics?.costMicros);
      const conversions = Number(row.metrics?.conversions || 0);
      const revenue = Math.round(Number(row.metrics?.conversionsValue || 0) * 100) / 100;

      return {
        id: crypto.randomUUID(),
        clientId,
        platform: this.platform,
        externalAccountId: cleanCustomerId,
        campaignId: String(row.campaign?.id || ""),
        date: row.segments?.date || dateRange.start,
        impressions,
        clicks,
        spend,
        conversions,
        revenue,
        currency: "BRL",
        attributionWindow: "30d_click_1d_view",
        source: "google_ads_api"
      };
    });

    return {
      success: true,
      recordsCount: metrics.length,
      data: metrics,
      syncedAt: new Date().toISOString()
    };
  }

  /**
   * Governança de Segurança: Bloqueia mutações diretas em modo somente leitura
   */
  async validateAction(
    action: ProposedActionPayload
  ): Promise<{ canExecute: boolean; reason?: string }> {
    return {
      canExecute: false,
      reason:
        "Modo estritamente somente leitura ativado: O GoogleAdsConnector opera exclusivamente via consultas GAQL auditadas (searchStream)."
    };
  }

  async executeAction(
    action: ProposedActionPayload,
    idempotencyKey: string
  ): Promise<ActionExecutionResult> {
    throw new Error(
      "VIOLAÇÃO DE SEGURANÇA: Mutações diretas no Google Ads estão bloqueadas. O conector opera exclusivamente em modo de leitura auditada."
    );
  }
}

