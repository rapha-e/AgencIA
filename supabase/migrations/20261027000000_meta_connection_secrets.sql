-- ====================================================================
-- AdMetrics & Growth AI — Migration: Segredos de Conexões de Anúncios
-- Versão: 20261027000000_meta_connection_secrets.sql
-- 
-- OBJETIVO:
-- Armazenamento seguro de tokens OAuth criptografados (AES-256-GCM)
-- com isolamento total em relação ao cliente e ao frontend.
--
-- POLÍTICA DE SEGURANÇA:
-- 1. RLS HABILITADO E FORÇADO COM ACESSO NEGADO POR PADRÃO.
-- 2. Zero políticas permissivas para roles 'anon' e 'authenticated'.
-- 3. Acesso exclusivo concedido à role 'service_role' (backend restrito).
-- 4. Chave estrangeira referenciando public.ad_connections(id) ON DELETE CASCADE.
-- 5. Restrição UNIQUE em connection_id (fornece indexação única nativa sem índices redundantes).
-- ====================================================================

create table if not exists public.connection_secrets (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.ad_connections(id) on delete cascade,
  encrypted_access_token text not null, -- Formato v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
  token_type text not null default 'bearer',
  expires_at timestamptz,
  scopes text[] not null default '{}',
  meta_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ativação e imposição mandatória de Row Level Security
alter table public.connection_secrets enable row level security;
alter table public.connection_secrets force row level security;

-- Revogação estrita de quaisquer privilégios de roles públicas e de usuários
revoke all on table public.connection_secrets from public;
revoke all on table public.connection_secrets from anon;
revoke all on table public.connection_secrets from authenticated;

-- Acesso concedido exclusivamente ao backend via service_role
grant select, insert, update, delete on table public.connection_secrets to service_role;

comment on table public.connection_secrets is 'Armazena tokens de acesso criptografados com AES-256-GCM. Sem acesso direto para clientes ou frontend via API REST/GraphQL.';
