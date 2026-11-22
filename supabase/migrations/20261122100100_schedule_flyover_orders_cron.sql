-- Scheduler of the organizer flyover orders (/survol): pg_cron + pg_net call the protected Next
-- route every 10 minutes (Vercel crons are not called, see docs/context/DECISIONS.md 2026-11-21):
--   POST /api/cron/flyover-orders (follow renders in flight, then advance one step of one paid order).
--
-- Same Vault secrets as the social publishing job (`web_app_url`, `cron_secret` = the web
-- deployment CRON_SECRET), read at run time: this migration never fails and never copies a secret
-- into cron.job. A step can take a few minutes (AI text, voice), hence the 5-minute HTTP timeout.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.configure_flyover_orders_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id bigint;
begin
  for v_job_id in select job.jobid from cron.job as job where job.jobname = 'flyover-orders' loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'flyover-orders',
    '*/10 * * * *',
    $job$
      select net.http_post(
        url := rtrim(secrets.app_url, '/') || '/api/cron/flyover-orders',
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
    $job$
  );
end;
$$;

revoke all on function public.configure_flyover_orders_cron() from public, anon, authenticated;
grant execute on function public.configure_flyover_orders_cron() to service_role;

select public.configure_flyover_orders_cron();
