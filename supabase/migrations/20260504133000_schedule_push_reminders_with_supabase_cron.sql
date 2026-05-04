create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- Expected Vault secrets:
-- - project_url: https://<project-ref>.supabase.co
-- - anon_key: your project's anon key
-- - push_cron_secret: same value as the Edge Function secret PUSH_CRON_SECRET
create or replace function public.configure_push_reminders_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'push-reminders-daily';
  v_schedule constant text := '0 9 * * *';
  v_project_url text;
  v_anon_key text;
  v_cron_secret text;
  v_job_id bigint;
begin
  select ds.decrypted_secret
  into v_project_url
  from vault.decrypted_secrets as ds
  where ds.name = 'project_url'
  order by ds.created_at desc
  limit 1;

  select ds.decrypted_secret
  into v_anon_key
  from vault.decrypted_secrets as ds
  where ds.name = 'anon_key'
  order by ds.created_at desc
  limit 1;

  select ds.decrypted_secret
  into v_cron_secret
  from vault.decrypted_secrets as ds
  where ds.name = 'push_cron_secret'
  order by ds.created_at desc
  limit 1;

  if v_project_url is null or v_anon_key is null or v_cron_secret is null then
    raise notice
      'Skipping push reminder cron schedule because Vault secrets project_url, anon_key, or push_cron_secret are missing.';
    return;
  end if;

  v_project_url := rtrim(v_project_url, '/');

  for v_job_id in
    select job.jobid
    from cron.job as job
    where job.jobname = v_job_name
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    v_job_name,
    v_schedule,
    format(
      $job$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L,
            'x-cron-secret', %L
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 10000
        ) as request_id;
      $job$,
      v_project_url || '/functions/v1/push-reminders',
      v_anon_key,
      v_cron_secret
    )
  );
end;
$$;

select public.configure_push_reminders_cron();
