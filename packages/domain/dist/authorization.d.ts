import { MembershipRole } from "./types.js";
export interface UserMembership {
    organizationId: string;
    userId: string;
    role: MembershipRole;
    organizationName?: string;
    organizationType?: "smb" | "agency";
}
/**
 * Erro específico de violação de isolamento multi-tenant
 */
export declare class TenantIsolationViolationError extends Error {
    constructor(message: string);
}
/**
 * Erro de permissão insuficiente (RBAC)
 */
export declare class InsufficientRoleError extends Error {
    constructor(message: string);
}
/**
 * Validação rigorosa no servidor de isolamento multi-tenant:
 * Impede que qualquer requisição acesse dados de uma organização à qual o usuário não pertence.
 */
export declare function validateTenantAccess(userMemberships: UserMembership[], requestedOrgId: string): UserMembership;
/**
 * Validação de permissão para aprovação de propostas de tráfego pago
 * Apenas gestores com autorização financeira (owner, admin, manager) podem aprovar.
 * Visualizadores (viewer) e analistas (analyst) podem apenas auditar/propor.
 */
export declare function canApproveActionProposal(role: MembershipRole): boolean;
/**
 * Assegura que o usuário possui permissão de aprovação ou dispara erro explicativo
 */
export declare function assertCanApproveActionProposal(role: MembershipRole): void;
/**
 * Validação de permissão para gerenciar membros e convites
 */
export declare function canManageMembers(role: MembershipRole): boolean;
/**
 * Impede escalonamento de privilégios:
 * Um admin ou manager não pode alterar o papel de um owner nem atribuir privilégios superiores ao seu próprio.
 */
export declare function assertCanAssignRole(actorRole: MembershipRole, targetRole: MembershipRole): void;
//# sourceMappingURL=authorization.d.ts.map