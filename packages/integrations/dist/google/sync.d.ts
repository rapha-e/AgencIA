export interface SyncGoogleOptions {
    supabaseUrl?: string;
    serviceRoleKey?: string;
    connectionId?: string;
    daysToSync?: number;
}
/**
 * Rotina Assíncrona de Sincronização do Google Ads com Persistência,
 * Renovação Automática de Token (Refresh Token) e Idempotência.
 */
export declare function syncGoogleConnections(options?: SyncGoogleOptions): Promise<{
    success: boolean;
    connectionsProcessed: number;
    totalRecordsProcessed: number;
    errors: string[];
}>;
//# sourceMappingURL=sync.d.ts.map