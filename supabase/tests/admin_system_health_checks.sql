-- Admin console system health checks (lot 3).
-- Run in a privileged SQL session after 20261123090000_admin_system_health.sql.
-- Every data mutation is rolled back.

begin;

do $$
declare
  v_row record;
  v_count integer;
  v_purged integer;
begin
  -- Functions: SECURITY DEFINER, fixed search_path, service role only.
  for v_row in
    select procedure_row.proname, procedure_row.prosecdef, procedure_row.proconfig
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname in ('admin_cron_job_status', 'admin_pg_net_response_summary', 'purge_transactional_email_log')
  loop
    if not v_row.prosecdef then
      raise exception '% must be SECURITY DEFINER.', v_row.proname;
    end if;
    if v_row.proconfig is null or not exists (select 1 from unnest(v_row.proconfig) as setting where setting like 'search_path=%') then
      raise exception '% must set its search_path.', v_row.proname;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.admin_cron_job_status()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.admin_cron_job_status()', 'EXECUTE')
    or has_function_privilege('anon', 'public.admin_pg_net_response_summary()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.admin_pg_net_response_summary()', 'EXECUTE')
    or has_function_privilege('anon', 'public.purge_transactional_email_log()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.purge_transactional_email_log()', 'EXECUTE') then
    raise exception 'Client roles must not execute the system health functions.';
  end if;
  if not has_function_privilege('service_role', 'public.admin_cron_job_status()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.admin_pg_net_response_summary()', 'EXECUTE') then
    raise exception 'The service role must read the system health functions.';
  end if;

  -- One row per cron job, the purge job included; the command is never returned.
  select count(*) into v_count from public.admin_cron_job_status();
  if v_count <> (select count(*) from cron.job) then
    raise exception 'admin_cron_job_status must return one row per cron job.';
  end if;
  if not exists (select 1 from public.admin_cron_job_status() where job_name = 'transactional-email-log-purge' and schedule = '23 4 * * *') then
    raise exception 'The transactional e-mail log purge job must be scheduled daily at 04:23 UTC.';
  end if;
  if exists (
    select 1 from information_schema.routines as routine
    join information_schema.parameters as parameter on parameter.specific_name = routine.specific_name
    where routine.routine_schema = 'public' and routine.routine_name = 'admin_cron_job_status' and parameter.parameter_name = 'command'
  ) then
    raise exception 'admin_cron_job_status must not return the job command.';
  end if;

  -- The pg_net summary answers even without pg_net (available = false).
  perform * from public.admin_pg_net_response_summary();

  -- Log table: RLS on, no policy, no client privilege.
  if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'transactional_email_log') then
    raise exception 'transactional_email_log must have RLS enabled.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactional_email_log') then
    raise exception 'transactional_email_log must have no client policy.';
  end if;
  if has_table_privilege('anon', 'public.transactional_email_log', 'SELECT')
    or has_table_privilege('anon', 'public.transactional_email_log', 'INSERT')
    or has_table_privilege('authenticated', 'public.transactional_email_log', 'SELECT')
    or has_table_privilege('authenticated', 'public.transactional_email_log', 'INSERT')
    or has_table_privilege('authenticated', 'public.transactional_email_log', 'DELETE') then
    raise exception 'Client roles must not access transactional_email_log.';
  end if;
  if not has_table_privilege('service_role', 'public.transactional_email_log', 'SELECT,INSERT,DELETE') then
    raise exception 'The service role must manage transactional_email_log.';
  end if;

  -- Constraints: known statuses, slug-like categories, bounded message.
  begin
    insert into public.transactional_email_log (category, status) values ('flyover/paid', 'bounced');
    raise exception 'An unknown status must be rejected.';
  exception when check_violation then null;
  end;
  begin
    insert into public.transactional_email_log (category, status) values ('Flyover Paid!', 'sent');
    raise exception 'A category that is not a slug must be rejected.';
  exception when check_violation then null;
  end;
  begin
    insert into public.transactional_email_log (category, status, message) values ('flyover/paid', 'failed', repeat('x', 301));
    raise exception 'A message over 300 characters must be rejected.';
  exception when check_violation then null;
  end;

  -- Purge: rows older than 90 days only.
  insert into public.transactional_email_log (created_at, category, status, recipient_masked)
  values
    (now() - interval '91 days', 'flyover/paid', 'sent', 'fa***@gmail.com'),
    (now() - interval '89 days', 'flyover/paid', 'failed', 'fa***@gmail.com');
  v_purged := public.purge_transactional_email_log();
  if v_purged < 1 or exists (select 1 from public.transactional_email_log where created_at < now() - interval '90 days') then
    raise exception 'The purge must delete the rows older than 90 days.';
  end if;
  if not exists (select 1 from public.transactional_email_log where created_at > now() - interval '90 days' and recipient_masked = 'fa***@gmail.com') then
    raise exception 'The purge must keep the rows of the last 90 days.';
  end if;
end;
$$;

-- cron.job_run_details purge (reviewer finding): service role only, scheduled daily.
do $$
begin
  if has_function_privilege('authenticated', 'public.purge_cron_job_run_details()', 'EXECUTE')
    or has_function_privilege('anon', 'public.purge_cron_job_run_details()', 'EXECUTE') then
    raise exception 'Client roles must not purge cron.job_run_details.';
  end if;
  if not exists (select 1 from cron.job where jobname = 'cron-job-run-details-purge') then
    raise exception 'The cron.job_run_details purge job must be scheduled.';
  end if;
end;
$$;

rollback;
