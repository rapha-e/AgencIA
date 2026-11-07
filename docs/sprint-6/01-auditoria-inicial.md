# 01 — Auditoria Inicial e Inventário Técnico (Sprint 6)

**Data da Auditoria:** 27 de Outubro de 2026  
**Ambiente de Execução:** Local / Homologação Controlada  
**Status do Banco Remoto:** Somente Leitura (nenhuma migração executada remotamente)

---

## 1. Estrutura do Monorepo e Workspaces

O repositório é configurado como monorepo gerenciado por npm workspaces:
- `apps/web`: Next.js 15 (App Router, React 19, Tailwind CSS, TypeScript).
- `apps/worker`: Worker Node.js / TypeScript para ciclo de execução, sincronização assíncrona e orquestração.
- `packages/domain`: Modelos de domínio, validação Zod, regras de negócio determinísticas (ROAS, CAC, LTV), segurança e contratos de tracking/billing.
- `packages/integrations`: Conectores Meta Ads (Marketing API v26.0 / Graph API v22.0) e Google Ads com criptografia AES-256-GCM e isolamento multi-tenant.
- `packages/diagnostics`: Diagnósticos heurísticos para campanhas de anúncios (Spend Without Conversions, High CPA).
- `packages/ai`: Geração assistida de criativos de aquisição (roteiros de Reels, copies para feed, palavras-chave).
- `packages/execution`: Governança operacional, verificação de Hard Caps orçamentários e aprovações humanas.

---

## 2. Scripts Disponíveis e Comandos Inspecionados

No arquivo raiz `package.json`:
- `npm run build`: Executa compilação TypeScript em todos os pacotes e build de produção do Next.js.
- `npm test`: Executa suíte de testes em todos os workspaces com `node --test`.
- `npm run dev`: Executa servidor de desenvolvimento Next.js em `apps/web`.

---

## 3. Matriz de Auditoria do Estado Atual

| Módulo | Estado Encontrado | Evidência | Risco | Ação Recomendada |
|---|---|---|---|---|
| **Autenticação & Multi-tenancy** | Implementado & Auditado | `packages/domain/src/authorization.ts`, `authorization.test.ts` (8 testes aprovados) | Baixo | Manter isolamento estrito com RLS mandatória e vínculo de usuário por `user_has_org_access`. |
| **Tracking de Marketing** | Implementado & Auditado | `apps/web/src/app/api/tracking/events/route.ts`, `packages/domain/src/tracking.ts` | Baixo | Manter segregação de funil: eventos de marketing nunca definem receita verificada. |
| **Integridade Financeira** | Implementado & Auditado | `apps/web/src/app/api/tracking/billing-webhook/route.ts`, `packages/domain/src/billing-gateway.ts` | Médio (depende de credenciais reais do gateway) | Assinatura HMAC-SHA-256 criptográfica obrigatória. Bloquear forja de receita. |
| **Segurança de API Keys** | Implementado & Auditado | Hashes SHA-256 com escopos granulares (`events:write`). Expiração e revogação. | Baixo | Chaves nunca expostas em texto puro. Derivação de tenant no servidor. |
| **Pseudonimização (LGPD)** | Implementado & Auditado | HMAC-SHA-256 com `PII_PEPPER_SECRET`. Fail-secure em produção. | Baixo | Rejeitar operação em produção caso `PII_PEPPER_SECRET` não seja configurado. |
| **Rate Limiting** | Implementado (Local) | Token Bucket em memória (120 req/min por IP/chave) em `events/route.ts`. | Médio (em ambiente multi-instância) | Documentar necessidade de Redis para produção distribuída. Suficiente para homologação. |
| **Migrações de Banco** | 5 arquivos locais criados | `supabase/migrations/20261026000000` a `20261027000002`. Remoto sem aplicação. | Alto se aplicado sem rollback | Seguir plano de migração transacional sem `CASCADE`. |
| **Integração Meta Ads** | Somente Leitura | `packages/integrations/src/meta/connector.ts` (17 testes aprovados). | Baixo | Bloqueio mandatória de mutações remotas. Escopo `ads_management` bloqueado. |
| **Integração Google Ads** | Contrato e Estrutura | `packages/integrations/src/google/` | Médio | Modo seguro somente leitura; credenciais simuladas em homologação. |
| **Growth Studio & IA** | Implementado | `packages/ai/src/`, `apps/web/src/components/GrowthStudio.tsx` | Baixo | Preservar distinção explícita entre projeções de IA e dados contábeis reais. |
| **Diagnósticos & Execução** | Implementado com Hard Cap | `packages/execution/src/`, `packages/diagnostics/src/` | Baixo | Manter execução remota desligada (`MOCK_REMOTE_EXECUTION=true`). |

---

## 4. Estado de Testes e Build

- **Testes Unitários:** 80 testes executados via `npm test --workspaces` com **100% de sucesso (80/80 aprovados)**.
- **Build de Produção:** `npm run build --workspace=@admetrics/web` concluído com sucesso, gerando 16 rotas estáticas e dinâmicas otimizadas em 5.6s.
- **Banco Remoto:** Supabase de desenvolvimento (`xzflmvkgtlfbkrsqbgpt`) preservado sem alterações não autorizadas.
