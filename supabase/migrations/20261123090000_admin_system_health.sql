-- Admin console, lot 3 (« Santé des systèmes »): what the console reads to say whether the
-- scheduled tasks, the e-mails and the payments work. Service role only; nothing here is reachable
-- by a client role.
--
-- 1. public.admin_cron_job_status(): one row per pg_cron job (name, schedule, active, last run from
--    cron.job_run_details, failures in the last 24 h). The job command is never returned: some
--    commands embed a secret (push-reminders, organizer-import-cleanup).
-- 2. public.admin_pg_net_response_summary(): HTTP responses kept by pg_net (net._http_response, about
--    6 h): total, errors, latest error. pg_net stores neither the URL nor the cron job of a response,
--    so a status code cannot be tied to a job: the console shows this summary for all jobs together.
-- 3. public.transactional_email_log: one row per transactional e-mail attempt (date, category,
--    sent/skipped/failed, code, short message, masked recipient), written best-effort by
--    apps/web/lib/resend.ts. No content and no full address. Purged after 90 days by the pg_cron job
--    `transactional-email-log-purge` (daily 04:23 UTC, SQL only, no pg_net).

create extension if not exists pg_cron;

-- -------------------------------------------------------------------------------------------------
-- 1. Cron jobs and their last run

create or replace function public.admin_cron_job_status()
returns table (
  job_name text,
  schedule text,
  active boolean,
  last_start timestamptz,
  last_end timestamptz,
  last_status text,
  last_message text,
  runs_24h integer,
  failures_24h integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with recent as (
    select details.jobid, details.status
    from cron.job_run_details as details
    where details.start_time >= now() - interval '24 hours'
  )
  select
    job.jobname::text,
    job.schedule::text,
    job.active,
    last_run.start_time,
    last_run.end_time,
    last_run.status::text,
    left(last_run.return_message, 300),
    coalesce((select count(*) from recent where recent.jobid = job.jobid), 0)::integer,
    coalesce((select count(*) from recent where recent.jobid = job.jobid and recent.status = 'failed'), 0)::integer
  from cron.job as job
  left join lateral (
    select details.start_time, details.end_time, details.status, details.return_message
    from cron.job_run_details as details
    where details.jobid = job.jobid
    order by details.runid desc
    limit 1
  ) as last_run on true
  order by job.jobname;
$$;

revoke all on function public.admin_cron_job_status() from public, anon, authenticated;
grant execute on function public.admin_cron_job_status() to service_role;

-- -------------------------------------------------------------------------------------------------
-- 2. pg_net responses (all jobs together)

create or replace function public.admin_pg_net_response_summary()
returns table (
  available boolean,
  responses integer,
  errors integer,
  oldest_at timestamptz,
  last_error_at timestamptz,
  last_error_status integer,
  last_error_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regclass('net._http_response') is null then
    return query select false, 0, 0, null::timestamptz, null::timestamptz, null::integer, null::text;
    return;
  end if;

  -- Dynamic SQL: the function compiles even where pg_net is not installed.
  return query execute $query$
    with responses as (
      select response.created, response.status_code, response.timed_out, response.error_msg,
        (response.status_code is null or response.status_code >= 400 or coalesce(response.timed_out, false) or response.error_msg is not null) as failed
      from net._http_response as response
    ),
    last_error as (
      select responses.created, responses.status_code, responses.error_msg, responses.timed_out
      from responses
      where responses.failed
      order by responses.created desc
      limit 1
    )
    select
      true,
      (select count(*) from responses)::integer,
      (select count(*) from responses where responses.failed)::integer,
      (select min(responses.created) from responses),
      (select last_error.created from last_error),
      (select last_error.status_code from last_error),
      (select left(coalesce(last_error.error_msg, case when last_error.timed_out then 'timed out' end), 200) from last_error)
  $query$;
exception
  when insufficient_privilege then
    return query select false, 0, 0, null::timestamptz, null::timestamptz, null::integer, null::text;
end;
$$;

revoke all on function public.admin_pg_net_response_summary() from public, anon, authenticated;
grant execute on function public.admin_pg_net_response_summary() to service_role;

-- -------------------------------------------------------------------------------------------------
-- 3. Transactional e-mail log

create table if not exists public.transactional_email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  category text not null
    check (char_length(category) between 1 and 80 and category ~ '^[a-z0-9][a-z0-9/_-]*$'),
  status text not null check (status in ('sent', 'skipped', 'failed')),
  status_code integer check (status_code is null or status_code between 0 and 999),
  message text check (message is null or char_length(message) <= 300),
  recipient_masked text check (recipient_masked is null or char_length(recipient_masked) <= 120),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 100)
);

comment on table public.transactional_email_log is
  'One row per transactional e-mail attempt (Resend), written best-effort by apps/web/lib/resend.ts. No content, masked recipient only. Purged after 90 days.';

create index if not exists transactional_email_log_created_at_idx
  on public.transactional_email_log (created_at desc);
create index if not exists transactional_email_log_status_created_at_idx
  on public.transactional_email_log (status, created_at desc);

alter table public.transactional_email_log enable row level security;

revoke all on table public.transactional_email_log from public, anon, authenticated;
grant select, insert, delete on table public.transactional_email_log to service_role;

create or replace function public.purge_transactional_email_log()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.transactional_email_log
  where created_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_transactional_email_log() from public, anon, authenticated;
grant execute on function public.purge_transactional_email_log() to service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select job.jobid from cron.job as job where job.jobname = 'transactional-email-log-purge' loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'transactional-email-log-purge',
    '23 4 * * *',
    'select public.purge_transactional_email_log();'
  );
end;
$$;
