-- ====================================================================
-- AdMetrics & Growth AI — Migration: Growth Plans & Marketing Assets
-- Versão: 20261027000001_growth_plans_and_assets.sql
-- 
-- OBJETIVO:
-- Estruturação de dados para a fase de partida a frio (Cold Start),
-- planejamento estratégico de aquisição e estúdio de ativos de marketing.
--
-- POLÍTICA DE SEGURANÇA E GOVERNANÇA:
-- 1. RLS habilitado e obrigatório com isolamento estrito multi-tenant.
-- 2. Acesso delimitado pela função public.user_has_org_access(organization_id).
-- 3. Integridade referencial composta com public.clients(organization_id, id) ON DELETE CASCADE.
-- 4. Rastreabilidade com author_id (default auth.uid()), versionamento e chave única para idempotência.
-- 5. Revogação estrita para 'anon' e concessão para 'authenticated' (restringido por RLS) e 'service_role'.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. TABELA DE PLANOS DE CRESCIMENTO (GROWTH PLANS)
-- --------------------------------------------------------------------
create table if not exists public.growth_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null unique,
  
  -- Modelo de Negócio e Posicionamento
  business_model text not null check (
    business_model in ('b2b_saas', 'ecommerce', 'infoproduct', 'local_service', 'b2b_sales')
  ),
  product_name text not null,
  product_url text,
  value_proposition text not null,
  
  -- ICP (Ideal Customer Profile) e Dores de Mercado
  target_audience text not null,
  pain_points text[] not null default '{}',
  main_differentiator text not null,
  primary_offer text not null default 'free_trial' check (
    primary_offer in ('free_trial', 'demo', 'direct_sale', 'whatsapp_consult')
  ),
  
  -- Metas Econômicas Determinísticas (Unit Economics)
  monthly_price numeric(10, 2) not null default 0.00,
  estimated_ltv numeric(10, 2) not null default 0.00,
  target_cac numeric(10, 2) not null default 0.00,
  target_cpl numeric(10, 2) not null default 0.00,
  max_daily_budget numeric(10, 2) not null default 50.00,
  
  -- Governança, Versionamento e Auditoria
  version integer not null default 1,
  author_id uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete cascade
);

-- Ativação e imposição mandatória de Row Level Security
alter table public.growth_plans enable row level security;
alter table public.growth_plans force row level security;

-- Políticas de RLS para growth_plans
drop policy if exists "Membros podem visualizar growth_plans de sua org" on public.growth_plans;
create policy "Membros podem visualizar growth_plans de sua org"
  on public.growth_plans for select
  using (public.user_has_org_access(organization_id));

drop policy if exists "Membros podem criar growth_plans de sua org" on public.growth_plans;
create policy "Membros podem criar growth_plans de sua org"
  on public.growth_plans for insert
  with check (public.user_has_org_access(organization_id));

drop policy if exists "Membros podem atualizar growth_plans de sua org" on public.growth_plans;
create policy "Membros podem atualizar growth_plans de sua org"
  on public.growth_plans for update
  using (public.user_has_org_access(organization_id))
  with check (public.user_has_org_access(organization_id));

drop policy if exists "Membros podem deletar growth_plans de sua org" on public.growth_plans;
create policy "Membros podem deletar growth_plans de sua org"
  on public.growth_plans for delete
  using (public.user_has_org_access(organization_id));

-- Concessões e Revogações de Privilégios
revoke all on table public.growth_plans from anon;
grant select, insert, update, delete on table public.growth_plans to authenticated;
grant all on table public.growth_plans to service_role;

comment on table public.growth_plans is 'Armazena a estratégia de tração, parâmetros de ICP e metas contábeis determinísticas (LTV, CAC, CPL) por cliente.';

-- --------------------------------------------------------------------
-- 2. TABELA DE ATIVOS DE MARKETING (MARKETING ASSETS)
-- --------------------------------------------------------------------
create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  
  channel text not null check (
    channel in ('meta_ads', 'google_search', 'landing_page', 'whatsapp_outbound')
  ),
  asset_type text not null check (
    asset_type in ('reels_script', 'feed_ad', 'search_keywords', 'lp_structure', 'outbound_message')
  ),
  title text not null,
  content jsonb not null,
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'active', 'archived')
  ),
  version integer not null default 1,
  author_id uuid default auth.uid() references auth.users(id),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete cascade,
  unique (organization_id, client_id, channel, asset_type, title, version)
);

-- Ativação e imposição mandatória de Row Level Security
alter table public.marketing_assets enable row level security;
alter table public.marketing_assets force row level security;

-- Políticas de RLS para marketing_assets
drop policy if exists "Membros podem visualizar marketing_assets de sua org" on public.marketing_assets;
create policy "Membros podem visualizar marketing_assets de sua org"
  on public.marketing_assets for select
  using (public.user_has_org_access(organization_id));

drop policy if exists "Membros podem criar marketing_assets de sua org" on public.marketing_assets;
create policy "Membros podem criar marketing_assets de sua org"
  on public.marketing_assets for insert
  with check (public.user_has_org_access(organization_id));

drop policy if exists "Membros podem atualizar marketing_assets de sua org" on public.marketing_assets;
create policy "Membros podem atualizar marketing_assets de sua org"
  on public.marketing_assets for update
  using (public.user_has_org_access(organization_id))
  with check (public.user_has_org_access(organization_id));

drop policy if exists "Membros podem deletar marketing_assets de sua org" on public.marketing_assets;
create policy "Membros podem deletar marketing_assets de sua org"
  on public.marketing_assets for delete
  using (public.user_has_org_access(organization_id));

-- Concessões e Revogações de Privilégios
revoke all on table public.marketing_assets from anon;
grant select, insert, update, delete on table public.marketing_assets to authenticated;
grant all on table public.marketing_assets to service_role;

comment on table public.marketing_assets is 'Estúdio de copys, roteiros de Reels, palavras-chave de Google Ads e estruturas de landing page com versionamento e isolamento multi-tenant.';
