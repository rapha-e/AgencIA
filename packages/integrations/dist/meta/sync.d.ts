export interface SyncMetaOptions {
    supabaseUrl?: string;
    serviceRoleKey?: string;
    connectionId?: string;
    daysToSync?: number;
}
/**
 * Rotina Assíncrona de Sincronização do Meta Ads com Persistência e Idempotência
 */
export declare function syncMetaConnections(options?: SyncMetaOptions): Promise<{
    success: boolean;
    connectionsProcessed: number;
    totalRecordsProcessed: number;
    errors: string[];
}>;
//# sourceMappingURL=sync.d.ts.map