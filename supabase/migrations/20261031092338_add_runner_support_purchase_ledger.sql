create table if not exists public.runner_support_purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google')),
  product_id text not null check (length(btrim(product_id)) > 0),
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled', 'expired')),
  transaction_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index if not exists runner_support_purchase_intents_one_pending_user
  on public.runner_support_purchase_intents (user_id)
  where status = 'pending';

create unique index if not exists runner_support_purchase_intents_provider_transaction
  on public.runner_support_purchase_intents (provider, transaction_id)
  where transaction_id is not null;

create index if not exists runner_support_purchase_intents_expiry
  on public.runner_support_purchase_intents (expires_at)
  where status = 'pending';

create table if not exists public.runner_support_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google')),
  product_id text not null check (length(btrim(product_id)) > 0),
  transaction_id text not null check (length(btrim(transaction_id)) > 0),
  status text not null check (status in ('active', 'refunded')),
  purchased_at timestamptz not null,
  latest_event_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, transaction_id)
);

create table if not exists public.runner_support_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google')),
  provider_event_id text not null check (length(btrim(provider_event_id)) > 0),
  product_id text not null check (length(btrim(product_id)) > 0),
  transaction_id text not null check (length(btrim(transaction_id)) > 0),
  transaction_status text not null check (transaction_status in ('active', 'refunded')),
  event_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists runner_support_events_transaction
  on public.runner_support_events (provider, transaction_id, event_at desc);

create index if not exists runner_support_events_user
  on public.runner_support_events (user_id, event_at desc);

alter table public.runner_support_purchase_intents enable row level security;
alter table public.runner_support_purchases enable row level security;
alter table public.runner_support_events enable row level security;

revoke all on table public.runner_support_purchase_intents from public, anon, authenticated;
revoke all on table public.runner_support_purchases from public, anon, authenticated;
revoke all on table public.runner_support_events from public, anon, authenticated;
grant select, insert, update, delete on table public.runner_support_purchase_intents to service_role;
grant select, insert, update, delete on table public.runner_support_purchases to service_role;
grant select, insert on table public.runner_support_events to service_role;

create or replace function public.record_runner_support_event(
  p_user_id uuid,
  p_provider text,
  p_product_id text,
  p_transaction_id text,
  p_status text,
  p_purchased_at timestamptz,
  p_event_at timestamptz,
  p_event_id text
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
      user_id, provider, product_id, transaction_id, status, purchased_at, latest_event_at
    ) values (
      p_user_id, p_provider, p_product_id, p_transaction_id, p_status, p_purchased_at, p_event_at
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

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

create or replace function public.claim_runner_support_purchase(
  p_user_id uuid,
  p_provider text,
  p_product_id text,
  p_transaction_id text,
  p_purchased_at timestamptz,
  p_intent_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_intent public.runner_support_purchase_intents%rowtype;
  recorded boolean;
  effective_status text;
begin
  if p_intent_id is not null then
    select * into purchase_intent
    from public.runner_support_purchase_intents
    where id = p_intent_id
    for update;

    if not found
       or purchase_intent.user_id <> p_user_id
       or purchase_intent.provider <> p_provider
       or purchase_intent.product_id <> p_product_id
       or purchase_intent.status not in ('pending', 'fulfilled')
       or purchase_intent.created_at > p_purchased_at
       or purchase_intent.expires_at < p_purchased_at
       or (purchase_intent.transaction_id is not null and purchase_intent.transaction_id <> p_transaction_id) then
      return false;
    end if;
  end if;

  recorded := public.record_runner_support_event(
    p_user_id,
    p_provider,
    p_product_id,
    p_transaction_id,
    'active',
    p_purchased_at,
    p_purchased_at,
    'sync:' || p_provider || ':' || p_transaction_id
  );

  if not recorded then
    return false;
  end if;

  select status into effective_status
  from public.runner_support_purchases
  where user_id = p_user_id
    and provider = p_provider
    and product_id = p_product_id
    and transaction_id = p_transaction_id;

  if effective_status is distinct from 'active' then
    return false;
  end if;

  if p_intent_id is not null then
    update public.runner_support_purchase_intents
    set status = 'fulfilled',
        transaction_id = p_transaction_id,
        updated_at = now()
    where id = p_intent_id;
  end if;

  return true;
end;
$$;

revoke all on function public.record_runner_support_event(uuid, text, text, text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.claim_runner_support_purchase(uuid, text, text, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.record_runner_support_event(uuid, text, text, text, text, timestamptz, timestamptz, text) to service_role;
grant execute on function public.claim_runner_support_purchase(uuid, text, text, text, timestamptz, uuid) to service_role;
