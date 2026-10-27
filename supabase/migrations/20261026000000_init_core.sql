-- ====================================================================
-- AdMetrics & Growth AI — Migration Inicial do Núcleo
-- Versão 1.0 · Arquitetura Multi-Tenant com RLS e Governança de Tráfego
-- ====================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------
-- 1. IDENTIDADE E MULTI-TENANCY
-- --------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null check (organization_type in ('smb', 'agency')),
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'analyst', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  max_daily_budget_limit numeric(12, 2) default 1000.00, -- Hard Cap de segurança
  max_single_budget_increase_percent integer default 20, -- Limite máx % de aumento
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

-- --------------------------------------------------------------------
-- 2. CONEXÕES PUBLICITÁRIAS E SINCRONIZAÇÃO
-- --------------------------------------------------------------------

create table public.ad_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  platform text not null check (platform in ('meta', 'google_ads')),
  external_account_id text not null,
  external_account_name text,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'revoked', 'error')),
  token_secret_ref text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete cascade,
  unique (platform, external_account_id)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.ad_connections(id) on delete cascade,
  status text not null check (status in ('pending', 'running', 'completed', 'failed')),
  records_processed integer default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- --------------------------------------------------------------------
-- 3. ESTRUTURA DE CAMPANHAS E FATOS DE MÉTRICAS
-- --------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.ad_connections(id) on delete cascade,
  client_id uuid not null,
  platform text not null check (platform in ('meta', 'google_ads')),
  external_campaign_id text not null,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'ARCHIVED', 'UNKNOWN')),
  daily_budget numeric(12, 2),
  lifetime_budget numeric(12, 2),
  objective text,
  last_synced_at timestamptz not null default now(),
  unique (platform, external_campaign_id)
);

-- Fatos Analíticos com Granularidade Diária e Chave Única Anti-Duplicação
create table public.metric_facts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  platform text not null check (platform in ('meta', 'google_ads')),
  external_account_id text not null,
  campaign_id text not null,
  date date not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend numeric(12, 2) not null default 0.00,
  conversions numeric(12, 2) not null default 0.00,
  revenue numeric(12, 2) not null default 0.00,
  currency text not null default 'BRL',
  attribution_window text not null default '7d_click_1d_view',
  source text not null default 'api_sync',
  created_at timestamptz not null default now(),
  -- Chave única para garantir idempotência em re-sincronizações
  unique (client_id, platform, external_account_id, campaign_id, date, attribution_window)
);

-- --------------------------------------------------------------------
-- 4. GOVERNANÇA, PROPOSTAS, APROVAÇÃO E AUDITORIA
-- --------------------------------------------------------------------

create table public.action_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  proposed_by text not null default 'ai' check (proposed_by in ('ai', 'analyst', 'heuristic_rule')),
  action_type text not null,
  payload jsonb not null,
  evidence jsonb not null default '{}'::jsonb,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'executing', 'succeeded', 'failed', 'expired', 'cancelled')
  ),
  version integer not null default 1,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete cascade
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.action_proposals(id) on delete cascade,
  approved_version integer not null,
  approved_by uuid not null references auth.users(id),
  decision text not null check (decision in ('approved', 'rejected')),
  note text,
  decided_at timestamptz not null default now()
);

create table public.execution_logs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.action_proposals(id),
  idempotency_key text not null unique,
  platform text not null check (platform in ('meta', 'google_ads')),
  request_payload jsonb not null,
  response_payload jsonb,
  status text not null check (status in ('SUCCESS', 'FAILURE')),
  error_message text,
  executed_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- 5. ÍNDICES DE ALTA PERFORMANCE
-- --------------------------------------------------------------------

create index idx_clients_org on public.clients(organization_id);
create index idx_ad_conn_client on public.ad_connections(client_id);
create index idx_campaigns_client on public.campaigns(client_id);
create index idx_metric_facts_query on public.metric_facts(client_id, date desc);
create index idx_proposals_pending on public.action_proposals(organization_id, status, created_at desc);
create index idx_audit_logs_org on public.audit_logs(organization_id, created_at desc);

-- --------------------------------------------------------------------
-- 6. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.ad_connections enable row level security;
alter table public.sync_runs enable row level security;
alter table public.campaigns enable row level security;
alter table public.metric_facts enable row level security;
alter table public.action_proposals enable row level security;
alter table public.approvals enable row level security;
alter table public.execution_logs enable row level security;
alter table public.audit_logs enable row level security;

-- Função auxiliar de autorização por organização
create or replace function public.user_has_org_access(org_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.memberships
    where organization_id = org_id
      and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Políticas para Organizations
create policy "Membros podem visualizar sua organização"
  on public.organizations for select
  using (public.user_has_org_access(id));

-- Políticas para Clients
create policy "Membros podem gerenciar clientes de sua organização"
  on public.clients for all
  using (public.user_has_org_access(organization_id));

-- Políticas para Action Proposals
create policy "Membros podem visualizar propostas de sua organização"
  on public.action_proposals for select
  using (public.user_has_org_access(organization_id));

create policy "Membros autorizados podem criar propostas"
  on public.action_proposals for insert
  with check (public.user_has_org_access(organization_id));

create policy "Membros autorizados podem atualizar propostas"
  on public.action_proposals for update
  using (public.user_has_org_access(organization_id));
