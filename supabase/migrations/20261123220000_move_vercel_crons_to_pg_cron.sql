-- Scheduled tasks the admin console showed in error (2026-11-23):
--
-- 1. `trial-reminder-j0` / `trial-reminder-j3`: created by hand in the dashboard (never in a migration),
--    they call `extensions.http_post(...)`, which does not exist on this database, so every run fails.
--    They sent the end-of-trial reminders, but automatic runner trials were stopped on 2026-10-30
--    (20261030115828_stop_automatic_runner_trials.sql) and no trial is active any more: removed.
--
-- 2. `revenuecat-reconciliation` and `tracedetrail-catalog-enrichment` were declared as Vercel crons,
--    which Vercel never calls in production (docs/context/DECISIONS.md 2026-11-21). They move to
--    pg_cron + pg_net like the other jobs, with the same Vault secrets (`web_app_url`, `cron_secret` =
--    the web CRON_SECRET) read at run time: this migration never fails and never copies a secret into
--    cron.job. Both routes accept POST and allow up to 5 minutes, hence the HTTP timeout.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select job.jobid from cron.job as job where job.jobname in ('trial-reminder-j0', 'trial-reminder-j3')
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

create or replace function public.configure_daily_web_cron(p_job_name text, p_schedule text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id bigint;
begin
  for v_job_id in select job.jobid from cron.job as job where job.jobname = p_job_name loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    p_job_name,
    p_schedule,
    format(
      $job$
        select net.http_post(
          url := rtrim(secrets.app_url, '/') || %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || secrets.cron_secret
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 300000
        ) as request_id
        from (
          select
            (select ds.decrypted_secret from vault.decrypted_secrets as ds
              where ds.name = 'web_app_url' order by ds.created_at desc limit 1) as app_url,
            (select ds.decrypted_secret from vault.decrypted_secrets as ds
              where ds.name = 'cron_secret' order by ds.created_at desc limit 1) as cron_secret
        ) as secrets
        where secrets.app_url is not null and secrets.cron_secret is not null;
      $job$,
      p_path
    )
  );
end;
$$;

revoke all on function public.configure_daily_web_cron(text, text, text) from public, anon, authenticated;
grant execute on function public.configure_daily_web_cron(text, text, text) to service_role;

select public.configure_daily_web_cron('revenuecat-reconciliation', '17 3 * * *', '/api/cron/revenuecat-reconciliation');
select public.configure_daily_web_cron('tracedetrail-catalog-enrichment', '47 3 * * *', '/api/cron/tracedetrail-catalog-enrichment');
