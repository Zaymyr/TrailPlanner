-- Admin console lot 7: journal of the admin actions.
--
-- public.admin_audit_log: one row per admin write (who, what, on which object, short French summary,
-- sanitized before/after, route, ok/error). Written best-effort by apps/web/lib/admin-audit-log.ts with
-- the service role, read by GET /api/admin/audit. Never a secret, a full e-mail address or the content
-- of a message. Purged after 365 days by the pg_cron job admin-audit-log-purge (plain SQL, no pg_net).

create extension if not exists pg_cron;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  actor_user_id uuid not null,
  actor_label text check (actor_label is null or char_length(actor_label) <= 120),
  action text not null
    check (char_length(action) between 3 and 80 and action ~ '^[a-z0-9][a-z0-9._-]*$'),
  target_type text not null
    check (char_length(target_type) between 1 and 60 and target_type ~ '^[a-z0-9][a-z0-9._-]*$'),
  target_id text check (target_id is null or char_length(target_id) <= 200),
  summary text not null check (char_length(summary) between 1 and 300),
  before jsonb,
  after jsonb,
  request_path text check (request_path is null or char_length(request_path) <= 200),
  status text not null default 'ok' check (status in ('ok', 'error')),
  error text check (error is null or char_length(error) <= 300),
  constraint admin_audit_log_before_size check (before is null or pg_column_size(before) <= 16384),
  constraint admin_audit_log_after_size check (after is null or pg_column_size(after) <= 16384)
);

comment on table public.admin_audit_log is
  'One row per admin write action, written best-effort by apps/web/lib/admin-audit-log.ts. No secret, no full e-mail address, no message content. actor_user_id is deliberately not a foreign key (the journal outlives the account). Purged after 365 days.';

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_created_at_idx
  on public.admin_audit_log (actor_user_id, created_at desc);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_type, target_id, created_at desc);
create index if not exists admin_audit_log_action_created_at_idx
  on public.admin_audit_log (action, created_at desc);

alter table public.admin_audit_log enable row level security;

revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select, insert, delete on table public.admin_audit_log to service_role;

create or replace function public.purge_admin_audit_log()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.admin_audit_log
  where created_at < now() - interval '365 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_admin_audit_log() from public, anon, authenticated;
grant execute on function public.purge_admin_audit_log() to service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select job.jobid from cron.job as job where job.jobname = 'admin-audit-log-purge' loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'admin-audit-log-purge',
    '37 4 * * *',
    'select public.purge_admin_audit_log();'
  );
end;
$$;
