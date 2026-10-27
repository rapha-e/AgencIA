-- ====================================================================
-- AdMetrics & Growth AI — Migration 0001: Autenticação & Multi-Tenancy RLS
-- Versão 1.2 · Políticas RLS Blindadas contra Escalonamento de Privilégios,
-- Funções com Search Path Seguro, Validação de Identidade e Imutabilidade
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. FUNÇÕES AUXILIARES DE SEGURANÇA (SECURITY DEFINER + SEARCH_PATH)
-- --------------------------------------------------------------------

-- Recriação segura de user_has_org_access com search_path explícito
create or replace function public.user_has_org_access(org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or org_id is null then
    return false;
  end if;

  return exists (
    select 1 from public.memberships
    where organization_id = org_id
      and user_id = auth.uid()
  );
end;
$$;

-- Função auxiliar: verifica se o usuário autenticado tem acesso ao cliente
create or replace function public.user_has_client_access(target_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or target_client_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.clients c
    inner join public.memberships m on m.organization_id = c.organization_id
    where c.id = target_client_id
      and m.user_id = auth.uid()
  );
end;
$$;

-- Função auxiliar: retorna o papel do usuário na organização
create or replace function public.user_org_role(target_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if auth.uid() is null or target_org_id is null then
    return null;
  end if;

  select role into v_role
  from public.memberships
  where organization_id = target_org_id
    and user_id = auth.uid();

  return v_role;
end;
$$;

-- Restringe execução das funções auxiliares
revoke execute on function public.user_has_org_access(uuid) from public;
grant execute on function public.user_has_org_access(uuid) to authenticated;

revoke execute on function public.user_has_client_access(uuid) from public;
grant execute on function public.user_has_client_access(uuid) to authenticated;

revoke execute on function public.user_org_role(uuid) from public;
grant execute on function public.user_org_role(uuid) to authenticated;

-- --------------------------------------------------------------------
-- 2. CRIAÇÃO ATÔMICA DE ORGANIZAÇÃO COM OWNER (ANTI-FALSIFICAÇÃO)
-- --------------------------------------------------------------------

create or replace function public.create_organization_with_owner(
  org_name text,
  org_type text default 'smb'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  -- 1. Validar autenticação explícita
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Operação não autorizada: Usuário precisa estar autenticado.';
  end if;

  -- 2. Validar parâmetros de entrada
  if org_name is null or length(trim(org_name)) < 2 then
    raise exception 'O nome da organização deve conter pelo menos 2 caracteres.';
  end if;

  if org_type not in ('smb', 'agency') then
    raise exception 'Tipo de organização inválido. Use smb ou agency.';
  end if;

  -- 3. Inserir Organização
  insert into public.organizations (name, organization_type)
  values (trim(org_name), org_type)
  returning id into v_org_id;

  -- 4. Inserir Membership como OWNER automaticamente para o usuário autenticado
  insert into public.memberships (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  -- 5. Registrar log de auditoria
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, details)
  values (
    v_org_id,
    v_user_id,
    'ORGANIZATION_CREATED',
    'organization',
    v_org_id::text,
    jsonb_build_object('name', org_name, 'type', org_type, 'role', 'owner')
  );

  return v_org_id;
end;
$$;

revoke execute on function public.create_organization_with_owner(text, text) from public;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;

-- --------------------------------------------------------------------
-- 3. POLÍTICAS RLS BLINDADAS PARA TODAS AS TABELAS DO SISTEMA
-- --------------------------------------------------------------------

-- MEMBERSHIPS
drop policy if exists "Membros podem visualizar membros de sua organização" on public.memberships;
create policy "Membros podem visualizar membros de sua organização"
  on public.memberships for select
  using (user_id = auth.uid() or public.user_has_org_access(organization_id));

-- Inserção de membros: Apenas owner e admin podem convidar, mas apenas owner pode convidar outro owner
drop policy if exists "Apenas owners e admins podem gerenciar membros" on public.memberships;
create policy "Apenas owners e admins podem gerenciar membros"
  on public.memberships for insert
  with check (
    public.user_org_role(organization_id) in ('owner', 'admin')
    and (
      role <> 'owner'
      or public.user_org_role(organization_id) = 'owner'
    )
  );

-- Atualização de membros: impede que admin promova a si ou a outros para owner,
-- e impede que não-owners alterem membros com papel owner.
drop policy if exists "Apenas owners e admins podem atualizar membros" on public.memberships;
create policy "Apenas owners e admins podem atualizar membros"
  on public.memberships for update
  using (
    -- Só pode atualizar se o executor for owner, OU for admin mexendo em papéis abaixo de owner
    public.user_org_role(organization_id) = 'owner'
    or (
      public.user_org_role(organization_id) = 'admin'
      and role <> 'owner'
      and user_id <> auth.uid() -- Admin não pode alterar o próprio papel para se autopromover
    )
  )
  with check (
    -- O novo papel não pode ser 'owner' a menos que quem esteja alterando seja 'owner'
    (role <> 'owner' or public.user_org_role(organization_id) = 'owner')
  );

-- Exclusão de membros: owner pode remover qualquer um; admin pode remover papéis inferiores
drop policy if exists "Apenas owners e admins podem remover membros" on public.memberships;
create policy "Apenas owners e admins podem remover membros"
  on public.memberships for delete
  using (
    public.user_org_role(organization_id) = 'owner'
    or (
      public.user_org_role(organization_id) = 'admin'
      and role <> 'owner'
    )
    or user_id = auth.uid() -- O próprio usuário pode optar por sair da organização
  );

-- ORGANIZATIONS (Atualização permitida apenas para owner/admin)
drop policy if exists "Owners e admins podem atualizar sua organizacao" on public.organizations;
create policy "Owners e admins podem atualizar sua organizacao"
  on public.organizations for update
  using (public.user_org_role(id) in ('owner', 'admin'));

-- CLIENTS
drop policy if exists "Membros podem gerenciar clientes de sua organização" on public.clients;
drop policy if exists "Membros podem visualizar clientes de sua organização" on public.clients;
create policy "Membros podem visualizar clientes de sua organização"
  on public.clients for select
  using (public.user_has_org_access(organization_id));

drop policy if exists "Gestores podem criar clientes na sua organização" on public.clients;
create policy "Gestores podem criar clientes na sua organização"
  on public.clients for insert
  with check (public.user_org_role(organization_id) in ('owner', 'admin', 'manager'));

drop policy if exists "Gestores podem atualizar clientes de sua organização" on public.clients;
create policy "Gestores podem atualizar clientes de sua organização"
  on public.clients for update
  using (public.user_org_role(organization_id) in ('owner', 'admin', 'manager'));

drop policy if exists "Apenas owners e admins podem excluir clientes" on public.clients;
create policy "Apenas owners e admins podem excluir clientes"
  on public.clients for delete
  using (public.user_org_role(organization_id) in ('owner', 'admin'));

-- AD_CONNECTIONS
drop policy if exists "Membros podem ver conexoes de clientes da sua org" on public.ad_connections;
create policy "Membros podem ver conexoes de clientes da sua org"
  on public.ad_connections for select
  using (public.user_has_org_access(organization_id));

drop policy if exists "Gestores podem gerenciar conexoes" on public.ad_connections;
create policy "Gestores podem gerenciar conexoes"
  on public.ad_connections for all
  using (public.user_org_role(organization_id) in ('owner', 'admin', 'manager'));

-- SYNC_RUNS
drop policy if exists "Membros podem ver sync runs da sua org" on public.sync_runs;
create policy "Membros podem ver sync runs da sua org"
  on public.sync_runs for select
  using (
    exists (
      select 1 from public.ad_connections c
      where c.id = connection_id
        and public.user_has_org_access(c.organization_id)
    )
  );

-- CAMPAIGNS
drop policy if exists "Membros podem ver campanhas de clientes acessiveis" on public.campaigns;
create policy "Membros podem ver campanhas de clientes acessiveis"
  on public.campaigns for select
  using (public.user_has_client_access(client_id));

drop policy if exists "Gestores podem atualizar campanhas" on public.campaigns;
create policy "Gestores podem atualizar campanhas"
  on public.campaigns for update
  using (
    exists (
      select 1 from public.clients cl
      where cl.id = client_id
        and public.user_org_role(cl.organization_id) in ('owner', 'admin', 'manager')
    )
  );

-- METRIC_FACTS
drop policy if exists "Membros podem ver metric facts de seus clientes" on public.metric_facts;
create policy "Membros podem ver metric facts de seus clientes"
  on public.metric_facts for select
  using (public.user_has_client_access(client_id));

-- ACTION_PROPOSALS
drop policy if exists "Membros podem visualizar propostas de sua organização" on public.action_proposals;
create policy "Membros podem visualizar propostas de sua organização"
  on public.action_proposals for select
  using (public.user_has_org_access(organization_id));

drop policy if exists "Membros autorizados podem criar propostas" on public.action_proposals;
create policy "Membros autorizados podem criar propostas"
  on public.action_proposals for insert
  with check (public.user_has_org_access(organization_id));

drop policy if exists "Membros autorizados podem atualizar propostas" on public.action_proposals;
create policy "Membros autorizados podem atualizar propostas"
  on public.action_proposals for update
  using (public.user_has_org_access(organization_id));

-- APPROVALS
-- Validação estrita: apenas gestores (owner, admin, manager) podem aprovar,
-- o aprovador DEVE ser o auth.uid(), a proposta deve estar 'pending' e a versão aprovada deve bater com a proposta.
drop policy if exists "Membros podem ver aprovacoes de sua org" on public.approvals;
create policy "Membros podem ver aprovacoes de sua org"
  on public.approvals for select
  using (
    exists (
      select 1 from public.action_proposals ap
      where ap.id = proposal_id
        and public.user_has_org_access(ap.organization_id)
    )
  );

drop policy if exists "Gestores podem criar aprovacoes" on public.approvals;
create policy "Gestores podem criar aprovacoes"
  on public.approvals for insert
  with check (
    approved_by = auth.uid()
    and exists (
      select 1 from public.action_proposals ap
      where ap.id = proposal_id
        and ap.status = 'pending'
        and ap.version = approved_version
        and public.user_org_role(ap.organization_id) in ('owner', 'admin', 'manager')
    )
  );

-- EXECUTION_LOGS (Imutável por padrão)
drop policy if exists "Membros podem ver execution logs de sua org" on public.execution_logs;
create policy "Membros podem ver execution logs de sua org"
  on public.execution_logs for select
  using (
    exists (
      select 1 from public.action_proposals ap
      where ap.id = proposal_id
        and public.user_has_org_access(ap.organization_id)
    )
  );

-- AUDIT_LOGS (Imutável: apenas INSERT e SELECT, sem permissões de UPDATE ou DELETE)
drop policy if exists "Membros podem ver audit logs de sua org" on public.audit_logs;
create policy "Membros podem ver audit logs de sua org"
  on public.audit_logs for select
  using (public.user_has_org_access(organization_id));

drop policy if exists "Membros podem registrar audit logs de sua org" on public.audit_logs;
create policy "Membros podem registrar audit logs de sua org"
  on public.audit_logs for insert
  with check (
    public.user_has_org_access(organization_id)
    and (actor_id = auth.uid() or actor_id is null)
  );
