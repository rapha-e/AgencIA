-- ====================================================================
-- AdMetrics & Growth AI — Migration: Supabase Daily Keep-Alive (pg_cron)
-- Garante atividade diária interna no PostgreSQL + função RPC pública
-- para pings externos via PostgREST (/rest/v1/rpc/ping_keep_alive).
-- ====================================================================

create or replace function public.ping_keep_alive()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_count integer;
begin
  select count(*) into v_org_count from public.organizations;
  return jsonb_build_object(
    'status', 'ALIVE',
    'timestamp', now(),
    'organizations_checked', v_org_count >= 0
  );
end;
$$;

grant execute on function public.ping_keep_alive() to anon, authenticated, service_role;

-- Agenda job diário no pg_cron (caso a extensão pg_cron esteja disponível na instância Supabase)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'admetrics-daily-keep-alive',
      '0 8 * * *',
      'select public.ping_keep_alive();'
    );
  end if;
exception
  when others then
    -- Ignora graciosamente se pg_cron não estiver habilitado no plano atual
    null;
end;
$$;

