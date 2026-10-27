import { ActionProposal, Approval, Client, ExecutionLog } from "@admetrics/domain";
import { AdsConnector } from "@admetrics/integrations";
export interface ExecutionOrchestrationResult {
    success: boolean;
    proposal: ActionProposal;
    executionLog?: ExecutionLog;
    error?: string;
}
/**
 * Máquina de Estados e Orquestrador de Execução Autorizada
 * Tríade Fundamental: Proposta Versionada → Aprovação Explícita → Validação de Estado Remoto
 */
export declare class ActionExecutionOrchestrator {
    /**
     * Processa uma decisão humana (Aprovação ou Rejeição)
     */
    applyApprovalDecision(proposal: ActionProposal, userId: string, decision: "approved" | "rejected", note?: string): {
        proposal: ActionProposal;
        approval: Approval;
    };
    /**
     * Executa a ação aprovada após todas as validações de governança
     */
    executeApprovedProposal(proposal: ActionProposal, approval: Approval, client: Client, connector: AdsConnector): Promise<ExecutionOrchestrationResult>;
}
//# sourceMappingURL=machine.d.ts.map