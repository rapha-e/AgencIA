import test from "node:test";
import assert from "node:assert/strict";
import { validateTenantAccess, canApproveActionProposal, assertCanApproveActionProposal, canManageMembers, assertCanAssignRole, TenantIsolationViolationError, InsufficientRoleError } from "./authorization.js";
// Cenário Base: 2 Usuários em 2 Organizações Distintas
const userOrgA = [
    {
        userId: "user-alpha-id",
        organizationId: "org-alpha-uuid",
        role: "owner",
        organizationName: "Agência Alpha"
    }
];
const userOrgBViewer = [
    {
        userId: "user-beta-viewer-id",
        organizationId: "org-beta-uuid",
        role: "viewer",
        organizationName: "Empresa Beta"
    }
];
const userOrgBAdmin = [
    {
        userId: "user-beta-admin-id",
        organizationId: "org-beta-uuid",
        role: "admin",
        organizationName: "Empresa Beta"
    }
];
test("ISOLAMENTO MULTI-TENANT: Usuário da Org Alpha é bloqueado ao tentar acessar Org Beta", () => {
    assert.throws(() => {
        // Tentativa não autorizada de ler dados ou executar operações na Org Beta
        validateTenantAccess(userOrgA, "org-beta-uuid");
    }, (err) => {
        assert.ok(err instanceof TenantIsolationViolationError);
        assert.match(err.message, /Acesso negado: o usuário não possui vínculo com a organização/);
        return true;
    });
});
test("ISOLAMENTO MULTI-TENANT: Tentativa de forjar organization_id arbitrário é bloqueada", () => {
    const forgedOrgId = "00000000-0000-0000-0000-spoofed-org";
    assert.throws(() => {
        validateTenantAccess(userOrgA, forgedOrgId);
    }, TenantIsolationViolationError);
});
test("ISOLAMENTO MULTI-TENANT: Acesso legítimo à própria organização é autorizado", () => {
    const result = validateTenantAccess(userOrgA, "org-alpha-uuid");
    assert.equal(result.organizationId, "org-alpha-uuid");
    assert.equal(result.role, "owner");
});
test("RBAC & GOVERNANÇA: 'viewer' e 'analyst' NÃO possuem permissão para aprovar alterações financeiras", () => {
    assert.equal(canApproveActionProposal("viewer"), false);
    assert.equal(canApproveActionProposal("analyst"), false);
    assert.throws(() => {
        assertCanApproveActionProposal("viewer");
    }, (err) => {
        assert.ok(err instanceof InsufficientRoleError);
        assert.match(err.message, /não possui autorização financeira/);
        return true;
    });
    assert.throws(() => {
        assertCanApproveActionProposal("analyst");
    }, InsufficientRoleError);
});
test("RBAC & GOVERNANÇA: 'owner', 'admin' e 'manager' possuem autorização para aprovar ações", () => {
    assert.equal(canApproveActionProposal("owner"), true);
    assert.equal(canApproveActionProposal("admin"), true);
    assert.equal(canApproveActionProposal("manager"), true);
    // Não deve disparar exceção
    assert.doesNotThrow(() => assertCanApproveActionProposal("owner"));
    assert.doesNotThrow(() => assertCanApproveActionProposal("admin"));
    assert.doesNotThrow(() => assertCanApproveActionProposal("manager"));
});
test("ANTI-ESCALONAMENTO DE PRIVILÉGIOS: Admin não pode promover ninguém a Owner", () => {
    assert.throws(() => {
        assertCanAssignRole("admin", "owner");
    }, (err) => {
        assert.ok(err instanceof InsufficientRoleError);
        assert.match(err.message, /Administradores não podem nomear ou transferir papel de owner/);
        return true;
    });
});
test("ANTI-ESCALONAMENTO DE PRIVILÉGIOS: Viewer ou Manager não pode gerenciar membros", () => {
    assert.equal(canManageMembers("viewer"), false);
    assert.equal(canManageMembers("manager"), false);
    assert.throws(() => {
        assertCanAssignRole("manager", "analyst");
    }, (err) => {
        assert.ok(err instanceof InsufficientRoleError);
        assert.match(err.message, /não tem permissão para gerenciar membros/);
        return true;
    });
});
test("ANTI-ESCALONAMENTO DE PRIVILÉGIOS: Owner pode gerenciar todos os papéis legitimamente", () => {
    assert.equal(canManageMembers("owner"), true);
    assert.doesNotThrow(() => assertCanAssignRole("owner", "admin"));
    assert.doesNotThrow(() => assertCanAssignRole("owner", "manager"));
    assert.doesNotThrow(() => assertCanAssignRole("owner", "viewer"));
});
//# sourceMappingURL=authorization.test.js.map