-- Scheduler of the Instagram publishing state machine. Vercel Hobby runs its own crons once a
-- day only, so pg_cron + pg_net call the protected Next routes:
--   - every 5 minutes  POST /api/cron/social-posts-publish   (due posts, container polling)
--   - daily at 04:23   POST /api/cron/instagram-token-refresh (long-lived token refresh)
--
-- The jobs read the Vault secrets shared with the organizer import cleanup job (`web_app_url`,
-- `cron_secret` = the web deployment's CRON_SECRET) at run time, so this migration never fails and
-- never copies a secret into cron.job. Until both secrets exist the jobs run but send nothing.
-- One-time setup when they are missing (SQL editor, see docs/05-integrations/instagram-publishing.md):
--   select vault.create_secret('https://pace-yourself.com', 'web_app_url');
--   select vault.create_secret('<same value as the Vercel CRON_SECRET>', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.configure_social_publishing_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_job_id bigint;
begin
  for v_job in
    select *
    from (values
      ('social-posts-publish', '*/5 * * * *', '/api/cron/social-posts-publish'),
      ('instagram-token-refresh', '23 4 * * *', '/api/cron/instagram-token-refresh')
    ) as jobs(name, schedule, path)
  loop
    for v_job_id in select job.jobid from cron.job as job where job.jobname = v_job.name loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      v_job.name,
      v_job.schedule,
      format(
        $job$
          select net.http_post(
            url := rtrim(secrets.app_url, '/') || %L,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || secrets.cron_secret
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 60000
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
        v_job.path
      )
    );
  end loop;
end;
$$;

revoke all on function public.configure_social_publishing_cron() from public, anon, authenticated;
grant execute on function public.configure_social_publishing_cron() to service_role;

select public.configure_social_publishing_cron();
