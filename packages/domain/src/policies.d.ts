import { ActionProposal, Client } from "./types.js";
export interface PolicyValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Validação de Políticas de Segurança e Limites Financeiros (Hard Caps)
 * Regra: Nenhuma ação com dinheiro real é executada se violar limites de governança.
 */
export declare function validateProposalPolicy(proposal: ActionProposal, client: Client, currentRemoteBudget?: number): PolicyValidationResult;
//# sourceMappingURL=policies.d.ts.map