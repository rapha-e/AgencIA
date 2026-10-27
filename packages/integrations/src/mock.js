export class MockAdsConnector {
    platform;
    executedKeys = new Set();
    // Armazenamento em memória de estado para simular alterações remotas reais
    campaignsState;
    constructor(platform = "meta") {
        this.platform = platform;
        this.campaignsState = new Map([
            [
                "camp_meta_topo",
                { status: "ACTIVE", dailyBudget: 150.0 }
            ],
            [
                "camp_meta_conversao",
                { status: "ACTIVE", dailyBudget: 280.0 }
            ],
            [
                "camp_meta_remarketing",
                { status: "ACTIVE", dailyBudget: 90.0 }
            ]
        ]);
    }
    async listAccounts() {
        return [
            {
                id: `act_${this.platform}_demo_01`,
                name: `Conta Principal - ${this.platform === "meta" ? "Meta Ads" : "Google Ads"}`,
                platform: this.platform,
                currency: "BRL",
                timezone: "America/Sao_Paulo"
            }
        ];
    }
    async syncCampaigns(accountId, clientId) {
        const campaigns = Array.from(this.campaignsState.entries()).map(([externalId, state], index) => ({
            id: `00000000-0000-0000-0001-00000000000${index + 1}`,
            connectionId: `conn_${this.platform}_mock`,
            clientId,
            platform: this.platform,
            externalCampaignId: externalId,
            name: externalId === "camp_meta_topo"
                ? "Topo de Funil - Vídeos & Alcance"
                : externalId === "camp_meta_conversao"
                    ? "Fundo de Funil - Leads Qualificados"
                    : "Remarketing - Visitantes 30D",
            status: state.status,
            dailyBudget: state.dailyBudget,
            lifetimeBudget: null,
            objective: externalId.includes("topo") ? "AWARENESS" : "LEAD_GENERATION",
            lastUpdatedRemote: new Date().toISOString()
        }));
        return {
            success: true,
            recordsCount: campaigns.length,
            data: campaigns,
            syncedAt: new Date().toISOString()
        };
    }
    async fetchMetrics(accountId, clientId, dateRange) {
        const metrics = [];
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        const campaignIds = Array.from(this.campaignsState.keys());
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split("T")[0];
            // Gerar métricas sintéticas com padrões realistas
            for (const campId of campaignIds) {
                let spend = 100;
                let impressions = 5000;
                let clicks = 150;
                let conversions = 8;
                let revenue = 800;
                // Injetar anomalias intencionais para alimentar o motor heurístico
                if (campId === "camp_meta_conversao") {
                    // CPA elevado: gastando bastante com poucas conversões nos últimos dias
                    spend = 280;
                    impressions = 7500;
                    clicks = 210;
                    conversions = 2; // CPA = R$ 140 (muito acima do ideal)
                    revenue = 250;
                }
                else if (campId === "camp_meta_remarketing") {
                    // Ótimo ROAS e CPA baixo
                    spend = 85;
                    impressions = 2200;
                    clicks = 95;
                    conversions = 12;
                    revenue = 1400; // ROAS > 16x
                }
                metrics.push({
                    id: `fact_${campId}_${dateStr}`,
                    clientId,
                    platform: this.platform,
                    externalAccountId: accountId,
                    campaignId: campId,
                    date: dateStr,
                    impressions,
                    clicks,
                    spend,
                    conversions,
                    revenue,
                    currency: "BRL",
                    attributionWindow: "7d_click_1d_view",
                    source: "mock_api"
                });
            }
        }
        return {
            success: true,
            recordsCount: metrics.length,
            data: metrics,
            syncedAt: new Date().toISOString()
        };
    }
    async validateAction(action) {
        const camp = this.campaignsState.get(action.resourceId);
        if (!camp) {
            return { canExecute: false, reason: `Campanha '${action.resourceId}' não encontrada no ambiente remoto.` };
        }
        return { canExecute: true };
    }
    async executeAction(action, idempotencyKey) {
        // 1. Verificação de idempotência estrita
        if (this.executedKeys.has(idempotencyKey)) {
            return {
                success: true,
                idempotencyKey,
                remoteOperationId: `mock_op_replay_${idempotencyKey}`,
                error: undefined
            };
        }
        const camp = this.campaignsState.get(action.resourceId);
        if (!camp) {
            return {
                success: false,
                idempotencyKey,
                error: `Campanha '${action.resourceId}' não existe no servidor de anúncios.`
            };
        }
        // 2. Aplicar alteração remota
        if (action.actionType === "PAUSE_CAMPAIGN") {
            camp.status = "PAUSED";
        }
        else if (action.actionType === "RESUME_CAMPAIGN") {
            camp.status = "ACTIVE";
        }
        else if (action.actionType === "ADJUST_DAILY_BUDGET") {
            camp.dailyBudget = Number(action.proposedValue);
        }
        this.executedKeys.add(idempotencyKey);
        return {
            success: true,
            idempotencyKey,
            remoteOperationId: `mock_op_${Date.now()}_${action.resourceId}`,
            executedValue: action.proposedValue
        };
    }
}
//# sourceMappingURL=mock.js.map