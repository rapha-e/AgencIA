import { validateProposalPolicy } from "@admetrics/domain";
/**
 * Máquina de Estados e Orquestrador de Execução Autorizada
 * Tríade Fundamental: Proposta Versionada → Aprovação Explícita → Validação de Estado Remoto
 */
export class ActionExecutionOrchestrator {
    /**
     * Processa uma decisão humana (Aprovação ou Rejeição)
     */
    applyApprovalDecision(proposal, userId, decision, note) {
        if (proposal.status !== "pending") {
            throw new Error(`Não é possível aprovar proposta com status atual '${proposal.status}'.`);
        }
        const approval = {
            id: crypto.randomUUID(),
            proposalId: proposal.id,
            approvedVersion: proposal.version,
            approvedByUserId: userId,
            decision,
            decidedAt: new Date().toISOString(),
            note
        };
        const updatedProposal = {
            ...proposal,
            status: decision === "approved" ? "approved" : "rejected"
        };
        return { proposal: updatedProposal, approval };
    }
    /**
     * Executa a ação aprovada após todas as validações de governança
     */
    async executeApprovedProposal(proposal, approval, client, connector) {
        // 1. Checagem de Estado da Proposta
        if (proposal.status !== "approved") {
            return {
                success: false,
                proposal,
                error: `Tentativa de executar proposta com status não autorizado: '${proposal.status}'.`
            };
        }
        // 2. Trava de Integridade de Versão
        if (approval.approvedVersion !== proposal.version) {
            return {
                success: false,
                proposal: { ...proposal, status: "pending" },
                error: `Incompatibilidade de versão: Aprovado para versão ${approval.approvedVersion}, mas proposta está na versão ${proposal.version}. Proposta retornou a pending.`
            };
        }
        // 3. Validação de Políticas e Hard Caps
        const policyResult = validateProposalPolicy(proposal, client);
        if (!policyResult.isValid) {
            return {
                success: false,
                proposal: { ...proposal, status: "cancelled" },
                error: `Violou políticas de segurança do cliente: ${policyResult.errors.join("; ")}`
            };
        }
        // 4. Validação Remota com a Plataforma
        const validation = await connector.validateAction(proposal.payload);
        if (!validation.canExecute) {
            return {
                success: false,
                proposal: { ...proposal, status: "failed" },
                error: `A plataforma externa rejeitou os pré-requisitos da ação: ${validation.reason}`
            };
        }
        // 5. Chave de Idempotência Criptográfica Determinística
        const idempotencyKey = `exec_${proposal.id}_v${proposal.version}`;
        // 6. Atualizar para executando
        proposal.status = "executing";
        try {
            const result = await connector.executeAction(proposal.payload, idempotencyKey);
            const log = {
                id: crypto.randomUUID(),
                proposalId: proposal.id,
                idempotencyKey,
                platform: proposal.payload.platform,
                requestPayload: proposal.payload,
                responsePayload: {
                    remoteOperationId: result.remoteOperationId,
                    executedValue: result.executedValue
                },
                status: result.success ? "SUCCESS" : "FAILURE",
                errorMessage: result.error || null,
                executedAt: new Date().toISOString()
            };
            if (!result.success) {
                return {
                    success: false,
                    proposal: { ...proposal, status: "failed" },
                    executionLog: log,
                    error: result.error
                };
            }
            return {
                success: true,
                proposal: { ...proposal, status: "succeeded" },
                executionLog: log
            };
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : "Erro desconhecido de execução externa";
            return {
                success: false,
                proposal: { ...proposal, status: "failed" },
                error: errMsg
            };
        }
    }
}
//# sourceMappingURL=machine.js.map