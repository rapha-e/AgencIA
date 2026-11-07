import test from "node:test";
import assert from "node:assert/strict";
import { ActionExecutionOrchestrator } from "./machine.js";
import { InsufficientRoleError } from "@admetrics/domain";
import { MockAdsConnector } from "@admetrics/integrations";
test("ORQUESTRADOR: Impede aprovação de ação por usuário com papel 'viewer'", () => {
    const orchestrator = new ActionExecutionOrchestrator();
    const proposal = {
        id: "prop-001",
        organizationId: "org-alpha-uuid",
        clientId: "client-alpha-uuid",
        proposedBy: "ai",
        actionType: "ADJUST_DAILY_BUDGET",
        payload: {
            actionType: "ADJUST_DAILY_BUDGET",
            platform: "meta",
            externalAccountId: "act_123",
            resourceType: "CAMPAIGN",
            resourceId: "camp_meta_conversao",
            currentValue: 200,
            proposedValue: 180,
            unit: "BRL",
            reason: "Otimização"
        },
        evidence: {},
        riskLevel: "low",
        status: "pending",
        version: 1,
        expiresAt: null,
        createdAt: new Date().toISOString()
    };
    // Tentativa do usuário com papel viewer de aprovar a proposta
    assert.throws(() => {
        orchestrator.applyApprovalDecision(proposal, "user-viewer-id", "approved", "Tentando aprovar sem permissão", "viewer");
    }, InsufficientRoleError);
});
test("ORQUESTRADOR: Permite aprovação legítima por usuário com papel 'owner'", async () => {
    const orchestrator = new ActionExecutionOrchestrator();
    const connector = new MockAdsConnector("meta");
    const client = {
        id: "client-alpha-uuid",
        organizationId: "org-alpha-uuid",
        name: "Alpha Corp",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
        maxDailyBudgetLimit: 500,
        maxSingleBudgetIncreasePercent: 20,
        createdAt: new Date().toISOString()
    };
    const proposal = {
        id: "prop-002",
        organizationId: "org-alpha-uuid",
        clientId: "client-alpha-uuid",
        proposedBy: "heuristic_rule",
        actionType: "ADJUST_DAILY_BUDGET",
        payload: {
            actionType: "ADJUST_DAILY_BUDGET",
            platform: "meta",
            externalAccountId: "act_meta_demo_01",
            resourceType: "CAMPAIGN",
            resourceId: "camp_meta_topo",
            currentValue: 150,
            proposedValue: 170, // +13.3% aumento, abaixo do limite de 20%
            unit: "BRL",
            reason: "Escala moderada"
        },
        evidence: {},
        riskLevel: "low",
        status: "pending",
        version: 1,
        expiresAt: null,
        createdAt: new Date().toISOString()
    };
    const { proposal: approvedProp, approval } = orchestrator.applyApprovalDecision(proposal, "user-owner-id", "approved", "Aprovado pelo gestor", "owner");
    assert.equal(approvedProp.status, "approved");
    assert.equal(approval.approvedVersion, 1);
    const result = await orchestrator.executeApprovedProposal(approvedProp, approval, client, connector);
    assert.equal(result.success, true);
    assert.equal(result.proposal.status, "succeeded");
    assert.ok(result.executionLog?.idempotencyKey.includes("prop-002_v1"));
});
//# sourceMappingURL=machine.test.js.map