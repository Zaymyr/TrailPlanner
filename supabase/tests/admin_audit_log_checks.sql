-- Admin console audit journal checks (lot 7).
-- Run in a privileged SQL session after 20261123120000_admin_audit_log.sql.
-- Every data mutation is rolled back.

begin;

do $$
declare
  v_purged integer;
begin
  -- Function: SECURITY DEFINER, fixed search_path, service role only.
  if not exists (
    select 1 from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public' and procedure_row.proname = 'purge_admin_audit_log'
      and procedure_row.prosecdef
      and procedure_row.proconfig is not null
      and exists (select 1 from unnest(procedure_row.proconfig) as setting where setting like 'search_path=%')
  ) then
    raise exception 'purge_admin_audit_log must be SECURITY DEFINER with a fixed search_path.';
  end if;
  if has_function_privilege('anon', 'public.purge_admin_audit_log()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.purge_admin_audit_log()', 'EXECUTE') then
    raise exception 'Client roles must not execute purge_admin_audit_log.';
  end if;
  if not has_function_privilege('service_role', 'public.purge_admin_audit_log()', 'EXECUTE') then
    raise exception 'The service role must execute purge_admin_audit_log.';
  end if;

  -- Table: RLS on, no policy, no client privilege, append-only for the service role (no update).
  if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'admin_audit_log') then
    raise exception 'admin_audit_log must have RLS enabled.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_audit_log') then
    raise exception 'admin_audit_log must have no client policy.';
  end if;
  if has_table_privilege('anon', 'public.admin_audit_log', 'SELECT')
    or has_table_privilege('anon', 'public.admin_audit_log', 'INSERT')
    or has_table_privilege('authenticated', 'public.admin_audit_log', 'SELECT')
    or has_table_privilege('authenticated', 'public.admin_audit_log', 'INSERT')
    or has_table_privilege('authenticated', 'public.admin_audit_log', 'UPDATE')
    or has_table_privilege('authenticated', 'public.admin_audit_log', 'DELETE') then
    raise exception 'Client roles must not access admin_audit_log.';
  end if;
  if not has_table_privilege('service_role', 'public.admin_audit_log', 'SELECT,INSERT,DELETE') then
    raise exception 'The service role must read, insert and purge admin_audit_log.';
  end if;
  if has_table_privilege('service_role', 'public.admin_audit_log', 'UPDATE') then
    raise exception 'admin_audit_log must be append-only (no UPDATE for the service role).';
  end if;

  -- Indexes.
  if (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'admin_audit_log'
        and indexname in ('admin_audit_log_created_at_idx', 'admin_audit_log_actor_created_at_idx', 'admin_audit_log_target_idx', 'admin_audit_log_action_created_at_idx')) <> 4 then
    raise exception 'admin_audit_log must keep its four read indexes.';
  end if;

  -- Constraints: slug-like action, known status, bounded text and jsonb.
  begin
    insert into public.admin_audit_log (actor_user_id, action, target_type, summary)
    values (gen_random_uuid(), 'Premium Grant', 'user', 'x');
    raise exception 'An action that is not a slug must be rejected.';
  exception when check_violation then null;
  end;
  begin
    insert into public.admin_audit_log (actor_user_id, action, target_type, summary, status)
    values (gen_random_uuid(), 'premium.grant', 'user', 'x', 'maybe');
    raise exception 'An unknown status must be rejected.';
  exception when check_violation then null;
  end;
  begin
    insert into public.admin_audit_log (actor_user_id, action, target_type, summary, error)
    values (gen_random_uuid(), 'premium.grant', 'user', 'x', repeat('x', 301));
    raise exception 'An error over 300 characters must be rejected.';
  exception when check_violation then null;
  end;
  begin
    insert into public.admin_audit_log (actor_user_id, action, target_type, summary, after)
    values (gen_random_uuid(), 'premium.grant', 'user', 'x', jsonb_build_object('blob', (select string_agg(md5(i::text), '') from generate_series(1, 2000) as i)));
    raise exception 'An oversized after document must be rejected.';
  exception when check_violation then null;
  end;

  -- Defaults and purge: rows older than 365 days only.
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, summary)
  values (gen_random_uuid(), 'premium.grant', 'user', 'u-1', 'Premium accordé');
  if not exists (select 1 from public.admin_audit_log where target_id = 'u-1' and status = 'ok' and created_at > now() - interval '1 minute') then
    raise exception 'A new row must default to status ok and the current time.';
  end if;
  insert into public.admin_audit_log (created_at, actor_user_id, action, target_type, target_id, summary)
  values
    (now() - interval '366 days', gen_random_uuid(), 'premium.grant', 'user', 'old-row', 'Ancienne action'),
    (now() - interval '364 days', gen_random_uuid(), 'premium.grant', 'user', 'recent-row', 'Action récente');
  v_purged := public.purge_admin_audit_log();
  if v_purged < 1 or exists (select 1 from public.admin_audit_log where created_at < now() - interval '365 days') then
    raise exception 'The purge must delete the rows older than 365 days.';
  end if;
  if not exists (select 1 from public.admin_audit_log where target_id = 'recent-row') then
    raise exception 'The purge must keep the rows of the last 365 days.';
  end if;

  -- The purge job.
  if not exists (select 1 from cron.job where jobname = 'admin-audit-log-purge' and schedule = '37 4 * * *') then
    raise exception 'The admin audit log purge job must be scheduled daily at 04:37 UTC.';
  end if;
end;
$$;

rollback;
