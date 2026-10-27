import { Campaign, MetricFact, PlatformType, ProposedActionPayload } from "@admetrics/domain";

export interface ExternalAccount {
  id: string;
  name: string;
  platform: PlatformType;
  currency: string;
  timezone: string;
}

export interface SyncResult<T> {
  success: boolean;
  recordsCount: number;
  data: T[];
  syncedAt: string;
  error?: string;
}

export interface ActionExecutionResult {
  success: boolean;
  idempotencyKey: string;
  remoteOperationId?: string;
  executedValue?: unknown;
  error?: string;
}

/**
 * Contrato Oficial para Conectores de Plataformas de Anúncios (AdsConnector)
 */
export interface AdsConnector {
  readonly platform: PlatformType;

  /**
   * Lista as contas de anúncios acessíveis pelo token/conexão
   */
  listAccounts(): Promise<ExternalAccount[]>;

  /**
   * Sincroniza a estrutura de campanhas da conta
   */
  syncCampaigns(accountId: string, clientId: string): Promise<SyncResult<Campaign>>;

  /**
   * Busca métricas normalizadas no período especificado
   */
  fetchMetrics(
    accountId: string,
    clientId: string,
    dateRange: { start: string; end: string }
  ): Promise<SyncResult<MetricFact>>;

  /**
   * Valida se a plataforma aceita a alteração pretendida antes da execução
   */
  validateAction(
    action: ProposedActionPayload
  ): Promise<{ canExecute: boolean; reason?: string }>;

  /**
   * Executa a alteração aprovada com idempotência
   */
  executeAction(
    action: ProposedActionPayload,
    idempotencyKey: string
  ): Promise<ActionExecutionResult>;
}
