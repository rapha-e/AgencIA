import { Campaign, MetricFact, PlatformType, ProposedActionPayload } from "@admetrics/domain";
import { ActionExecutionResult, AdsConnector, ExternalAccount, SyncResult } from "../contracts.js";
export interface GoogleAdsConnectorOptions {
    accessToken: string;
    developerToken?: string;
    loginCustomerId?: string;
    apiVersion?: string;
    fetchFn?: typeof fetch;
    maxRetries?: number;
    initialBackoffMs?: number;
}
export declare class GoogleAdsApiError extends Error {
    readonly statusCode: number;
    readonly statusText: string;
    constructor(message: string, statusCode: number, statusText?: string);
    isAuthError(): boolean;
    isRateLimit(): boolean;
}
/**
 * Conector Oficial para Google Ads REST API (GAQL searchStream)
 *
 * RESTRIÇÃO CRÍTICA DE ARQUITETURA E SEGURANÇA:
 * - Consultas estritamente de leitura via Google Ads Query Language (GAQL).
 * - Conversão determinística de micros (1 unidade monetária = 1.000.000 micros).
 * - Bloqueio estrito contra mutações diretas não autorizadas.
 */
export declare class GoogleAdsConnector implements AdsConnector {
    readonly platform: PlatformType;
    private readonly accessToken;
    private readonly developerToken;
    private readonly loginCustomerId?;
    private readonly apiVersion;
    private readonly fetchFn;
    private readonly maxRetries;
    private readonly initialBackoffMs;
    constructor(options: GoogleAdsConnectorOptions);
    /**
     * Normaliza o Customer ID do Google Ads (remove hífens: 123-456-7890 -> 1234567890)
     */
    static normalizeCustomerId(accountId: string): string;
    /**
     * Converte valores em micros do Google Ads para unidade monetária (ex: 150000000 -> 150.00)
     */
    static microsToCurrency(micros: string | number | null | undefined): number;
    private getHeaders;
    /**
     * Executa consulta GAQL via endpoint searchStream da Google Ads API
     */
    private executeGaqlStream;
    /**
     * Lista todas as contas Google Ads acessíveis pelo token OAuth
     */
    listAccounts(): Promise<ExternalAccount[]>;
    /**
     * Sincroniza a estrutura de campanhas via GAQL
     */
    syncCampaigns(accountId: string, clientId: string): Promise<SyncResult<Campaign>>;
    /**
     * Busca métricas diárias normalizadas via GAQL convertendo cost_micros em unidade monetária
     */
    fetchMetrics(accountId: string, clientId: string, dateRange: {
        start: string;
        end: string;
    }): Promise<SyncResult<MetricFact>>;
    /**
     * Governança de Segurança: Bloqueia mutações diretas em modo somente leitura
     */
    validateAction(action: ProposedActionPayload): Promise<{
        canExecute: boolean;
        reason?: string;
    }>;
    executeAction(action: ProposedActionPayload, idempotencyKey: string): Promise<ActionExecutionResult>;
}
//# sourceMappingURL=connector.d.ts.map