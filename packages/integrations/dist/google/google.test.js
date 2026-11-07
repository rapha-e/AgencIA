import test from "node:test";
import assert from "node:assert/strict";
import { GoogleAdsOAuthService } from "./oauth.js";
import { GoogleAdsConnector } from "./connector.js";
test("GOOGLE ADS OAUTH: Gera e verifica state assinado com HMAC-SHA256 contra CSRF", () => {
    const oauth = new GoogleAdsOAuthService({
        clientId: "google-client-id-123.apps.googleusercontent.com",
        clientSecret: "GOCSPX-secret-key-998877",
        redirectUri: "http://localhost:3000/api/integrations/google/callback"
    });
    const { stateString, nonce } = oauth.generateSignedState({
        userId: "u-001",
        organizationId: "org-001",
        clientId: "cli-001"
    });
    const verified = oauth.verifySignedState(stateString);
    assert.equal(verified.nonce, nonce);
    assert.equal(verified.userId, "u-001");
    assert.equal(verified.organizationId, "org-001");
    assert.equal(verified.clientId, "cli-001");
    // Deve rejeitar state adulterado
    assert.throws(() => {
        oauth.verifySignedState(`${stateString}tampered`);
    }, /Assinatura do state inválida/);
});
test("GOOGLE ADS CONNECTOR: Converte micros em unidade monetária e sincroniza campanhas e métricas via GAQL", async () => {
    assert.equal(GoogleAdsConnector.microsToCurrency("150000000"), 150.0);
    assert.equal(GoogleAdsConnector.microsToCurrency(48550000), 48.55);
    assert.equal(GoogleAdsConnector.normalizeCustomerId("customers/123-456-7890"), "1234567890");
    const mockFetch = async (url, init) => {
        if (url.includes("customers:listAccessibleCustomers")) {
            return new Response(JSON.stringify({ resourceNames: ["customers/1234567890"] }), { status: 200 });
        }
        const body = JSON.parse(init?.body || "{}");
        const query = body.query || "";
        if (query.includes("FROM customer")) {
            return new Response(JSON.stringify([
                {
                    results: [
                        {
                            customer: {
                                id: "1234567890",
                                descriptiveName: "TorxOS Google Search BR",
                                currencyCode: "BRL",
                                timeZone: "America/Sao_Paulo"
                            }
                        }
                    ]
                }
            ]), { status: 200 });
        }
        if (query.includes("campaign_budget.amount_micros")) {
            return new Response(JSON.stringify([
                {
                    results: [
                        {
                            campaign: {
                                id: "99887766",
                                name: "Search - Sistema Assistência Técnica",
                                status: "ENABLED",
                                advertisingChannelType: "SEARCH"
                            },
                            campaignBudget: {
                                amountMicros: "120000000" // R$ 120,00
                            }
                        }
                    ]
                }
            ]), { status: 200 });
        }
        if (query.includes("metrics.cost_micros")) {
            return new Response(JSON.stringify([
                {
                    results: [
                        {
                            campaign: { id: "99887766", name: "Search - Sistema Assistência Técnica" },
                            segments: { date: "2026-10-25" },
                            metrics: {
                                impressions: "3400",
                                clicks: "215",
                                costMicros: "95500000", // R$ 95,50
                                conversions: 6,
                                conversionsValue: 582.0
                            }
                        }
                    ]
                }
            ]), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
    };
    const connector = new GoogleAdsConnector({
        accessToken: "ya29.mock_access_token",
        developerToken: "dev_token_test",
        fetchFn: mockFetch
    });
    const accounts = await connector.listAccounts();
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].id, "1234567890");
    assert.equal(accounts[0].name, "TorxOS Google Search BR");
    const campaigns = await connector.syncCampaigns("123-456-7890", "c0000000-0000-0000-0000-000000000001");
    assert.equal(campaigns.recordsCount, 1);
    assert.equal(campaigns.data[0].dailyBudget, 120.0);
    assert.equal(campaigns.data[0].status, "ACTIVE");
    const metrics = await connector.fetchMetrics("123-456-7890", "c0000000-0000-0000-0000-000000000001", {
        start: "2026-10-20",
        end: "2026-10-26"
    });
    assert.equal(metrics.recordsCount, 1);
    assert.equal(metrics.data[0].spend, 95.5);
    assert.equal(metrics.data[0].conversions, 6);
    assert.equal(metrics.data[0].revenue, 582.0);
});
test("GOOGLE ADS CONNECTOR: Bloqueia mutações diretas em modo somente leitura", async () => {
    const connector = new GoogleAdsConnector({
        accessToken: "ya29.mock_token"
    });
    const validation = await connector.validateAction({
        actionType: "PAUSE_CAMPAIGN",
        platform: "google_ads",
        externalAccountId: "1234567890",
        resourceType: "CAMPAIGN",
        resourceId: "99887766",
        currentValue: "ACTIVE",
        proposedValue: "PAUSED",
        unit: "STATUS",
        reason: "Teste de bloqueio"
    });
    assert.equal(validation.canExecute, false);
    await assert.rejects(async () => {
        await connector.executeAction({
            actionType: "PAUSE_CAMPAIGN",
            platform: "google_ads",
            externalAccountId: "1234567890",
            resourceType: "CAMPAIGN",
            resourceId: "99887766",
            currentValue: "ACTIVE",
            proposedValue: "PAUSED",
            unit: "STATUS",
            reason: "Teste"
        }, "idemp_key_1");
    }, /VIOLAÇÃO DE SEGURANÇA/);
});
//# sourceMappingURL=google.test.js.map