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
export class TenantIsolationViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantIsolationViolationError";
  }
}

/**
 * Erro de permissão insuficiente (RBAC)
 */
export class InsufficientRoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientRoleError";
  }
}

/**
 * Validação rigorosa no servidor de isolamento multi-tenant:
 * Impede que qualquer requisição acesse dados de uma organização à qual o usuário não pertence.
 */
export function validateTenantAccess(
  userMemberships: UserMembership[],
  requestedOrgId: string
): UserMembership {
  const membership = userMemberships.find((m) => m.organizationId === requestedOrgId);

  if (!membership) {
    throw new TenantIsolationViolationError(
      `Acesso negado: o usuário não possui vínculo com a organização solicitada (${requestedOrgId}).`
    );
  }

  return membership;
}

/**
 * Validação de permissão para aprovação de propostas de tráfego pago
 * Apenas gestores com autorização financeira (owner, admin, manager) podem aprovar.
 * Visualizadores (viewer) e analistas (analyst) podem apenas auditar/propor.
 */
export function canApproveActionProposal(role: MembershipRole): boolean {
  return ["owner", "admin", "manager"].includes(role);
}

/**
 * Assegura que o usuário possui permissão de aprovação ou dispara erro explicativo
 */
export function assertCanApproveActionProposal(role: MembershipRole): void {
  if (!canApproveActionProposal(role)) {
    throw new InsufficientRoleError(
      `Papel '${role}' não possui autorização financeira para aprovar ações em campanhas.`
    );
  }
}

/**
 * Validação de permissão para gerenciar membros e convites
 */
export function canManageMembers(role: MembershipRole): boolean {
  return ["owner", "admin"].includes(role);
}

/**
 * Impede escalonamento de privilégios:
 * Um admin ou manager não pode alterar o papel de um owner nem atribuir privilégios superiores ao seu próprio.
 */
export function assertCanAssignRole(actorRole: MembershipRole, targetRole: MembershipRole): void {
  if (actorRole === "owner") {
    return; // Owner pode gerenciar todos os papéis
  }

  if (actorRole === "admin") {
    if (targetRole === "owner") {
      throw new InsufficientRoleError("Administradores não podem nomear ou transferir papel de owner.");
    }
    return;
  }

  throw new InsufficientRoleError(`Papel '${actorRole}' não tem permissão para gerenciar membros.`);
}
