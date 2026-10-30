create extension if not exists "pgcrypto";

create table if not exists public.runner_plan_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null,
  plan_id uuid references public.race_plans(id) on delete set null,
  provider text not null check (provider in ('stripe', 'google', 'apple', 'admin')),
  provider_transaction_id text,
  status text not null default 'active' check (status in ('pending', 'active', 'refunded', 'revoked')),
  purchased_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_transaction_id)
);

create table if not exists public.runner_subscription_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'google', 'apple')),
  provider_subscription_id text not null,
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_subscription_id)
);

create table if not exists public.runner_billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_event_id)
);

create table if not exists public.runner_purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null,
  plan_id uuid references public.race_plans(id) on delete set null,
  provider text not null check (provider in ('stripe', 'google', 'apple')),
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'expired', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  fulfilled_at timestamptz
);

create table if not exists public.runner_monetization_config (
  id boolean primary key default true check (id = true),
  monetization_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);
insert into public.runner_monetization_config (id, monetization_enabled)
values (true, false) on conflict (id) do nothing;

create table if not exists public.runner_plan_history (
  plan_id uuid primary key references public.race_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null,
  detailed_access_granted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);
insert into public.runner_plan_history (plan_id, user_id, plan_key, detailed_access_granted)
select rp.id, rp.user_id,
  case when rp.race_id is null then 'plan:' || rp.id::text
    else 'race:' || rp.race_id::text || ':edition:' || coalesce(r.edition_id::text, 'legacy') end,
  true
from public.race_plans rp left join public.races r on r.id = rp.race_id
on conflict (plan_id) do nothing;

create table if not exists public.runner_admin_access_modes (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('real', 'free', 'premium')),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists runner_subscription_accounts_user_idx on public.runner_subscription_accounts(user_id, status);
create index if not exists runner_purchase_intents_user_idx on public.runner_purchase_intents(user_id, status);

create index if not exists runner_plan_unlocks_user_key_idx
  on public.runner_plan_unlocks(user_id, plan_key, status);
create index if not exists runner_plan_unlocks_plan_idx
  on public.runner_plan_unlocks(plan_id);

alter table public.runner_plan_unlocks enable row level security;
alter table public.runner_subscription_accounts enable row level security;
alter table public.runner_billing_events enable row level security;
alter table public.runner_purchase_intents enable row level security;
alter table public.runner_monetization_config enable row level security;
alter table public.runner_plan_history enable row level security;
alter table public.runner_admin_access_modes enable row level security;

create or replace function public.set_runner_plan_unlocks_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_runner_plan_unlocks_updated_at on public.runner_plan_unlocks;
create trigger set_runner_plan_unlocks_updated_at
before update on public.runner_plan_unlocks
for each row execute function public.set_runner_plan_unlocks_updated_at();

drop policy if exists "Users can read their runner plan unlocks" on public.runner_plan_unlocks;
create policy "Users can read their runner plan unlocks"
on public.runner_plan_unlocks for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages runner plan unlocks" on public.runner_plan_unlocks;
create policy "Service role manages runner plan unlocks"
on public.runner_plan_unlocks for all to service_role
using (true) with check (true);

create policy "Users can read their purchase intents" on public.runner_purchase_intents
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Service role manages runner purchase intents" on public.runner_purchase_intents
for all to service_role using (true) with check (true);
create policy "Service role manages runner subscriptions" on public.runner_subscription_accounts
for all to service_role using (true) with check (true);
create policy "Service role manages runner billing events" on public.runner_billing_events
for all to service_role using (true) with check (true);
create policy "Service role manages runner monetization config" on public.runner_monetization_config
for all to service_role using (true) with check (true);
create policy "Users can read own plan history" on public.runner_plan_history
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Service role manages plan history" on public.runner_plan_history
for all to service_role using (true) with check (true);
create policy "Service role manages admin access modes" on public.runner_admin_access_modes
for all to service_role using (true) with check (true);


-- Explicit privileges: RLS alone does not remove default schema grants.
revoke all on public.runner_plan_unlocks, public.runner_subscription_accounts,
  public.runner_billing_events, public.runner_purchase_intents,
  public.runner_monetization_config, public.runner_plan_history,
  public.runner_admin_access_modes from public, anon, authenticated;
grant select on public.runner_plan_unlocks, public.runner_plan_history, public.runner_purchase_intents to authenticated;
grant all on public.runner_plan_unlocks, public.runner_subscription_accounts,
  public.runner_billing_events, public.runner_purchase_intents,
  public.runner_monetization_config, public.runner_plan_history,
  public.runner_admin_access_modes to service_role;

create or replace function public.runner_session_mode(target_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select a.mode from public.runner_admin_access_modes a
    join auth.users u on u.id = a.user_id
    where a.user_id = target_user_id and a.session_id::text = (auth.jwt() ->> 'session_id')
    and (u.raw_app_meta_data ->> 'role' = 'admin' or coalesce(u.raw_app_meta_data -> 'roles', '[]'::jsonb) ? 'admin')
    and target_user_id = auth.uid()), 'real');
$$;

create or replace function public.runner_user_is_premium(target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare mode text;
begin
  if target_user_id is distinct from auth.uid() and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then return false; end if;
  mode := public.runner_session_mode(target_user_id);
  if mode = 'free' then return false; end if;
  if mode = 'premium' then return true; end if;
  return exists (select 1 from public.runner_subscription_accounts s where s.user_id = target_user_id
    and s.status in ('active', 'trialing') and s.current_period_end > now())
    or exists (select 1 from public.subscriptions s where s.user_id = target_user_id
      and s.status in ('active', 'trialing') and (s.current_period_end is null or s.current_period_end > now()))
    or exists (select 1 from public.user_profiles p where p.user_id = target_user_id and p.trial_ends_at > now())
    or exists (select 1 from public.premium_grants g where g.user_id = target_user_id and g.starts_at <= now()
      and coalesce(g.ends_at, g.starts_at + make_interval(days => g.initial_duration_days)) > now());
end;
$$;

create or replace function public.runner_plan_is_unlocked(target_plan_id uuid, target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare canonical_key text;
begin
  if target_user_id is distinct from auth.uid() and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then return false; end if;
  if not coalesce((select monetization_enabled from public.runner_monetization_config where id), false) then return true; end if;
  if public.runner_session_mode(target_user_id) = 'free' then return false; end if;
  if public.runner_user_is_premium(target_user_id) then return true; end if;
  select case when rp.race_id is not null then 'race:' || rp.race_id::text || ':edition:' || coalesce(r.edition_id::text, 'legacy') else 'plan:' || rp.id::text end
    into canonical_key from public.race_plans rp left join public.races r on r.id = rp.race_id
    where rp.id = target_plan_id and rp.user_id = target_user_id;
  return exists (select 1 from public.runner_plan_unlocks u where u.user_id = target_user_id and u.status = 'active'
    and (u.plan_id = target_plan_id or u.plan_key = canonical_key));
end;
$$;

create or replace function public.sanitize_runner_free_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare stations jsonb; canonical_key text; paid boolean;
begin
  if not coalesce((select monetization_enabled from public.runner_monetization_config where id), false) then return new; end if;
  -- Ownership transfers are server-only (guest conversion and source-race removal).
  if tg_op = 'UPDATE' and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if old.user_id is distinct from new.user_id or old.race_id is distinct from new.race_id then
      raise exception 'Plan ownership and course are immutable' using errcode = '42501';
    end if;
  end if;
  -- Trusted metadata/guest-merge writes must never erase an expired plan's work.
  if tg_op = 'UPDATE' and coalesce(auth.jwt() ->> 'role', '') = 'service_role' then return new; end if;
  canonical_key := case when new.race_id is null then 'plan:' || new.id::text else 'race:' || new.race_id::text || ':edition:' || coalesce((select edition_id::text from public.races where id = new.race_id), 'legacy') end;
  paid := public.runner_user_is_premium(new.user_id) or (public.runner_session_mode(new.user_id) <> 'free' and exists (
    select 1 from public.runner_plan_unlocks where user_id = new.user_id and status = 'active' and (plan_id = new.id or plan_key = canonical_key)));
  if not paid then
    new.planner_values := new.planner_values - 'segments' - 'sectionSegments' - 'finishPlan' - 'pauseOverrides' - 'startSupplies';
    if jsonb_typeof(new.planner_values -> 'aidStations') = 'array' then
      select coalesce(jsonb_agg(station - 'supplies' - 'nutrition' - 'pauseMinutes' - 'segmentMinutesOverride' - 'paceAdjustmentMinutesPerKm' - 'gelsPlanned' - 'pickupGels'), '[]'::jsonb)
        into stations from jsonb_array_elements(new.planner_values -> 'aidStations') station;
      new.planner_values := jsonb_set(new.planner_values, '{aidStations}', stations);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists sanitize_runner_free_plan on public.race_plans;
create trigger sanitize_runner_free_plan before insert or update on public.race_plans
for each row execute function public.sanitize_runner_free_plan();
-- Replace the earlier restrictive reassignment trigger; trusted guest merge and FK cleanup remain possible.
drop trigger if exists prevent_runner_race_reassignment on public.race_plans;

create or replace function public.record_runner_plan_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare canonical_key text; detailed boolean;
begin
  canonical_key := case when new.race_id is null then 'plan:' || new.id::text else 'race:' || new.race_id::text || ':edition:' || coalesce((select edition_id::text from public.races where id = new.race_id), 'legacy') end;
  -- Only subscription/trial/grant preparation earns post-expiry read access.
  -- A refunded one-time purchase must not retain access through this history.
  detailed := not coalesce((select monetization_enabled from public.runner_monetization_config where id), false)
    or public.runner_user_is_premium(new.user_id);
  -- Simulated access must never create durable paid history.
  if public.runner_session_mode(new.user_id) <> 'real' then detailed := false; end if;
  insert into public.runner_plan_history(plan_id, user_id, plan_key, detailed_access_granted)
    values (new.id, new.user_id, canonical_key, detailed)
    on conflict (plan_id) do update set user_id = excluded.user_id, plan_key = excluded.plan_key,
      detailed_access_granted = public.runner_plan_history.detailed_access_granted or excluded.detailed_access_granted;
  return new;
end;
$$;
drop trigger if exists record_runner_plan_history on public.race_plans;
create trigger record_runner_plan_history after insert or update on public.race_plans
for each row execute function public.record_runner_plan_history();

revoke all on function public.runner_session_mode(uuid), public.runner_user_is_premium(uuid),
  public.runner_plan_is_unlocked(uuid, uuid), public.sanitize_runner_free_plan(),
  public.record_runner_plan_history(), public.set_runner_plan_unlocks_updated_at() from public, anon, authenticated;
-- The owner-checked predicate is the only public function required by RLS.
grant execute on function public.runner_plan_is_unlocked(uuid, uuid) to authenticated, service_role;

drop policy if exists "Users can update their race plans" on public.race_plans;
create policy "Users can update their race plans" on public.race_plans for update to authenticated
using ((select auth.uid()) = user_id and public.runner_plan_is_unlocked(id, auth.uid()))
with check ((select auth.uid()) = user_id and public.runner_plan_is_unlocked(id, auth.uid()));

create or replace function public.runner_can_create_plan(target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if target_user_id is distinct from auth.uid() or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then return false; end if;
  if not coalesce((select monetization_enabled from public.runner_monetization_config where id), false) then return true; end if;
  return exists (select 1 from public.user_profiles p where p.user_id = target_user_id
    and nullif(trim(p.full_name), '') is not null and p.comfortable_flat_pace_min_per_km > 0
    and p.water_bag_liters >= 0 and p.default_carbs_g_per_hour >= 0);
end;
$$;
revoke all on function public.runner_can_create_plan(uuid) from public, anon, authenticated;
grant execute on function public.runner_can_create_plan(uuid) to authenticated;
create policy "Runner creation requires an identified account" on public.race_plans as restrictive for insert to authenticated
with check (public.runner_can_create_plan(user_id));
