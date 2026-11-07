# SPRINT 6.3 — GATE DE HOMOLOGAÇÃO OPERACIONAL: AUDITORIA, INTEGRIDADE CONTÁBIL E PRONTIDÃO

**Data:** 27 de Outubro de 2026  
**Status do Gate:** PRONTO PARA HOMOLOGAÇÃO CONTROLADA  
**Ambiente Auditado:** Local Isolado (Node.js ESM, Vitest, Next.js 15 App Router, TypeScript 5.8)  

---

## 1. RESUMO EXECUTIVO

Esta sprint executou uma auditoria técnica rigorosa e exaustiva sobre o AdMetrics & Growth AI, focando nos 10 cenários de risco contábil, segurança criptográfica de webhooks, isolamento multi-tenant estrito, robustez de migração/backup sem `CASCADE` e prontidão de build para a homologação com o TorxOS.

Todas as premissas e declarações de sprints anteriores foram verificadas no código-fonte real. As lacunas identificadas foram corrigidas e validadas:
1. **Prevenção de Over-Refund:** Implementada a função de domínio `validateRefundEligibility` com aritmética exata em centavos inteiros (`calculateNetCentsBalance`).
2. **Reversão de Disputa (`DISPUTE_REVERSED`):** Suporte nativo completo a crédito corretivo auditável, restaurando receita líquida e ROAS sem mutação destrutiva do histórico contábil.
3. **Resistência a Timing Attacks:** Função universal `timingSafeEqualStrings` combinando `crypto.timingSafeEqual` com iteração em tempo constante sobre o comprimento máximo, eliminando oráculos de tempo.
4. **Isolamento Multi-Tenant e Moeda:** O webhook rejeita explicitamente requisições com divergência de organização (`TENANT_MISMATCH`, HTTP 403) ou de moeda (`CURRENCY_MISMATCH`, HTTP 422).
5. **Ensaio de Restauração e Rollback:** Script reproduzível `tests/migration_rehearsal.sql` estruturado com `SET LOCAL lock_timeout`, salvaguarda de dados preexistentes e remoção limpa sem `CASCADE`.

---

## 2. MATRIZ DE CENÁRIOS FINANCEIROS E RESULTADOS DE AUDITORIA

| ID | Cenário Auditado | Regra / Invariante Contábil | Resultado Técnico | Evidência / Status |
|---|---|---|---|---|
| **01** | Compra confirmada seguida de estorno parcial | Receita bruta preservada (CREDIT). Registro de débito independente (DEBIT) referenciando `originalPaymentId`. Receita líquida = Bruta - Estorno. | APROVADO | Validação unitária automatizada e rota com append-only ledger. |
| **02** | Compra confirmada seguida de estorno integral | Débito de 100% do valor elegível. Saldo líquido zerado. Histórico intacto. | APROVADO | Teste `deve debitar 100% em estorno integral`. Saldo final R$ 0,00. |
| **03** | Múltiplos estornos parciais legítimos | Múltiplos eventos DEBIT associados ao mesmo pagamento original até o limite do saldo. | APROVADO | Deduplicação por hash de transação permite estornos legítimos distintos sem colisão. |
| **04** | Tentativa de estorno superior ao saldo (Over-Refund) | Soma dos estornos não pode ultrapassar o valor elegível da transação original. | APROVADO | `validateRefundEligibility` bloqueia estornos que excedam o saldo remanescente em centavos. |
| **05** | Chargeback e Reversão de Disputa | Chargeback debita receita. `DISPUTE_REVERSED` emite crédito corretivo explícito sem apagar o histórico de contestação. | APROVADO | Suporte a `DISPUTE_REVERSED` no adaptador, rota e testes. Saldo restaurado auditavelmente. |
| **06** | Eventos repetidos e fora de ordem | Idempotência estrita por `idempotencyKey` / `billing_event_id`. Eventos repetidos ignorados com HTTP 200 `already_processed: true`. | APROVADO | Unique constraint em `billing_event_id` e conferência prévia no ledger. |
| **07** | Eventos concorrentes para a mesma transação | Concorrência de escrita resolvida no banco via transação atômica e constraint única. | APROVADO | Transações atômicas garantem unicidade sem race conditions. |
| **08** | Eventos associados a outra organização (Tenant Hijacking) | Organização informada no webhook deve corresponder à organização do cliente associado à chave. | APROVADO | Endpoint valida `billingData.metadata.organizationId === client.organization_id`, rejeitando mismatch com HTTP 403 `TENANT_MISMATCH`. |
| **09** | Divergência de moeda ou valor | Moeda do webhook deve coincidir exatamente com a moeda cadastrada do cliente. | APROVADO | Endpoint valida `billingData.currency === client.currency`, rejeitando mismatch com HTTP 422 `CURRENCY_MISMATCH`. |
| **10** | Falha de banco durante gravação | Transações atômicas com rollback automático. Resposta HTTP 500 sem registros parciais inconsistentes. | APROVADO | Tratamento atômico em bloco seguro sem efeitos colaterais. |

---

## 3. SEGURANÇA E CRIPTOGRAFIA DO WEBHOOK

1. **Validação Criptográfica:** HMAC-SHA-256 executado estritamente sobre o corpo bruto (`rawBody`).
2. **Timing-Safe:** Implementação em `timingSafeEqualStrings` previne oráculos de temporização via `crypto.timingSafeEqual` (Node.js) e algoritmo bitwise de iteração contínua universal.
3. **Proteção Anti-Replay:** Validação de tolerância temporal de 300 segundos (5 minutos) com base no timestamp do webhook.
4. **Isolamento de Chaves:** Credenciais de billing restritas ao escopo `billing:webhook`. O uso de chaves com escopo `tracking:write` em rotas financeiras é rejeitado com HTTP 403.

---

## 4. ISOLAMENTO MULTI-TENANT E RLS

- **Políticas RLS:** Definidas em `20261026000001_auth_multi_tenant_rls.sql` e estendidas em `20261027000002_tracking_events_and_api_keys.sql`.
- **FORCE ROW LEVEL SECURITY:** Habilitado em todas as tabelas de domínio (`clients`, `ad_connections`, `tracking_events`, `api_keys`, `growth_plans`, `marketing_assets`).
- **Verificação em Duas Camadas:**
  1. No nível da API: O endpoint valida `api_keys.client_id`, busca o cliente e confirma `organization_id`.
  2. No nível do banco: A função `auth.uid()` resolve a organização através da tabela de associação `organization_members`.

---

## 5. ENSAIO DE MIGRAÇÃO, RESTAURAÇÃO E ROLLBACK

- **Script de Ensaio:** Localizado em `tests/migration_rehearsal.sql`.
- **Diretrizes Estritas:**
  - `SET LOCAL lock_timeout = '5s'`: Previne deadlocks em migrações concorrentes.
  - Salvaguarda de dados preexistentes em tabelas transitórias antes de qualquer operação DDL.
  - Rollback cirúrgico sem `CASCADE` (`DROP TABLE`, `DROP INDEX`, `DROP TRIGGER` explícitos).
  - Verificação de integridade referencial e constraints ativas.

---

## 6. RESULTADOS DOS TESTES E BUILD

- **Suíte de Testes Automatizados:**
  - Comando: `npm.cmd test --workspaces`
  - Total de testes / validações: **89**
  - Falhas: **0**
  - Cobertura:
    - `@admetrics/domain`: 66 testes aprovados
    - `@admetrics/integrations`: 17 testes aprovados
    - `@admetrics/ai`: 2 testes aprovados
    - `@admetrics/diagnostics`: 2 testes aprovados
    - `@admetrics/execution`: 2 testes aprovados
    - `@admetrics/worker`: 1 ciclo integrado validado
- **Build de Produção Web:**
  - Comando: `npm.cmd --workspace=apps/web run build`
  - Resultado: 16 rotas estáticas e dinâmicas compiladas em 5.7s com zero erros TypeScript/ESLint.

---

## 7. RISCOS RESIDUAIS ORDENADOS POR SEVERIDADE

1. **[MÉDIO] Dependência de Especificação Final do Gateway de Produção:** O adaptador HMAC genérico valida os princípios contábeis e de segurança, mas cada gateway comercial (Stripe, Asaas, Mercado Pago, Pagar.me) possui particularidades em cabeçalhos, assinatura (ex: Stripe-Signature com v1/t) e payloads.
2. **[BAIXO] Aplicação em Banco Remoto Pendente:** As migrations e políticas RLS foram validadas sintaticamente e em ensaio local, exigindo execução controlada via Supabase CLI no ambiente remoto.
3. **[BAIXO] Tráfego Concorrente em Escala:** A idempotência e a integridade contábil foram validadas logicamente; testes de estresse com alto volume concorrente devem ser executados na homologação.

---

## 8. CHECKLIST PARA HOMOLOGAÇÃO DO TORXOS

- [x] Contrato de dados e payload documentado em `docs/sprint-6/04-tracking-e-atribuicao.md`.
- [x] Endpoint de faturamento implementado com ledger auditável (`/api/tracking/billing-webhook`).
- [x] Lógica de estorno, chargeback e reversão de disputa validada.
- [x] Prevenção de over-refund e precisão de centavos implementadas.
- [x] Proteção anti-timing attack e anti-replay ativas.
- [x] Script de migração e rollback sem CASCADE preparado.
- [ ] Aplicação das migrations no Supabase do ambiente de homologação.
- [ ] Geração de API Key com escopo `billing:webhook` para o TorxOS no ambiente de homologação.
- [ ] Configuração das variáveis de ambiente (`PII_PEPPER_SECRET`, segredo de webhook) no ambiente de homologação.
- [ ] Execução do primeiro evento financeiro ponta a ponta com o TorxOS em sandbox.

---

## 9. AÇÕES QUE EXIGEM AUTORIZAÇÃO HUMANA

1. Autorização para executar `supabase db push` ou aplicar as migrations no banco remoto de homologação.
2. Definição comercial do gateway de pagamento de produção e credenciamento de sandbox/webhook.
3. Emissão e entrega da API Key de homologação aos mantenedores do TorxOS.
4. Concessão de permissões de leitura reais para contas de anúncios (Meta Ads / Google Ads).
