import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  ActionProposal,
  Client,
  MembershipRole,
  canApproveActionProposal
} from "@admetrics/domain";
import { ActionExecutionOrchestrator } from "@admetrics/execution";
import { MockAdsConnector } from "@admetrics/integrations";

export const dynamic = "force-dynamic";

/**
 * POST /api/proposals/[id]/decision
 * Registra decisão humana (Aprovação ou Rejeição) no Supabase respeitando RLS,
 * dispara o ActionExecutionOrchestrator e grava logs de execução e auditoria.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await context.params;
    const supabase = await createClient();

    // 1. Validar sessão autenticada
    const {
      data: { user },
      error: authErr
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Sessão não autenticada. Faça login para aprovar ou rejeitar propostas." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const decision = body.decision as "approved" | "rejected";
    const note = body.note as string | undefined;
    const organizationId = body.organizationId as string;
    const clientId = body.clientId as string;

    if (!decision || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json(
        { error: "Decisão inválida. Informe 'approved' ou 'rejected'." },
        { status: 400 }
      );
    }

    // 2. Buscar proposta no banco de dados (com isolamento RLS)
    const { data: propRow, error: propErr } = await supabase
      .from("action_proposals")
      .select("*")
      .eq("id", proposalId)
      .maybeSingle();

    if (propErr || !propRow) {
      return NextResponse.json(
        { error: "Proposta não encontrada no banco de dados ou sem permissão de acesso." },
        { status: 404 }
      );
    }

    const targetOrgId = propRow.organization_id || organizationId;
    const targetClientId = propRow.client_id || clientId;

    // 3. Validar papel RBAC do usuário na organização
    const { data: membership, error: memberErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", targetOrgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !membership) {
      return NextResponse.json(
        { error: "Acesso negado: Você não pertence à organização desta proposta." },
        { status: 403 }
      );
    }

    const actorRole = membership.role as MembershipRole;

    if (decision === "approved" && !canApproveActionProposal(actorRole)) {
      return NextResponse.json(
        {
          error: `Seu papel ('${actorRole}') não possui permissão para aprovar alterações orçamentárias. Apenas 'owner', 'admin' ou 'manager' podem autorizar execuções.`
        },
        { status: 403 }
      );
    }

    if (propRow.status !== "pending") {
      return NextResponse.json(
        { error: `A proposta já foi processada anteriormente (status atual: '${propRow.status}').` },
        { status: 409 }
      );
    }

    // 4. Buscar limites de segurança (Hard Caps) do cliente
    const { data: clientRow } = await supabase
      .from("clients")
      .select("*")
      .eq("id", targetClientId)
      .maybeSingle();

    const domainClient: Client = {
      id: targetClientId,
      organizationId: targetOrgId,
      name: clientRow?.name || "Cliente",
      timezone: clientRow?.timezone || "America/Sao_Paulo",
      currency: clientRow?.currency || "BRL",
      maxDailyBudgetLimit: Number(clientRow?.max_daily_budget_limit ?? 1500),
      maxSingleBudgetIncreasePercent: Number(clientRow?.max_single_budget_increase_percent ?? 20),
      createdAt: clientRow?.created_at || new Date().toISOString()
    };

    const payloadObj = propRow.payload || {};
    const domainProposal: ActionProposal = {
      id: propRow.id,
      organizationId: targetOrgId,
      clientId: targetClientId,
      proposedBy: propRow.proposed_by || "ai",
      actionType: propRow.action_type || "ADJUST_DAILY_BUDGET",
      payload: {
        actionType: payloadObj.actionType || propRow.action_type || "ADJUST_DAILY_BUDGET",
        platform: payloadObj.platform || "meta",
        externalAccountId: payloadObj.externalAccountId || "act_7788990011",
        resourceType: payloadObj.resourceType || "CAMPAIGN",
        resourceId: payloadObj.resourceId || "camp_meta_conversao",
        currentValue: payloadObj.currentValue ?? 280,
        proposedValue: payloadObj.proposedValue ?? 224,
        unit: payloadObj.unit || "BRL",
        reason: payloadObj.reason || "Otimização de orçamento"
      },
      evidence: propRow.evidence || {},
      riskLevel: propRow.risk_level || "high",
      status: propRow.status,
      version: propRow.version || 1,
      expiresAt: propRow.expires_at || null,
      createdAt: propRow.created_at || new Date().toISOString()
    };

    // 5. Aplicar decisão no ActionExecutionOrchestrator
    const orchestrator = new ActionExecutionOrchestrator();
    const { proposal: decidedProposal, approval } = orchestrator.applyApprovalDecision(
      domainProposal,
      user.id,
      decision,
      note || (decision === "approved" ? "Aprovado na Central de Governança Web" : "Rejeitado pelo gestor"),
      actorRole
    );

    // 6. IMPORTANTE: Inserir em public.approvals ANTES de atualizar status de action_proposals,
    // pois a política RLS "Gestores podem criar aprovacoes" exige que ap.status = 'pending' no ato do INSERT!
    const { error: approvalInsertErr } = await supabase.from("approvals").insert({
      id: approval.id,
      proposal_id: domainProposal.id,
      approved_version: approval.approvedVersion,
      approved_by: user.id,
      decision: approval.decision,
      note: approval.note,
      decided_at: approval.decidedAt
    });

    if (approvalInsertErr) {
      return NextResponse.json(
        { error: `Falha ao registrar aprovação em public.approvals: ${approvalInsertErr.message}` },
        { status: 500 }
      );
    }

    // 7. Se foi REJEITADO, atualizar status da proposta e registrar auditoria
    if (decision === "rejected") {
      const { error: rejectUpdateErr } = await supabase
        .from("action_proposals")
        .update({ status: "rejected" })
        .eq("id", domainProposal.id);

      if (rejectUpdateErr) {
        return NextResponse.json(
          { error: `Falha ao atualizar status da proposta: ${rejectUpdateErr.message}` },
          { status: 500 }
        );
      }

      await supabase.from("audit_logs").insert({
        organization_id: targetOrgId,
        actor_id: user.id,
        action: "PROPOSAL_REJECTED",
        target_type: "action_proposal",
        target_id: domainProposal.id,
        details: { version: domainProposal.version, role: actorRole }
      });

      return NextResponse.json({
        success: true,
        status: "rejected",
        proposalId: domainProposal.id,
        approvalId: approval.id
      });
    }

    // 8. Se foi APROVADO, executar via ActionExecutionOrchestrator com Idempotência e Hard Caps
    const connector = new MockAdsConnector(domainProposal.payload.platform);
    const executionResult = await orchestrator.executeApprovedProposal(
      decidedProposal,
      approval,
      domainClient,
      connector
    );

    const finalStatus = executionResult.proposal.status;

    const { error: finalUpdateErr } = await supabase
      .from("action_proposals")
      .update({ status: finalStatus })
      .eq("id", domainProposal.id);

    if (finalUpdateErr) {
      return NextResponse.json(
        { error: `Falha ao persistir status final da proposta: ${finalUpdateErr.message}` },
        { status: 500 }
      );
    }

    // 9. Persistir log imutável de execução em public.execution_logs via Service Role
    if (executionResult.executionLog) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceRoleKey) {
        const adminDb = createAdminClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        await adminDb.from("execution_logs").insert({
          id: executionResult.executionLog.id,
          proposal_id: domainProposal.id,
          idempotency_key: executionResult.executionLog.idempotencyKey,
          platform: executionResult.executionLog.platform,
          request_payload: executionResult.executionLog.requestPayload,
          response_payload: executionResult.executionLog.responsePayload,
          status: executionResult.executionLog.status,
          error_message: executionResult.executionLog.errorMessage,
          executed_at: executionResult.executionLog.executedAt
        });
      }
    }

    // 10. Registrar auditoria
    await supabase.from("audit_logs").insert({
      organization_id: targetOrgId,
      actor_id: user.id,
      action: "PROPOSAL_APPROVED_AND_EXECUTED",
      target_type: "action_proposal",
      target_id: domainProposal.id,
      details: {
        finalStatus,
        idempotencyKey: executionResult.executionLog?.idempotencyKey,
        remoteOperationId: executionResult.executionLog?.responsePayload?.remoteOperationId
      }
    });

    return NextResponse.json({
      success: executionResult.success,
      status: finalStatus,
      proposalId: domainProposal.id,
      approvalId: approval.id,
      idempotencyKey: executionResult.executionLog?.idempotencyKey,
      remoteOperationId: executionResult.executionLog?.responsePayload?.remoteOperationId,
      error: executionResult.error
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Erro ao processar decisão na proposta: ${err.message}` },
      { status: 500 }
    );
  }
}

