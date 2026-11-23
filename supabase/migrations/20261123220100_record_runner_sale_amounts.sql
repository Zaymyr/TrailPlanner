-- Record the real sale amount of every runner purchase (App Store, Google Play, Stripe).
--
-- Amounts are what the customer paid, taxes included, in minor units of the purchase currency
-- (cents for EUR). Store rates come from RevenueCat (`takehome_percentage`, `tax_percentage`) and
-- only feed the admin « net estimé »; they are null for Stripe. Every column is nullable: rows
-- recorded before this migration without a stored payload keep no amount (« montant non suivi »).
-- Additive and idempotent; RLS and privileges unchanged (admin reads are server-side, service role).

-- ---------------------------------------------------------------------------------------------
-- Columns

alter table public.runner_billing_events
  add column if not exists amount_minor integer check (amount_minor >= 0),
  add column if not exists currency text check (currency ~ '^[A-Z]{3}$'),
  add column if not exists store_takehome_rate numeric check (store_takehome_rate >= 0 and store_takehome_rate <= 1),
  add column if not exists store_tax_rate numeric check (store_tax_rate >= 0 and store_tax_rate < 1);

alter table public.runner_plan_unlocks
  add column if not exists amount_minor integer check (amount_minor >= 0),
  add column if not exists currency text check (currency ~ '^[A-Z]{3}$'),
  add column if not exists store_takehome_rate numeric check (store_takehome_rate >= 0 and store_takehome_rate <= 1),
  add column if not exists store_tax_rate numeric check (store_tax_rate >= 0 and store_tax_rate < 1);

alter table public.runner_support_purchases
  add column if not exists amount_minor integer check (amount_minor >= 0),
  add column if not exists currency text check (currency ~ '^[A-Z]{3}$'),
  add column if not exists store_takehome_rate numeric check (store_takehome_rate >= 0 and store_takehome_rate <= 1),
  add column if not exists store_tax_rate numeric check (store_tax_rate >= 0 and store_tax_rate < 1);

-- A subscription account is one row per subscription: it keeps its latest charged period only.
-- Each charge (initial purchase, renewal) stays in `runner_billing_events`.
alter table public.runner_subscription_accounts
  add column if not exists last_amount_minor integer check (last_amount_minor >= 0),
  add column if not exists last_currency text check (last_currency ~ '^[A-Z]{3}$'),
  add column if not exists last_charged_at timestamptz,
  add column if not exists last_store_takehome_rate numeric check (last_store_takehome_rate >= 0 and last_store_takehome_rate <= 1),
  add column if not exists last_store_tax_rate numeric check (last_store_tax_rate >= 0 and last_store_tax_rate < 1);

-- ---------------------------------------------------------------------------------------------
-- Backfill from the journaled provider payloads (only what the providers actually sent)

-- Minor units per major unit of an ISO 4217 currency (2 decimals unless listed).
create or replace function public.runner_currency_minor_factor(p_currency text)
returns integer language sql immutable set search_path = public, pg_temp as $$
  select case
    when upper(p_currency) in ('BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF') then 1
    when upper(p_currency) in ('BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND') then 1000
    else 100
  end;
$$;
revoke all on function public.runner_currency_minor_factor(text) from public, anon, authenticated;
grant execute on function public.runner_currency_minor_factor(text) to service_role;

-- RevenueCat events: the stored payload is the webhook envelope `{ api_version, event: {...} }`.
-- `price_in_purchased_currency` is the TTC price in the purchase currency (major units).
-- Numbers are read through CASE so a non-numeric value can never reach a cast.
update public.runner_billing_events as e
set amount_minor = round(p.price * public.runner_currency_minor_factor(p.currency))::integer,
    currency = upper(p.currency),
    store_takehome_rate = case when p.takehome >= 0 and p.takehome <= 1 then p.takehome end,
    store_tax_rate = case when p.tax >= 0 and p.tax < 1 then p.tax end
from (
  select id,
    case when jsonb_typeof(payload -> 'event' -> 'price_in_purchased_currency') = 'number'
      then (payload -> 'event' ->> 'price_in_purchased_currency')::numeric end as price,
    case when jsonb_typeof(payload -> 'event' -> 'currency') = 'string'
      then payload -> 'event' ->> 'currency' end as currency,
    case when jsonb_typeof(payload -> 'event' -> 'takehome_percentage') = 'number'
      then (payload -> 'event' ->> 'takehome_percentage')::numeric end as takehome,
    case when jsonb_typeof(payload -> 'event' -> 'tax_percentage') = 'number'
      then (payload -> 'event' ->> 'tax_percentage')::numeric end as tax
  from public.runner_billing_events
  where amount_minor is null
    and provider in ('apple', 'google')
    and event_type in ('NON_RENEWING_PURCHASE', 'INITIAL_PURCHASE', 'RENEWAL')
) as p
where e.id = p.id
  and p.price > 0
  and coalesce(p.currency, '') ~ '^[A-Za-z]{3}$';

-- Stripe runner course Checkout events: the stored payload is the whole Stripe event.
update public.runner_billing_events as e
set amount_minor = p.amount_total::integer,
    currency = upper(p.currency)
from (
  select id,
    case when jsonb_typeof(payload -> 'data' -> 'object' -> 'amount_total') = 'number'
      then payload -> 'data' -> 'object' ->> 'amount_total' end as amount_total,
    case when jsonb_typeof(payload -> 'data' -> 'object' -> 'currency') = 'string'
      then payload -> 'data' -> 'object' ->> 'currency' end as currency
  from public.runner_billing_events
  where amount_minor is null
    and provider = 'stripe'
    and event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
) as p
where e.id = p.id
  and coalesce(p.amount_total, '') ~ '^[0-9]{1,9}$'
  and coalesce(p.currency, '') ~ '^[A-Za-z]{3}$';

-- Course unlocks: the earliest charged event of the same provider transaction.
update public.runner_plan_unlocks as u
set amount_minor = e.amount_minor,
    currency = e.currency,
    store_takehome_rate = e.store_takehome_rate,
    store_tax_rate = e.store_tax_rate
from (
  select distinct on (provider, transaction_id)
    provider, transaction_id, amount_minor, currency, store_takehome_rate, store_tax_rate
  from public.runner_billing_events
  where amount_minor is not null and transaction_id is not null
  order by provider, transaction_id, event_at asc, received_at asc
) as e
where u.amount_minor is null
  and u.provider = e.provider
  and u.provider_transaction_id = e.transaction_id;

-- ---------------------------------------------------------------------------------------------
-- Course claim: same signature and rules; a claimed unlock copies the charge journaled for its
-- provider transaction (webhooks journal before claiming; a client sync claim finds it when the
-- webhook came first, otherwise the webhook fills the unlock afterwards).

create or replace function public.claim_runner_plan_unlock(
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

  update public.runner_plan_unlocks as u
    set amount_minor = e.amount_minor,
        currency = e.currency,
        store_takehome_rate = e.store_takehome_rate,
        store_tax_rate = e.store_tax_rate
    from (
      select amount_minor, currency, store_takehome_rate, store_tax_rate
        from public.runner_billing_events
        where provider = p_provider and transaction_id = p_transaction_id and amount_minor is not null
        order by event_at asc, received_at asc
        limit 1
    ) as e
    where u.provider = p_provider and u.provider_transaction_id = p_transaction_id and u.amount_minor is null;

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

revoke all on function public.claim_runner_plan_unlock(uuid, uuid, text, text, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.claim_runner_plan_unlock(uuid, uuid, text, text, text, timestamptz, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Support event: four optional trailing amount parameters (default null). The old 8-argument
-- signature is dropped so named and positional 8-argument calls (RevenueCat webhook,
-- `claim_runner_support_purchase`) resolve to this one without ambiguity. An amount never blocks
-- the purchase: invalid values are ignored, and a known amount is never overwritten.

drop function if exists public.record_runner_support_event(uuid, text, text, text, text, timestamptz, timestamptz, text);

create or replace function public.record_runner_support_event(
  p_user_id uuid,
  p_provider text,
  p_product_id text,
  p_transaction_id text,
  p_status text,
  p_purchased_at timestamptz,
  p_event_at timestamptz,
  p_event_id text,
  p_amount_minor integer default null,
  p_currency text default null,
  p_store_takehome_rate numeric default null,
  p_store_tax_rate numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_purchase public.runner_support_purchases%rowtype;
  existing_event public.runner_support_events%rowtype;
  has_existing boolean;
  v_amount integer;
  v_currency text;
  v_takehome numeric;
  v_tax numeric;
begin
  if p_user_id is null
     or p_provider not in ('apple', 'google')
     or nullif(btrim(p_product_id), '') is null
     or nullif(btrim(p_transaction_id), '') is null
     or p_status not in ('active', 'refunded')
     or p_purchased_at is null
     or p_event_at is null
     or nullif(btrim(p_event_id), '') is null then
    return false;
  end if;

  if p_amount_minor is not null and p_amount_minor >= 0 and upper(coalesce(p_currency, '')) ~ '^[A-Z]{3}$' then
    v_amount := p_amount_minor;
    v_currency := upper(p_currency);
    v_takehome := case when p_store_takehome_rate between 0 and 1 then p_store_takehome_rate end;
    v_tax := case when p_store_tax_rate >= 0 and p_store_tax_rate < 1 then p_store_tax_rate end;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('runner-support-user:' || p_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('runner-support-transaction:' || p_provider || ':' || p_transaction_id, 0));

  select * into existing_purchase
  from public.runner_support_purchases
  where user_id = p_user_id
     or (provider = p_provider and transaction_id = p_transaction_id)
  order by (user_id = p_user_id) desc
  limit 1
  for update;

  has_existing := found;

  if has_existing and (
    existing_purchase.user_id <> p_user_id
    or existing_purchase.provider <> p_provider
    or existing_purchase.product_id <> p_product_id
    or existing_purchase.transaction_id <> p_transaction_id
  ) then
    return false;
  end if;

  select * into existing_event
  from public.runner_support_events
  where provider = p_provider
    and provider_event_id = p_event_id;

  if found and (
    existing_event.user_id <> p_user_id
    or existing_event.product_id <> p_product_id
    or existing_event.transaction_id <> p_transaction_id
    or existing_event.transaction_status <> p_status
    or existing_event.event_at <> p_event_at
  ) then
    return false;
  end if;

  insert into public.runner_support_events (
    user_id, provider, provider_event_id, product_id, transaction_id, transaction_status, event_at
  ) values (
    p_user_id, p_provider, p_event_id, p_product_id, p_transaction_id, p_status, p_event_at
  )
  on conflict (provider, provider_event_id) do nothing;

  if not has_existing then
    insert into public.runner_support_purchases (
      user_id, provider, product_id, transaction_id, status, purchased_at, latest_event_at,
      amount_minor, currency, store_takehome_rate, store_tax_rate
    ) values (
      p_user_id, p_provider, p_product_id, p_transaction_id, p_status, p_purchased_at, p_event_at,
      v_amount, v_currency, v_takehome, v_tax
    );
    return true;
  end if;

  update public.runner_support_purchases
  set status = p_status,
      purchased_at = least(purchased_at, p_purchased_at),
      latest_event_at = p_event_at,
      updated_at = now()
  where id = existing_purchase.id
    and p_event_at >= latest_event_at;

  -- The charge is independent of event ordering: fill it once, whichever event carries it.
  if v_amount is not null then
    update public.runner_support_purchases
    set amount_minor = v_amount,
        currency = v_currency,
        store_takehome_rate = v_takehome,
        store_tax_rate = v_tax,
        updated_at = now()
    where id = existing_purchase.id
      and amount_minor is null;
  end if;

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.record_runner_support_event(uuid, text, text, text, text, timestamptz, timestamptz, text, integer, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.record_runner_support_event(uuid, text, text, text, text, timestamptz, timestamptz, text, integer, text, numeric, numeric) to service_role;

comment on column public.runner_plan_unlocks.amount_minor is 'Price paid by the customer, taxes included, minor units of currency; null = not tracked.';
comment on column public.runner_support_purchases.amount_minor is 'Price paid by the customer, taxes included, minor units of currency; null = not tracked.';
comment on column public.runner_subscription_accounts.last_amount_minor is 'Latest charged period, taxes included, minor units of last_currency; null = not tracked.';
comment on column public.runner_billing_events.amount_minor is 'Charge carried by this provider event, taxes included, minor units of currency; null = none.';
