alter table public.runner_purchase_intents add column if not exists product_id text;
alter table public.runner_purchase_intents add column if not exists transaction_id text;
alter table public.runner_purchase_intents add column if not exists expires_at timestamptz
  not null default (timezone('utc', now()) + interval '1 day');
alter table public.runner_purchase_intents add column if not exists last_verified_at timestamptz;
alter table public.runner_purchase_intents add column if not exists failure_reason text;
alter table public.runner_purchase_intents add column if not exists store_started_at timestamptz;

-- A store sheet can outlive the app process. Keep exactly one durable pending
-- intent per user/store so a relaunch recovers the same binding rather than
-- creating a second plan candidate for one transaction.
create unique index if not exists runner_purchase_intents_pending_store_idx
  on public.runner_purchase_intents(user_id, provider)
  where status = 'pending';

create unique index if not exists runner_purchase_intents_provider_transaction_idx
  on public.runner_purchase_intents(provider, transaction_id)
  where transaction_id is not null;

alter table public.runner_billing_events add column if not exists transaction_id text;
alter table public.runner_billing_events add column if not exists transaction_status text
  check (transaction_status in ('active', 'refunded', 'revoked'));
alter table public.runner_billing_events add column if not exists event_at timestamptz
  not null default timezone('utc', now());
alter table public.runner_billing_events add column if not exists processed_at timestamptz;
alter table public.runner_billing_events add column if not exists processing_error text;

create index if not exists runner_billing_events_transaction_state_idx
  on public.runner_billing_events(provider, transaction_id, event_at desc, received_at desc)
  where transaction_id is not null and transaction_status is not null;


drop function if exists public.claim_runner_plan_unlock(uuid, uuid, text, text);

create function public.claim_runner_plan_unlock(
  p_user_id uuid,
  p_plan_id uuid,
  p_provider text,
  p_transaction_id text,
  p_product_id text default null,
  p_purchased_at timestamptz default timezone('utc', now()),
  p_intent_id uuid default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  existing public.runner_plan_unlocks;
  purchase_intent public.runner_purchase_intents;
  canonical_key text;
  latest_transaction_status text;
begin
  if p_provider not in ('stripe', 'google', 'apple') or nullif(trim(p_transaction_id), '') is null then
    return false;
  end if;

  -- Serialize every provider transaction, including a refund delivered before
  -- its purchase event.
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_transaction_id, 0));

  select case
      when rp.race_id is null then 'plan:' || rp.id::text
      else 'race:' || rp.race_id::text || ':edition:' || coalesce(r.edition_id::text, 'legacy')
    end
    into canonical_key
    from public.race_plans rp
    left join public.races r on r.id = rp.race_id
    where rp.id = p_plan_id and rp.user_id = p_user_id;
  if p_intent_id is not null then
    select * into purchase_intent
      from public.runner_purchase_intents
      where id = p_intent_id
      for update;
    if not found
      or purchase_intent.user_id <> p_user_id
      or (purchase_intent.plan_id is not null and purchase_intent.plan_id is distinct from p_plan_id)
      or purchase_intent.provider <> p_provider
      or purchase_intent.status not in ('pending', 'fulfilled')
      or (purchase_intent.transaction_id is not null and purchase_intent.transaction_id <> p_transaction_id)
      or (purchase_intent.product_id is not null and purchase_intent.product_id is distinct from p_product_id)
      or p_purchased_at < purchase_intent.created_at
      or (purchase_intent.status = 'pending' and p_purchased_at > purchase_intent.expires_at)
    then
      return false;
    end if;
    canonical_key := purchase_intent.plan_key;
  end if;
  if canonical_key is null then return false; end if;

  select transaction_status into latest_transaction_status
    from public.runner_billing_events
    where provider = p_provider and transaction_id = p_transaction_id
      and transaction_status is not null
    order by event_at desc, received_at desc
    limit 1;
  if latest_transaction_status in ('refunded', 'revoked') then return false; end if;

  select * into existing from public.runner_plan_unlocks
    where provider = p_provider and provider_transaction_id = p_transaction_id
    for update;
  if found then
    if existing.user_id <> p_user_id or existing.plan_key <> canonical_key or existing.status <> 'active' then
      return false;
    end if;
  else
    insert into public.runner_plan_unlocks(user_id, plan_key, plan_id, provider, provider_transaction_id, status, purchased_at)
      values (
        p_user_id,
        canonical_key,
        case when exists (select 1 from public.race_plans where id = p_plan_id and user_id = p_user_id) then p_plan_id else null end,
        p_provider,
        p_transaction_id,
        'active',
        p_purchased_at
      );
  end if;

  if p_intent_id is not null then
    update public.runner_purchase_intents
      set status = 'fulfilled', transaction_id = p_transaction_id,
          fulfilled_at = coalesce(fulfilled_at, timezone('utc', now())),
          last_verified_at = timezone('utc', now()), failure_reason = null,
          plan_key = canonical_key
      where id = p_intent_id;
  end if;
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.revoke_runner_payment_transaction(
  p_provider text,
  p_transaction_id text,
  p_status text default 'refunded'
) returns boolean language plpgsql security definer set search_path = public as $$
declare latest_transaction_status text;
begin
  if p_provider not in ('stripe', 'google', 'apple')
    or p_status not in ('refunded', 'revoked')
    or nullif(trim(p_transaction_id), '') is null
  then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_transaction_id, 0));
  select transaction_status into latest_transaction_status from public.runner_billing_events
    where provider = p_provider and transaction_id = p_transaction_id and transaction_status is not null
    order by event_at desc, received_at desc limit 1;
  -- A stale refund/dispute delivered after a newer reversal must not revoke again.
  if latest_transaction_status is null then return false; end if;
  if latest_transaction_status is distinct from p_status then return true; end if;
  update public.runner_plan_unlocks
    set status = p_status
    where provider = p_provider and provider_transaction_id = p_transaction_id
      and status in ('active', 'pending');
  return true;
end;
$$;

create or replace function public.restore_runner_payment_transaction(
  p_provider text,
  p_transaction_id text
) returns boolean language plpgsql security definer set search_path = public as $$
declare latest_transaction_status text;
begin
  if p_provider not in ('stripe', 'google', 'apple') or nullif(trim(p_transaction_id), '') is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_transaction_id, 0));
  select transaction_status into latest_transaction_status
    from public.runner_billing_events
    where provider = p_provider and transaction_id = p_transaction_id and transaction_status is not null
    order by event_at desc, received_at desc limit 1;
  if latest_transaction_status is distinct from 'active' then return false; end if;
  update public.runner_plan_unlocks set status = 'active'
    where provider = p_provider and provider_transaction_id = p_transaction_id and status in ('refunded', 'revoked');
  -- Duplicate reversals and reversal-before-purchase delivery are successful:
  -- the latest active journal state remains authoritative for a later claim.
  return true;
end;
$$;

revoke all on function public.claim_runner_plan_unlock(uuid, uuid, text, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.revoke_runner_payment_transaction(text, text, text) from public, anon, authenticated;
revoke all on function public.restore_runner_payment_transaction(text, text) from public, anon, authenticated;
grant execute on function public.claim_runner_plan_unlock(uuid, uuid, text, text, text, timestamptz, uuid) to service_role;
grant execute on function public.revoke_runner_payment_transaction(text, text, text) to service_role;
grant execute on function public.restore_runner_payment_transaction(text, text) to service_role;
