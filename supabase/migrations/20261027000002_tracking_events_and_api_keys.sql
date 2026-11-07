-- ====================================================================
-- AdMetrics & Growth AI — Migration: Tracking API Keys, Ingestion & Deduplicated Events
-- Versão: 20261027000002_tracking_events_and_api_keys.sql
--
-- OBJETIVO:
-- 1. Criação da tabela de credenciais de integração servidor-a-servidor por cliente (client_api_keys).
--    - Chaves armazenadas em hash SHA-256 (nunca em texto puro).
--    - Mecanismo de expiração, rotação (revogação com timestamp) e escopos ('events:write', etc.).
-- 2. Criação da tabela de eventos de aquisição e conversão (tracking_events).
--    - Deduplicação persistente no escopo do cliente: unique (client_id, event_id).
--    - Preservação da integridade financeira e separação entre leads, trials e assinaturas.
--    - Isolamento multi-tenant restrito com RLS mandatória.
--    - Chaves estrangeiras compostas com public.clients(organization_id, id).
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. CREDENCIAIS DE INTEGRAÇÃO SERVIDOR-A-SERVIDOR (API KEYS)
-- --------------------------------------------------------------------
create table if not exists public.client_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  
  -- Identificação e Verificação Segura (Hashing SHA-256)
  key_prefix text not null, -- Primeiros 8 caracteres visíveis (ex: 'admk_live_...')
  key_hash text not null unique, -- Hash criptográfico SHA-256 da chave completa
  name text not null default 'Servidor Backend / Webhook',
  
  -- Escopos permitidos (ex: array ['events:write'])
  scopes text[] not null default '{"events:write"}',
  
  -- Ciclo de Vida, Rotação e Revogação
  is_active boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete cascade
);

create index if not exists idx_client_api_keys_lookup on public.client_api_keys(key_hash) where is_active = true and revoked_at is null;
create index if not exists idx_client_api_keys_tenant on public.client_api_keys(organization_id, client_id);

alter table public.client_api_keys enable row level security;
alter table public.client_api_keys force row level security;

-- Políticas de RLS para client_api_keys
drop policy if exists "Membros podem gerenciar chaves de sua org" on public.client_api_keys;
create policy "Membros podem gerenciar chaves de sua org"
  on public.client_api_keys for all
  using (public.user_has_org_access(organization_id))
  with check (public.user_has_org_access(organization_id));

revoke all on table public.client_api_keys from anon;
grant select, insert, update, delete on table public.client_api_keys to authenticated;
grant all on table public.client_api_keys to service_role;

comment on table public.client_api_keys is 'Credenciais individuais de integração servidor-a-servidor por cliente, protegidas por hash criptográfico SHA-256.';

-- --------------------------------------------------------------------
-- 2. TABELA DE EVENTOS DE AQUISIÇÃO E CONVERSÃO (TRACKING EVENTS)
-- --------------------------------------------------------------------
create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  
  -- Identificador de deduplicação único fornecido pelo cliente/evento
  event_id text not null,
  event_name text not null check (
    event_name in ('lead_capture', 'free_trial_started', 'subscription_activated', 'billing_refund', 'billing_chargeback', 'billing_dispute_reversed')
  ),
  
  -- Timestamp de ocorrência original com validação de janela
  event_timestamp timestamptz not null,
  
  -- Atribuição e Origem (UTMs e Canais Determinísticos)
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  attribution_channel text not null check (
    attribution_channel in ('meta_ads', 'google_ads', 'whatsapp_direct', 'organic_search', 'direct', 'unknown')
  ),
  attribution_confidence text not null check (
    attribution_confidence in ('EXACT_UTM', 'HEURISTIC', 'ORGANIC_FALLBACK', 'UNATTRIBUTED')
  ),
  
  -- Associação Opcional de Campanha Publicitária
  campaign_id text,
  
  -- Integridade Financeira (Somente para eventos de receita confirmados)
  verified_value numeric(12, 2) not null default 0.00,
  currency text not null default 'BRL',
  is_verified_origin boolean not null default false,
  
  -- Hash de Privacidade / Pseudonimização (LGPD/GDPR)
  -- NUNCA armazenar email ou telefone em texto puro
  user_pseudo_id text,
  
  -- Metadados de Ingestão e Auditoria
  source_ip_hash text,
  user_agent_snippet text,
  api_key_id uuid references public.client_api_keys(id) on delete set null,
  created_at timestamptz not null default now(),
  
  -- Garantias Mandatórias de Integridade Multi-Tenant e Deduplicação Persistente
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete cascade,
  unique (client_id, event_id)
);

create index if not exists idx_tracking_events_tenant_time on public.tracking_events(organization_id, client_id, event_timestamp desc);
create index if not exists idx_tracking_events_funnel on public.tracking_events(client_id, event_name, event_timestamp);
create index if not exists idx_tracking_events_attribution on public.tracking_events(client_id, attribution_channel, event_timestamp);

alter table public.tracking_events enable row level security;
alter table public.tracking_events force row level security;

-- Políticas de RLS para tracking_events
drop policy if exists "Membros podem visualizar eventos de sua org" on public.tracking_events;
create policy "Membros podem visualizar eventos de sua org"
  on public.tracking_events for select
  using (public.user_has_org_access(organization_id));

drop policy if exists "Membros podem inserir eventos de sua org" on public.tracking_events;
create policy "Membros podem inserir eventos de sua org"
  on public.tracking_events for insert
  with check (public.user_has_org_access(organization_id));

revoke all on table public.tracking_events from anon;
grant select, insert on table public.tracking_events to authenticated;
grant all on table public.tracking_events to service_role;

comment on table public.tracking_events is 'Eventos de conversão e aquisição com deduplicação única no escopo do cliente e integridade contábil.';
