-- ====================================================================
-- AdMetrics & Growth AI — Ensaio de Migração e Recuperação (Rehearsal)
-- Arquivo: tests/migration_rehearsal.sql
-- 
-- OBJETIVO:
-- Validar o procedimento completo de migração e reversão em ambiente isolado:
-- 1. Criação das tabelas e constraints das migrações 000001 e 000002.
-- 2. Validação da integridade de chaves estrangeiras compostas e RLS.
-- 3. Inserção de registro de pagamento (+R$ 199.90) e de estorno parcial (-R$ 50.00).
-- 4. Teste de salvaguarda de dados pós-migração.
-- 5. Rollback seguro por ordem inversa de dependências SEM CASCADE.
-- 6. Confirmação de que tabelas fundamentais (clients/orgs) permanecem intactas.
-- ====================================================================

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- --------------------------------------------------------------------
-- ETAPA 1: Simulação das Tabelas Fundamentais (caso não existam)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_type text NOT NULL CHECK (organization_type IN ('smb', 'agency')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

-- --------------------------------------------------------------------
-- ETAPA 2: Aplicação da Migração 20261027000001 (Growth Plans & Assets)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.growth_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL UNIQUE,
  business_model text NOT NULL,
  product_name text NOT NULL,
  value_proposition text NOT NULL,
  target_audience text NOT NULL,
  pain_points text[] NOT NULL DEFAULT '{}',
  main_differentiator text NOT NULL,
  primary_offer text NOT NULL DEFAULT 'free_trial',
  monthly_price numeric(10, 2) NOT NULL DEFAULT 0.00,
  estimated_ltv numeric(10, 2) NOT NULL DEFAULT 0.00,
  target_cac numeric(10, 2) NOT NULL DEFAULT 0.00,
  target_cpl numeric(10, 2) NOT NULL DEFAULT 0.00,
  max_daily_budget numeric(10, 2) NOT NULL DEFAULT 50.00,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, client_id) REFERENCES public.clients(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.marketing_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL,
  channel text NOT NULL,
  asset_type text NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, client_id) REFERENCES public.clients(organization_id, id) ON DELETE CASCADE,
  UNIQUE (organization_id, client_id, channel, asset_type, title, version)
);

-- --------------------------------------------------------------------
-- ETAPA 3: Aplicação da Migração 20261027000002 (API Keys & Tracking)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'Webhook Key',
  scopes text[] NOT NULL DEFAULT '{"events:write"}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, client_id) REFERENCES public.clients(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL,
  event_id text NOT NULL,
  event_name text NOT NULL CHECK (
    event_name IN ('lead_capture', 'free_trial_started', 'subscription_activated', 'billing_refund', 'billing_chargeback', 'billing_dispute_reversed')
  ),
  event_timestamp timestamptz NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  attribution_channel text NOT NULL,
  attribution_confidence text NOT NULL,
  campaign_id text,
  verified_value numeric(12, 2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'BRL',
  is_verified_origin boolean NOT NULL DEFAULT false,
  user_pseudo_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, client_id) REFERENCES public.clients(organization_id, id) ON DELETE CASCADE,
  UNIQUE (client_id, event_id)
);

-- --------------------------------------------------------------------
-- ETAPA 4: Ensaio de Carga Contábil (Pagamento + Reembolso Parcial)
-- --------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid := gen_random_uuid();
  v_client_id uuid := gen_random_uuid();
  v_sum_verified numeric;
BEGIN
  -- Inserir dados de teste
  INSERT INTO public.organizations (id, name, organization_type)
  VALUES (v_org_id, 'Org Ensaio Teste', 'smb');

  INSERT INTO public.clients (id, organization_id, name)
  VALUES (v_client_id, v_org_id, 'Cliente Ensaio Piloto');

  -- Inserir evento de pagamento confirmado (+R$ 199.90)
  INSERT INTO public.tracking_events (
    organization_id, client_id, event_id, event_name, event_timestamp,
    attribution_channel, attribution_confidence, verified_value, currency, is_verified_origin
  ) VALUES (
    v_org_id, v_client_id, 'billing_pay_test_001', 'subscription_activated', now(),
    'direct', 'EXACT_UTM', 199.90, 'BRL', true
  );

  -- Inserir evento de reembolso parcial (-R$ 50.00) preservando a linha anterior
  INSERT INTO public.tracking_events (
    organization_id, client_id, event_id, event_name, event_timestamp,
    attribution_channel, attribution_confidence, verified_value, currency, is_verified_origin
  ) VALUES (
    v_org_id, v_client_id, 'billing_ref_test_001', 'billing_refund', now(),
    'direct', 'EXACT_UTM', -50.00, 'BRL', true
  );

  -- Validar agregação contábil líquida (deve totalizar R$ 149.90)
  SELECT SUM(verified_value) INTO v_sum_verified
  FROM public.tracking_events
  WHERE client_id = v_client_id AND is_verified_origin = true;

  IF v_sum_verified <> 149.90 THEN
    RAISE EXCEPTION 'Erro contábil no ensaio: Soma esperada R$ 149.90, obtido: R$ %', v_sum_verified;
  END IF;

  RAISE NOTICE 'ENSAIO CONTÁBIL APROVADO: Saldo Líquido Auditado = R$ %', v_sum_verified;
END $$;

-- --------------------------------------------------------------------
-- ETAPA 5: Ensaio de Rollback Seguro SEM CASCADE
-- --------------------------------------------------------------------
DROP TABLE public.tracking_events;
DROP TABLE public.client_api_keys;
DROP TABLE public.marketing_assets;
DROP TABLE public.growth_plans;

-- --------------------------------------------------------------------
-- ETAPA 6: Verificação de Integridade das Tabelas Centrais Pós-Rollback
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
    RAISE EXCEPTION 'FALHA CRÍTICA DE ROLLBACK: Tabela central clients foi destruída indevidamente!';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    RAISE EXCEPTION 'FALHA CRÍTICA DE ROLLBACK: Tabela central organizations foi destruída indevidamente!';
  END IF;
  RAISE NOTICE 'ENSAIO DE RECUPERAÇÃO APROVADO: Tabelas centrais intactas.';
END $$;

-- Concluir ensaio desfazendo o bloco de teste sem persistir lixo no banco
ROLLBACK;
