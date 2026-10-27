-- ====================================================================
-- AdMetrics & Growth AI — Seed Data para Ambiente Local / Testes
-- ====================================================================

-- 1. Organização Piloto
insert into public.organizations (id, name, organization_type)
values ('a0000000-0000-0000-0000-000000000001', 'Growth Rocket Agency', 'agency')
on conflict (id) do nothing;

-- 2. Cliente Atendido
insert into public.clients (
  id, organization_id, name, timezone, currency, max_daily_budget_limit, max_single_budget_increase_percent
)
values (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Alpha E-commerce B2B',
  'America/Sao_Paulo',
  'BRL',
  1500.00,
  20
)
on conflict (organization_id, id) do nothing;

-- 3. Conexão Meta Ads
insert into public.ad_connections (
  id, organization_id, client_id, platform, external_account_id, external_account_name, status, last_synced_at
)
values (
  'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'meta',
  'act_7788990011',
  'Alpha Meta Ads Official',
  'active',
  now()
)
on conflict (platform, external_account_id) do nothing;

-- 4. Campanhas Sincronizadas
insert into public.campaigns (
  id, connection_id, client_id, platform, external_campaign_id, name, status, daily_budget, objective
)
values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'meta', 'camp_meta_topo', 'Topo de Funil - Vídeos & Alcance', 'ACTIVE', 150.00, 'AWARENESS'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'meta', 'camp_meta_conversao', 'Fundo de Funil - Leads Qualificados', 'ACTIVE', 280.00, 'LEAD_GENERATION'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'meta', 'camp_meta_remarketing', 'Remarketing - Visitantes 30D', 'ACTIVE', 90.00, 'CONVERSIONS')
on conflict (platform, external_campaign_id) do nothing;

-- 5. Proposta de Ação de Exemplo (Pronta para Demonstração na Central de Aprovações)
insert into public.action_proposals (
  id, organization_id, client_id, proposed_by, action_type, payload, evidence, risk_level, status, version
)
values (
  'f0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'heuristic_rule',
  'ADJUST_DAILY_BUDGET',
  '{
    "actionType": "ADJUST_DAILY_BUDGET",
    "platform": "meta",
    "externalAccountId": "act_7788990011",
    "resourceType": "CAMPAIGN",
    "resourceId": "camp_meta_conversao",
    "currentValue": 280.00,
    "proposedValue": 224.00,
    "unit": "BRL",
    "reason": "Redução preventiva de 20% no orçamento diário devido a CPA R$ 140,00 estar 180% acima da meta de R$ 50,00."
  }'::jsonb,
  '{
    "metric": "CPA",
    "observed": 140.00,
    "target": 50.00,
    "periodDays": 7,
    "conversionsObserved": 2,
    "spendObserved": 280.00
  }'::jsonb,
  'high',
  'pending',
  1
)
on conflict (id) do nothing;
