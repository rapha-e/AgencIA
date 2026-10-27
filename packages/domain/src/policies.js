/**
 * Validação de Políticas de Segurança e Limites Financeiros (Hard Caps)
 * Regra: Nenhuma ação com dinheiro real é executada se violar limites de governança.
 */
export function validateProposalPolicy(proposal, client, currentRemoteBudget) {
    const errors = [];
    const warnings = [];
    const payload = proposal.payload;
    // 1. Verificação de Expiração
    if (proposal.expiresAt && new Date(proposal.expiresAt).getTime() < Date.now()) {
        errors.push(`A proposta de ação expirou em ${proposal.expiresAt}.`);
    }
    // 2. Verificação de Ações de Ajuste de Orçamento
    if (payload.actionType === "ADJUST_DAILY_BUDGET") {
        const proposedVal = Number(payload.proposedValue);
        const currentVal = currentRemoteBudget !== undefined ? currentRemoteBudget : Number(payload.currentValue);
        if (isNaN(proposedVal) || proposedVal <= 0) {
            errors.push("O orçamento diário proposto deve ser um valor numérico positivo.");
        }
        // Validação contra o Hard Cap configurado no cliente
        if (client.maxDailyBudgetLimit && proposedVal > client.maxDailyBudgetLimit) {
            errors.push(`O orçamento proposto de R$ ${proposedVal.toFixed(2)} excede o Hard Cap máximo permitido para este cliente (R$ ${client.maxDailyBudgetLimit.toFixed(2)}).`);
        }
        // Validação de percentual máximo de aumento em uma única ação
        if (currentVal > 0 && proposedVal > currentVal) {
            const increasePercent = ((proposedVal - currentVal) / currentVal) * 100;
            const maxAllowedPercent = client.maxSingleBudgetIncreasePercent || 20;
            if (increasePercent > maxAllowedPercent) {
                errors.push(`O aumento proposto de ${increasePercent.toFixed(1)}% ultrapassa o limite máximo configurado de ${maxAllowedPercent}% por intervenção.`);
            }
            else if (increasePercent > 15) {
                warnings.push(`Aumento considerável de orçamento (+${increasePercent.toFixed(1)}%). Requer validação redobrada.`);
            }
        }
    }
    // 3. Verificação de Pausa de Campanhas de Alto Impacto
    if (payload.actionType === "PAUSE_CAMPAIGN" && proposal.riskLevel === "high") {
        warnings.push("Pausar esta campanha de alto volume pode impactar o aprendizado do algoritmo do canal de anúncios.");
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
//# sourceMappingURL=policies.js.map