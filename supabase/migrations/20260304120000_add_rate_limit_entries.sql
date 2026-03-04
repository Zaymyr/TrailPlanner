-- Persistent rate limit store for serverless/multi-instance environments.
-- Replaces the in-memory Map in lib/http.ts which resets on each cold start.

create table if not exists public.rate_limit_entries (
  key       text        primary key,
  count     integer     not null default 1,
  reset_at  timestamptz not null
);

-- Only the service role may read or modify rate limit entries.
alter table public.rate_limit_entries enable row level security;

-- Atomically increment the counter for a key and return the result.
-- Uses INSERT … ON CONFLICT to handle the upsert in a single statement,
-- avoiding a race condition between read and write.
create or replace function public.check_and_increment_rate_limit(
  p_key       text,
  p_limit     integer,
  p_window_ms integer
) returns table(allowed boolean, remaining integer, retry_after_ms bigint)
language plpgsql security definer as $$
declare
  v_now         timestamptz := now();
  v_reset_at    timestamptz := v_now + (p_window_ms * '1 millisecond'::interval);
  v_count       integer;
  v_entry_reset timestamptz;
begin
  insert into public.rate_limit_entries(key, count, reset_at)
    values (p_key, 1, v_reset_at)
  on conflict (key) do update
    set count    = case
                     when rate_limit_entries.reset_at <= v_now then 1
                     else rate_limit_entries.count + 1
                   end,
        reset_at = case
                     when rate_limit_entries.reset_at <= v_now then v_reset_at
                     else rate_limit_entries.reset_at
                   end
  returning rate_limit_entries.count, rate_limit_entries.reset_at
  into v_count, v_entry_reset;

  return query select
    (v_count <= p_limit)                                                        as allowed,
    greatest(0, p_limit - v_count)                                              as remaining,
    case
      when v_count > p_limit
        then (extract(epoch from (v_entry_reset - v_now)) * 1000)::bigint
      else 0::bigint
    end                                                                         as retry_after_ms;
end;
$$;

-- Helper to purge expired entries (run manually or via pg_cron).
create or replace function public.purge_expired_rate_limit_entries()
returns void language sql security definer as $$
  delete from public.rate_limit_entries where reset_at < now();
$$;
