-- Scheduler of the automatic carousels. Same pattern as the reel automation job: pg_cron + pg_net
-- call the protected Next route every hour at :47 (the reel job runs at :17, so a tick of each
-- never overlaps):
--   POST /api/cron/carousel-automation (refresh the slots, advance one step of one due item, track renders).
--
-- Same Vault secrets (`web_app_url`, `cron_secret`), read at run time: this migration never fails
-- and never copies a secret into cron.job. The content step makes one AI call, hence the 5-minute
-- HTTP timeout.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.configure_carousel_automation_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id bigint;
begin
  for v_job_id in select job.jobid from cron.job as job where job.jobname = 'carousel-automation' loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'carousel-automation',
    '47 * * * *',
    $job$
      select net.http_post(
        url := rtrim(secrets.app_url, '/') || '/api/cron/carousel-automation',
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

revoke all on function public.configure_carousel_automation_cron() from public, anon, authenticated;
grant execute on function public.configure_carousel_automation_cron() to service_role;

select public.configure_carousel_automation_cron();
