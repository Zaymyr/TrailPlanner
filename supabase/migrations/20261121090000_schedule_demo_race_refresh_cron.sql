-- Scheduler of the Trail TST demo refresh. The Vercel Cron declared in vercel.json never fired in
-- production (no call recorded from 2026-11-17 to 2026-11-21, demo stuck on 2026-11-18), so
-- pg_cron + pg_net call the protected Next route every hour at :05:
--   POST /api/cron/demo-race-refresh (move Trail TST to today's Paris date and republish it).
--
-- The route writes nothing when the demo is already on today, so the hourly cadence only costs a
-- few reads; it moves the demo within the first hour of each Paris day and retries by itself if a
-- run fails. Same Vault secrets as the social publishing job (`web_app_url`, `cron_secret` = the web
-- deployment's CRON_SECRET), read at run time: this migration never fails and never copies a secret
-- into cron.job. Until both secrets exist the job runs but sends nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.configure_demo_race_refresh_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id bigint;
begin
  for v_job_id in select job.jobid from cron.job as job where job.jobname = 'demo-race-refresh' loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'demo-race-refresh',
    '5 * * * *',
    $job$
      select net.http_post(
        url := rtrim(secrets.app_url, '/') || '/api/cron/demo-race-refresh',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || secrets.cron_secret
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      ) as request_id
      from (
        select
          (select ds.decrypted_secret from vault.decrypted_secrets as ds
            where ds.name = 'web_app_url' order by ds.created_at desc limit 1) as app_url,
          (select ds.decrypted_secret from vault.decrypted_secrets as ds
            where ds.name = 'cron_secret' order by ds.created_at desc limit 1) as cron_secret
      ) as secrets
      where secrets.app_url is not null and secrets.cron_secret is not null;
    $job$
  );
end;
$$;

revoke all on function public.configure_demo_race_refresh_cron() from public, anon, authenticated;
grant execute on function public.configure_demo_race_refresh_cron() to service_role;

select public.configure_demo_race_refresh_cron();
