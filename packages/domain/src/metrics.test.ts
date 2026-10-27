import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCTR,
  calculateCPC,
  calculateCPM,
  calculateCPA,
  calculateROAS,
  calculateConversionRate,
  calculateMetricSummary
} from "./metrics.js";
import { validateProposalPolicy } from "./policies.js";
import { ActionProposal, Client } from "./types.js";

test("calculateCTR calculates Click-Through Rate accurately", () => {
  assert.equal(calculateCTR(150, 5000), 3.0);
  assert.equal(calculateCTR(0, 5000), 0);
  assert.equal(calculateCTR(100, 0), 0);
});

test("calculateCPC and CPM calculates costs correctly", () => {
  assert.equal(calculateCPC(500, 250), 2.0);
  assert.equal(calculateCPM(500, 50000), 10.0);
  assert.equal(calculateCPC(0, 100), 0);
  assert.equal(calculateCPC(500, 0), 0);
});

test("calculateROAS and CPA calculates financial return correctly", () => {
  assert.equal(calculateROAS(4000, 1000), 4.0);
  assert.equal(calculateCPA(1000, 20), 50.0);
  assert.equal(calculateROAS(0, 1000), 0);
  assert.equal(calculateROAS(1000, 0), 0);
});

test("calculateConversionRate handles zero conversions and zero traffic gracefully", () => {
  assert.equal(calculateConversionRate(15, 300), 5.0);
  assert.equal(calculateConversionRate(0, 300), 0);
  assert.equal(calculateConversionRate(15, 0), 0);
});

test("calculateMetricSummary consolidates all indicators in a single deterministic pass", () => {
  const summary = calculateMetricSummary({
    impressions: 10000,
    clicks: 500,
    spend: 1000,
    conversions: 50,
    revenue: 5000
  });

  assert.equal(summary.ctr, 5.0);
  assert.equal(summary.cpc, 2.0);
  assert.equal(summary.cpm, 100.0);
  assert.equal(summary.conversionRate, 10.0);
  assert.equal(summary.cpa, 20.0);
  assert.equal(summary.roas, 5.0);
});

test("validateProposalPolicy blocks proposals exceeding Client Hard Cap", () => {
  const client: Client = {
    id: "00000000-0000-0000-0000-000000000001",
    organizationId: "00000000-0000-0000-0000-000000000002",
    name: "Empresa Piloto",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    maxDailyBudgetLimit: 300, // Hard Cap R$ 300 / dia
    maxSingleBudgetIncreasePercent: 20,
    createdAt: new Date().toISOString()
  };

  const proposal: ActionProposal = {
    id: "00000000-0000-0000-0000-000000000003",
    organizationId: client.organizationId,
    clientId: client.id,
    proposedBy: "ai",
    actionType: "ADJUST_DAILY_BUDGET",
    payload: {
      actionType: "ADJUST_DAILY_BUDGET",
      platform: "meta",
      externalAccountId: "act_12345",
      resourceType: "CAMPAIGN",
      resourceId: "camp_999",
      currentValue: 200,
      proposedValue: 350, // Ultrapassa R$ 300
      unit: "BRL",
      reason: "Otimização de escala"
    },
    evidence: { cpa: 15, targetCpa: 25 },
    riskLevel: "medium",
    status: "pending",
    version: 1,
    expiresAt: null,
    createdAt: new Date().toISOString()
  };

  const validation = validateProposalPolicy(proposal, client, 200);
  assert.equal(validation.isValid, false);
  assert.match(validation.errors[0], /excede o Hard Cap/);
});
