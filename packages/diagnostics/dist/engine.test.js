import test from "node:test";
import assert from "node:assert/strict";
import { runHeuristicDiagnostics } from "./engine.js";
test("runHeuristicDiagnostics detects SPEND_WITHOUT_CONVERSIONS accurately", () => {
    const metrics = [
        {
            id: "1",
            clientId: "client-1",
            platform: "meta",
            externalAccountId: "act-1",
            campaignId: "camp-leaking",
            date: "2026-10-20",
            impressions: 12000,
            clicks: 400,
            spend: 450, // Gastou R$ 450
            conversions: 0, // Zero conversões
            revenue: 0,
            currency: "BRL",
            attributionWindow: "7d_click",
            source: "test"
        }
    ];
    const issues = runHeuristicDiagnostics(metrics, { minSpendForConversionAlert: 200 });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].ruleCode, "SPEND_WITHOUT_CONVERSIONS");
    assert.equal(issues[0].severity, "critical");
});
test("runHeuristicDiagnostics detects CPA_ABOVE_TARGET when CPA exceeds 35% of target", () => {
    const metrics = [
        {
            id: "2",
            clientId: "client-1",
            platform: "meta",
            externalAccountId: "act-1",
            campaignId: "camp-expensive",
            date: "2026-10-21",
            impressions: 8000,
            clicks: 200,
            spend: 500,
            conversions: 5, // CPA = R$ 100
            revenue: 600,
            currency: "BRL",
            attributionWindow: "7d_click",
            source: "test"
        }
    ];
    // Target CPA é R$ 50 -> CPA observado é R$ 100 (+100% acima)
    const issues = runHeuristicDiagnostics(metrics, { targetCpa: 50, targetRoas: 1.0 });
    const cpaIssue = issues.find((i) => i.ruleCode === "CPA_ABOVE_TARGET");
    assert.ok(cpaIssue, "Deveria encontrar a regra CPA_ABOVE_TARGET");
    assert.equal(cpaIssue?.evidence.observedValue, 100);
    assert.equal(cpaIssue?.severity, "high");
});
//# sourceMappingURL=engine.test.js.map