# 02 — Plano de Migração e Rollback Seguro (Sprint 6)

**Ambiente:** Banco PostgreSQL / Supabase  
**Política Mandatória:** Nenhuma migração foi ou deve ser executada remotamente nesta sprint. Todo o plano foi elaborado e validado localmente.  
**Regra Estrita de Rollback:** PROIBIDO O USO DE `DROP ... CASCADE` COMO MECANISMO GENÉRICO.

---

## 1. Inventário e Sequência de Migrações

A ordem de execução deve respeitar estritamente as dependências de chaves estrangeiras:

1. `20261026000000_init_core.sql`
   - Tabelas fundamentais: `organizations`, `users`, `organization_members`, `clients`.
   - Índices de busca por tenant e constraints primárias.

2. `20261026000001_auth_multi_tenant_rls.sql`
   - Função utilitária de segurança: `public.user_has_org_access(org_id)`.
   - Ativação obrigatória de Row Level Security (RLS) nas tabelas centrais.
   - Políticas de isolamento multi-tenant para `authenticated` e restrição para `anon`.

3. `20261027000000_meta_connection_secrets.sql`
   - Tabela `meta_connections` e armazenamento criptografado de credenciais OAuth (AES-256-GCM).

4. `20261027000001_growth_plans_and_assets.sql`
   - Tabela `growth_plans` (estratégia de partida a frio, ICP, unit economics).
   - Tabela `marketing_assets` (roteiros de Reels, copys de feed, landing pages, palavras-chave).
   - Foreign keys compostas: `(organization_id, client_id) REFERENCES clients(organization_id, id) ON DELETE CASCADE`.

5. `20261027000002_tracking_events_and_api_keys.sql`
   - Tabela `client_api_keys` (credenciais com hash SHA-256, escopos, revogação e expiração).
   - Tabela `tracking_events` (eventos de aquisição, deduplicação única por `(client_id, event_id)`, integridade financeira e pseudonimização LGPD).

---

## 2. Análise da Constraint `UNIQUE(client_id)` em `growth_plans`

Na migração `20261027000001_growth_plans_and_assets.sql`:
```sql
create table if not exists public.growth_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null unique,
  ...
  version integer not null default 1
);
```

### Decisão Arquitetural e Impactos:
- **Estado Atual:** A constraint `unique(client_id)` assegura que cada cliente possui exatamente **um plano de crescimento ativo canônico**, simplificando o consumo pelo dashboard e evitando ambiguidade operacional no Cold Start.
- **Limitação:** Impede o armazenamento direto de histórico de planos anteriores ou comparação entre versões na mesma tabela.
- **Roteiro de Evolução Pós-Homologação (Sprint 7):**
  1. Adicionar campo `is_active boolean not null default true`.
  2. Substituir `unique(client_id)` por um índice parcial único:
     ```sql
     create unique index idx_growth_plans_active_per_client 
     on public.growth_plans(client_id) 
     where is_active = true;
     ```
  3. Criar tabela de auditoria `growth_plan_history` ou permitir múltiplas versões arquivadas com `is_active = false`.
- **Decisão para a Sprint 6:** Manter o schema atual para garantir compatibilidade imediata com a UI e contratos estáveis de homologação, registrando a evolução documentada no roadmap.

---

## 3. Pré-Requisitos e Checagem Pré-Migração

Antes de aplicar qualquer migração em ambiente de homologação ou produção:

1. **Backup Completo (CLI Supabase e pg_dump Nativo):**
   ```bash
   # Opção A: Dump via Supabase CLI
   supabase db dump -f backup_pre_migration_sprint6.sql

   # Opção B: Dump nativo PostgreSQL (formato custom compactado com verificação)
   pg_dump -h $DB_HOST -p $DB_PORT -U postgres -d postgres -F c -b -v -f backup_pre_migration_sprint6.dump
   ```

2. **Comando de Restauração (Disaster Recovery):**
   ```bash
   # Caso a transação seja corrompida ou o banco precise ser revertido ao estado anterior:
   pg_restore -h $DB_HOST -p $DB_PORT -U postgres -d postgres -v --clean --if-exists backup_pre_migration_sprint6.dump
   ```

3. **Verificação de Conectividade e Permissões:**
   - Confirmar que o usuário executando possui privilégios de `postgres` ou `service_role`.
   - Confirmar que `public.user_has_org_access` existe e está compilada sem erros.

4. **Validação de Tipos e Extensões:**
   - Verificar se a extensão `pgcrypto` está ativa:
     ```sql
     create extension if not exists "pgcrypto";
     ```

---

## 4. Script Transacional de Aplicação com Proteção de Lock

O script de aplicação deve ser executado dentro de uma transação explícita com limites rígidos de tempo de espera por lock, prevenindo bloqueios em cadeia (*lock contention*):

```sql
-- 1. Definir limites de segurança contra locks concorrentes
SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- 2. Aplicar 20261027000001
\i supabase/migrations/20261027000001_growth_plans_and_assets.sql

-- 3. Aplicar 20261027000002
\i supabase/migrations/20261027000002_tracking_events_and_api_keys.sql

-- 4. Validação pós-aplicação
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracking_events') THEN
    RAISE EXCEPTION 'Falha de migração: tabela tracking_events não foi criada!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_api_keys') THEN
    RAISE EXCEPTION 'Falha de migração: tabela client_api_keys não foi criada!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'growth_plans') THEN
    RAISE EXCEPTION 'Falha de migração: tabela growth_plans não foi criada!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketing_assets') THEN
    RAISE EXCEPTION 'Falha de migração: tabela marketing_assets não foi criada!';
  END IF;
END $$;

COMMIT;
```

---

## 5. Script e Plano de Rollback Seguro (SEM `CASCADE`)

### 5.1 Salvaguarda de Dados Gravados Pós-Migração
Caso o rollback seja necessário após período em operação, deve-se extrair os dados novos antes do descarte:
```sql
-- Exportar dados de tracking gerados durante o período de homologação
\copy public.tracking_events TO 'tracking_events_rescue.csv' WITH CSV HEADER;
\copy public.client_api_keys TO 'client_api_keys_rescue.csv' WITH CSV HEADER;
```

### 5.2 Script de Reversão Atômica por Ordem Inversa de Dependência
```sql
SET lock_timeout = '5s';

BEGIN;

-- 1. Remoção reversa da migração 20261027000002 (tabelas dependentes primeiro)
DROP POLICY IF EXISTS "Membros podem inserir eventos de sua org" ON public.tracking_events;
DROP POLICY IF EXISTS "Membros podem visualizar eventos de sua org" ON public.tracking_events;
DROP TABLE IF EXISTS public.tracking_events;

DROP POLICY IF EXISTS "Membros podem gerenciar chaves de sua org" ON public.client_api_keys;
DROP TABLE IF EXISTS public.client_api_keys;

-- 2. Remoção reversa da migração 20261027000001
DROP POLICY IF EXISTS "Membros podem deletar marketing_assets de sua org" ON public.marketing_assets;
DROP POLICY IF EXISTS "Membros podem atualizar marketing_assets de sua org" ON public.marketing_assets;
DROP POLICY IF EXISTS "Membros podem criar marketing_assets de sua org" ON public.marketing_assets;
DROP POLICY IF EXISTS "Membros podem visualizar marketing_assets de sua org" ON public.marketing_assets;
DROP TABLE IF EXISTS public.marketing_assets;

DROP POLICY IF EXISTS "Membros podem deletar growth_plans de sua org" ON public.growth_plans;
DROP POLICY IF EXISTS "Membros podem atualizar growth_plans de sua org" ON public.growth_plans;
DROP POLICY IF EXISTS "Membros podem criar growth_plans de sua org" ON public.growth_plans;
DROP POLICY IF EXISTS "Membros podem visualizar growth_plans de sua org" ON public.growth_plans;
DROP TABLE IF EXISTS public.growth_plans;

COMMIT;
```

> **Justificativa para não usar CASCADE:** O comando `DROP TABLE ... CASCADE` remove automaticamente views, triggers ou constraints de tabelas centrais como `clients` e `organizations`. O descarte explícito e ordenado sem CASCADE falhará com segurança caso exista qualquer dependência inesperada não mapeada, impedindo destruição inadvertida de dados.
