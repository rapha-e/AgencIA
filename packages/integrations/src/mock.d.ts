import { Campaign, MetricFact, PlatformType, ProposedActionPayload } from "@admetrics/domain";
import { ActionExecutionResult, AdsConnector, ExternalAccount, SyncResult } from "./contracts.js";
export declare class MockAdsConnector implements AdsConnector {
    readonly platform: PlatformType;
    private readonly executedKeys;
    private campaignsState;
    constructor(platform?: PlatformType);
    listAccounts(): Promise<ExternalAccount[]>;
    syncCampaigns(accountId: string, clientId: string): Promise<SyncResult<Campaign>>;
    fetchMetrics(accountId: string, clientId: string, dateRange: {
        start: string;
        end: string;
    }): Promise<SyncResult<MetricFact>>;
    validateAction(action: ProposedActionPayload): Promise<{
        canExecute: boolean;
        reason?: string;
    }>;
    executeAction(action: ProposedActionPayload, idempotencyKey: string): Promise<ActionExecutionResult>;
}
//# sourceMappingURL=mock.d.ts.map