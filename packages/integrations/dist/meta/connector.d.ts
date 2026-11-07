import { Campaign, MetricFact, PlatformType, ProposedActionPayload } from "@admetrics/domain";
import { ActionExecutionResult, AdsConnector, ExternalAccount, SyncResult } from "../contracts.js";
export interface MetaConnectorOptions {
    accessToken: string;
    apiVersion?: string;
    marketingApiVersion?: string;
    fetchFn?: typeof fetch;
    maxRetries?: number;
    initialBackoffMs?: number;
    maxBackoffMs?: number;
}
export interface MetaApiErrorDetails {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    is_transient?: boolean;
    error_user_title?: string;
    error_user_msg?: string;
}
export declare class MetaApiError extends Error {
    readonly code: number;
    readonly errorSubcode?: number;
    readonly errorType: string;
    readonly isTransient: boolean;
    constructor(details: MetaApiErrorDetails);
    /**
     * Identifica se o erro é decorrente de token expirado ou revogado
     */
    isAuthError(): boolean;
    /**
     * Identifica se o erro é decorrente de limitação de taxa (Rate Limit)
     */
    isRateLimit(): boolean;
}
/**
 * Conector Oficial para Meta Marketing API (Graph API)
 *
 * RESTRIÇÃO CRÍTICA DE ARQUITETURA E SEGURANÇA:
 * - Operações estritamente de leitura (ads_read, read_insights).
 * - Nenhuma mutação (criação, edição ou deleção) é permitida.
 * - Suporta paginação completa via cursor, backoff exponencial com jitter e mapeamento idempotente.
 */
export declare class MetaAdsConnector implements AdsConnector {
    readonly platform: PlatformType;
    private readonly accessToken;
    private readonly apiVersion;
    private readonly fetchFn;
    private readonly maxRetries;
    private readonly initialBackoffMs;
    private readonly maxBackoffMs;
    constructor(options: MetaConnectorOptions);
    /**
     * Realiza requisição HTTP à Graph API com tratamento de erros,
     * backoff exponencial com jitter e controle de taxa.
     */
    private requestGraphApi;
    /**
     * Lista as contas de anúncios acessíveis pelo usuário autenticado
     */
    listAccounts(): Promise<ExternalAccount[]>;
    /**
     * Sincroniza a estrutura de campanhas da conta com paginação
     */
    syncCampaigns(accountId: string, clientId: string): Promise<SyncResult<Campaign>>;
    /**
     * Busca métricas normalizadas de campanhas via Meta Insights API
     */
    fetchMetrics(accountId: string, clientId: string, dateRange: {
        start: string;
        end: string;
    }): Promise<SyncResult<MetricFact>>;
    /**
     * REQUISITO OBRIGATÓRIO DE SEGURANÇA E GOVERNANÇA:
     * Validação rejeita qualquer tentativa de execução remota de alteração.
     */
    validateAction(action: ProposedActionPayload): Promise<{
        canExecute: boolean;
        reason?: string;
    }>;
    /**
     * REQUISITO OBRIGATÓRIO DE SEGURANÇA E GOVERNANÇA:
     * Bloqueio irreversível contra mutações remotas.
     */
    executeAction(action: ProposedActionPayload, idempotencyKey: string): Promise<ActionExecutionResult>;
}
//# sourceMappingURL=connector.d.ts.map