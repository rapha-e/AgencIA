export class MetaApiError extends Error {
    code;
    errorSubcode;
    errorType;
    isTransient;
    constructor(details) {
        super(`[Meta Graph API] ${details.message} (Code: ${details.code}${details.error_subcode ? `, Subcode: ${details.error_subcode}` : ""})`);
        this.name = "MetaApiError";
        this.code = details.code;
        this.errorSubcode = details.error_subcode;
        this.errorType = details.type;
        this.isTransient = Boolean(details.is_transient);
    }
    /**
     * Identifica se o erro é decorrente de token expirado ou revogado
     */
    isAuthError() {
        return this.code === 190 || this.code === 102;
    }
    /**
     * Identifica se o erro é decorrente de limitação de taxa (Rate Limit)
     */
    isRateLimit() {
        return (this.code === 4 ||
            this.code === 17 ||
            this.code === 32 ||
            this.code === 341 ||
            this.code === 613);
    }
}
/**
 * Conector Oficial para Meta Marketing API (Graph API)
 *
 * RESTRIÇÃO CRÍTICA DE ARQUITETURA E SEGURANÇA:
 * - Operações estritamente de leitura (ads_read, read_insights).
 * - Nenhuma mutação (criação, edição ou deleção) é permitida.
 * - Suporta paginação completa via cursor, backoff exponencial com jitter e mapeamento idempotente.
 */
export class MetaAdsConnector {
    platform = "meta";
    accessToken;
    apiVersion;
    fetchFn;
    maxRetries;
    initialBackoffMs;
    maxBackoffMs;
    constructor(options) {
        if (!options.accessToken) {
            throw new Error("MetaAdsConnector requer um accessToken válido.");
        }
        this.accessToken = options.accessToken;
        this.apiVersion =
            options.marketingApiVersion ||
                options.apiVersion ||
                (typeof process !== "undefined" && (process.env?.META_MARKETING_API_VERSION || process.env?.META_API_VERSION)) ||
                "v26.0";
        this.fetchFn = options.fetchFn || fetch;
        this.maxRetries = options.maxRetries ?? 3;
        this.initialBackoffMs = options.initialBackoffMs ?? 500;
        this.maxBackoffMs = options.maxBackoffMs ?? 10000;
    }
    /**
     * Realiza requisição HTTP à Graph API com tratamento de erros,
     * backoff exponencial com jitter e controle de taxa.
     */
    async requestGraphApi(endpoint, params = {}) {
        const isFullUrl = endpoint.startsWith("https://");
        const url = isFullUrl
            ? new URL(endpoint)
            : new URL(`https://graph.facebook.com/${this.apiVersion}/${endpoint.replace(/^\//, "")}`);
        for (const [key, val] of Object.entries(params)) {
            url.searchParams.set(key, val);
        }
        let attempt = 0;
        while (attempt <= this.maxRetries) {
            attempt++;
            try {
                const response = await this.fetchFn(url.toString(), {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        Accept: "application/json"
                    }
                });
                // Rastrear cabeçalhos de uso de cota da Meta (Rate Limits)
                const appUsage = response.headers.get("x-app-usage");
                const businessUsage = response.headers.get("x-business-use-case-usage");
                if (appUsage || businessUsage) {
                    // Monitoramento opcional de consumo de rate limits
                }
                const data = (await response.json());
                if (!response.ok || data.error) {
                    const err = data.error || {};
                    const metaError = new MetaApiError({
                        message: err.message || response.statusText,
                        type: err.type || "GraphMethodException",
                        code: err.code || response.status,
                        error_subcode: err.error_subcode,
                        is_transient: err.is_transient || response.status >= 500
                    });
                    // Se for erro recuperável (rate limit ou 5xx) e ainda houver tentativas
                    if ((metaError.isRateLimit() || metaError.isTransient || response.status >= 500) &&
                        attempt <= this.maxRetries) {
                        const jitter = Math.random() * 200;
                        const backoff = Math.min(this.initialBackoffMs * Math.pow(2, attempt - 1) + jitter, this.maxBackoffMs);
                        await new Promise((resolve) => setTimeout(resolve, backoff));
                        continue;
                    }
                    throw metaError;
                }
                return data;
            }
            catch (error) {
                if (error instanceof MetaApiError) {
                    throw error;
                }
                // Erros de rede (fetch network error)
                if (attempt <= this.maxRetries) {
                    const jitter = Math.random() * 200;
                    const backoff = Math.min(this.initialBackoffMs * Math.pow(2, attempt - 1) + jitter, this.maxBackoffMs);
                    await new Promise((resolve) => setTimeout(resolve, backoff));
                    continue;
                }
                throw new Error(`Falha de comunicação com Meta Graph API: ${error.message}`);
            }
        }
        throw new Error(`Limite máximo de ${this.maxRetries} tentativas excedido na chamada da Meta API.`);
    }
    /**
     * Lista as contas de anúncios acessíveis pelo usuário autenticado
     */
    async listAccounts() {
        const accounts = [];
        let nextUrl = "me/adaccounts";
        let params = {
            fields: "id,name,currency,timezone_name,account_status",
            limit: "100"
        };
        let pageCount = 0;
        const maxPages = 20;
        while (nextUrl && pageCount < maxPages) {
            pageCount++;
            const response = await this.requestGraphApi(nextUrl, pageCount === 1 ? params : {});
            if (response.data) {
                for (const acc of response.data) {
                    // Status 1 = ACTIVE, 2 = DISABLED, 3 = UNSETTLED, 7 = PENDING_RISK_REVIEW
                    accounts.push({
                        id: acc.id.startsWith("act_") ? acc.id : `act_${acc.id}`,
                        name: acc.name || `Conta ${acc.id}`,
                        platform: this.platform,
                        currency: acc.currency || "BRL",
                        timezone: acc.timezone_name || "America/Sao_Paulo"
                    });
                }
            }
            nextUrl = response.paging?.next;
        }
        return accounts;
    }
    /**
     * Sincroniza a estrutura de campanhas da conta com paginação
     */
    async syncCampaigns(accountId, clientId) {
        const formattedAccountId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
        const campaigns = [];
        let nextUrl = `${formattedAccountId}/campaigns`;
        let params = {
            fields: "id,name,status,daily_budget,lifetime_budget,objective,updated_time",
            limit: "100"
        };
        let pageCount = 0;
        const maxPages = 50;
        while (nextUrl && pageCount < maxPages) {
            pageCount++;
            const response = await this.requestGraphApi(nextUrl, pageCount === 1 ? params : {});
            if (response.data) {
                for (const item of response.data) {
                    let status = "UNKNOWN";
                    if (item.status === "ACTIVE")
                        status = "ACTIVE";
                    else if (item.status === "PAUSED")
                        status = "PAUSED";
                    else if (item.status === "ARCHIVED" || item.status === "DELETED")
                        status = "ARCHIVED";
                    // Meta retorna orçamentos em centavos (ex: 15000 = R$ 150.00)
                    const dailyBudget = item.daily_budget
                        ? parseFloat(item.daily_budget) / 100
                        : null;
                    const lifetimeBudget = item.lifetime_budget
                        ? parseFloat(item.lifetime_budget) / 100
                        : null;
                    campaigns.push({
                        id: crypto.randomUUID(),
                        connectionId: `conn_meta_${formattedAccountId}`,
                        clientId,
                        platform: this.platform,
                        externalCampaignId: item.id,
                        name: item.name,
                        status,
                        dailyBudget,
                        lifetimeBudget,
                        objective: item.objective || "UNKNOWN",
                        lastUpdatedRemote: item.updated_time || new Date().toISOString()
                    });
                }
            }
            nextUrl = response.paging?.next;
        }
        const isTruncated = Boolean(nextUrl && pageCount >= maxPages);
        if (isTruncated) {
            console.warn(`[MetaAdsConnector] Limite de segurança de ${maxPages} páginas atingido para campanhas da conta ${formattedAccountId}. Paginação truncada.`);
        }
        return {
            success: true,
            recordsCount: campaigns.length,
            data: campaigns,
            syncedAt: new Date().toISOString(),
            isTruncated
        };
    }
    /**
     * Busca métricas normalizadas de campanhas via Meta Insights API
     */
    async fetchMetrics(accountId, clientId, dateRange) {
        const formattedAccountId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
        const metrics = [];
        let nextUrl = `${formattedAccountId}/insights`;
        const params = {
            level: "campaign",
            fields: "campaign_id,campaign_name,date_start,date_stop,impressions,clicks,spend,actions,action_values",
            time_range: JSON.stringify({ since: dateRange.start, until: dateRange.end }),
            time_increment: "1", // Granularidade diária
            limit: "100"
        };
        let pageCount = 0;
        const maxPages = 50;
        while (nextUrl && pageCount < maxPages) {
            pageCount++;
            const response = await this.requestGraphApi(nextUrl, pageCount === 1 ? params : {});
            if (response.data) {
                for (const row of response.data) {
                    const impressions = parseInt(row.impressions || "0", 10);
                    const clicks = parseInt(row.clicks || "0", 10);
                    const spend = parseFloat(row.spend || "0");
                    // Extração normalizada de conversões com precedência anti-duplicação
                    let conversions = 0;
                    if (row.actions && Array.isArray(row.actions)) {
                        // Mapeia valores por tipo de ação
                        const actionMap = new Map();
                        for (const act of row.actions) {
                            actionMap.set(act.action_type, parseFloat(act.value || "0"));
                        }
                        // Precedência de Compras: omni_purchase > purchase > offsite_conversion.fb_pixel_purchase
                        const purchases = actionMap.get("omni_purchase") ??
                            actionMap.get("purchase") ??
                            actionMap.get("offsite_conversion.fb_pixel_purchase") ??
                            0;
                        const leads = actionMap.get("lead") ?? 0;
                        const contacts = actionMap.get("contact_total") ?? 0;
                        // Soma de eventos únicos não sobrepostos
                        conversions = purchases + leads + contacts;
                    }
                    // Extração normalizada de receita (conversion value) com precedência anti-duplicação
                    let revenue = 0;
                    if (row.action_values && Array.isArray(row.action_values)) {
                        const valueMap = new Map();
                        for (const val of row.action_values) {
                            valueMap.set(val.action_type, parseFloat(val.value || "0"));
                        }
                        // Precedência de Receita: omni_purchase > purchase > offsite_conversion.fb_pixel_purchase
                        revenue =
                            valueMap.get("omni_purchase") ??
                                valueMap.get("purchase") ??
                                valueMap.get("offsite_conversion.fb_pixel_purchase") ??
                                0;
                    }
                    metrics.push({
                        id: crypto.randomUUID(),
                        clientId,
                        platform: this.platform,
                        externalAccountId: formattedAccountId,
                        campaignId: row.campaign_id,
                        date: row.date_start,
                        impressions,
                        clicks,
                        spend,
                        conversions,
                        revenue,
                        currency: "BRL",
                        attributionWindow: "7d_click_1d_view",
                        source: "meta_graph_api"
                    });
                }
            }
            nextUrl = response.paging?.next;
        }
        const isTruncated = Boolean(nextUrl && pageCount >= maxPages);
        if (isTruncated) {
            console.warn(`[MetaAdsConnector] Limite de segurança de ${maxPages} páginas atingido para métricas da conta ${formattedAccountId}. Paginação truncada.`);
        }
        return {
            success: true,
            recordsCount: metrics.length,
            data: metrics,
            syncedAt: new Date().toISOString(),
            isTruncated
        };
    }
    /**
     * REQUISITO OBRIGATÓRIO DE SEGURANÇA E GOVERNANÇA:
     * Validação rejeita qualquer tentativa de execução remota de alteração.
     */
    async validateAction(action) {
        return {
            canExecute: false,
            reason: "Modo estritamente somente leitura ativado: O MetaAdsConnector proíbe alterações remotas por governança e ausência deliberada de escopos de mutação (ads_management)."
        };
    }
    /**
     * REQUISITO OBRIGATÓRIO DE SEGURANÇA E GOVERNANÇA:
     * Bloqueio irreversível contra mutações remotas.
     */
    async executeAction(action, idempotencyKey) {
        throw new Error("VIOLAÇÃO DE SEGURANÇA: Operações de mutação no Meta Ads estão terminantemente bloqueadas. O conector opera exclusivamente com leitura auditada (ads_read, read_insights).");
    }
}
//# sourceMappingURL=connector.js.map