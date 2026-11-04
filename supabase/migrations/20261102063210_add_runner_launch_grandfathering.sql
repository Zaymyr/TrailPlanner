alter table public.runner_monetization_config
  add column if not exists launched_at timestamptz,
  add column if not exists launch_popup_ends_at timestamptz;

create table if not exists public.runner_launch_grandfathered_plans (
  plan_id uuid primary key references public.race_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grandfathered_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists runner_launch_grandfathered_plans_user_idx
  on public.runner_launch_grandfathered_plans(user_id);

create table if not exists public.runner_launch_cohorts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  early_supporter boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.runner_launch_grandfathered_plans enable row level security;
alter table public.runner_launch_cohorts enable row level security;

drop policy if exists "Service manages launch grandfathering" on public.runner_launch_grandfathered_plans;
create policy "Service manages launch grandfathering"
on public.runner_launch_grandfathered_plans for all to service_role
using (true) with check (true);

drop policy if exists "Service manages launch cohorts" on public.runner_launch_cohorts;
create policy "Service manages launch cohorts"
on public.runner_launch_cohorts for all to service_role
using (true) with check (true);

revoke all on public.runner_launch_grandfathered_plans from public, anon, authenticated;
grant all on public.runner_launch_grandfathered_plans to service_role;
revoke all on public.runner_launch_cohorts from public, anon, authenticated;
grant all on public.runner_launch_cohorts to service_role;

-- This is the single production cutover operation. The table locks establish a
-- precise boundary: inserts that commit before the locks are included, while
-- inserts waiting behind them are post-launch plans. No timestamp supplied by a
-- client participates in the decision.
create or replace function public.activate_runner_launch()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  launch_time timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('pace_yourself_runner_launch', 0));

  select launched_at
    into launch_time
    from public.runner_monetization_config
    where id = true
    for update;

  if not found then
    raise exception 'Runner monetization configuration is missing';
  end if;
  if launch_time is not null then
    return launch_time;
  end if;

  lock table auth.users in share mode;
  lock table public.race_plans in share mode;
  launch_time := clock_timestamp();

  insert into public.runner_launch_grandfathered_plans(plan_id, user_id, grandfathered_at)
    select id, user_id, launch_time
    from public.race_plans
    on conflict (plan_id) do nothing;

  insert into public.runner_launch_cohorts(user_id, early_supporter)
    select id, true
    from auth.users
    where not coalesce(is_anonymous, false)
      and coalesce(raw_app_meta_data ->> 'provider', '') <> 'anonymous'
    on conflict (user_id) do nothing;

  update public.runner_monetization_config
    set monetization_enabled = true,
        launched_at = launch_time,
        launch_popup_ends_at = launch_time + interval '7 days',
        updated_at = launch_time
    where id = true;

  return launch_time;
end;
$$;

revoke all on function public.activate_runner_launch() from public, anon, authenticated;
grant execute on function public.activate_runner_launch() to service_role;

create or replace function public.runner_plan_is_unlocked(target_plan_id uuid, target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare canonical_key text;
begin
  if target_user_id is distinct from auth.uid() and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then return false; end if;
  if not coalesce((select monetization_enabled from public.runner_monetization_config where id), false) then return true; end if;
  if public.runner_session_mode(target_user_id) = 'free' then return false; end if;
  if exists (
    select 1 from public.runner_launch_grandfathered_plans grandfathered
    where grandfathered.plan_id = target_plan_id and grandfathered.user_id = target_user_id
  ) then return true; end if;
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
  if tg_op = 'UPDATE' and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if old.user_id is distinct from new.user_id or old.race_id is distinct from new.race_id then
      raise exception 'Plan ownership and course are immutable' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and coalesce(auth.jwt() ->> 'role', '') = 'service_role' then return new; end if;
  canonical_key := case when new.race_id is null then 'plan:' || new.id::text else 'race:' || new.race_id::text || ':edition:' || coalesce((select edition_id::text from public.races where id = new.race_id), 'legacy') end;
  paid := exists (
      select 1 from public.runner_launch_grandfathered_plans grandfathered
      where grandfathered.plan_id = new.id and grandfathered.user_id = new.user_id
    )
    or public.runner_user_is_premium(new.user_id)
    or (public.runner_session_mode(new.user_id) <> 'free' and exists (
      select 1 from public.runner_plan_unlocks where user_id = new.user_id and status = 'active' and (plan_id = new.id or plan_key = canonical_key)));
  if public.runner_session_mode(new.user_id) = 'free' then paid := false; end if;
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

-- Identified-account conversion transfers guest-owned plans with service-role
-- writes. Keep the exact snapshotted plan entitlement attached to its new owner.
create or replace function public.sync_runner_launch_grandfathered_plan_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.runner_launch_grandfathered_plans
    set user_id = new.user_id
    where plan_id = new.id and user_id = old.user_id;
  return new;
end;
$$;

drop trigger if exists sync_runner_launch_grandfathered_plan_owner on public.race_plans;
create trigger sync_runner_launch_grandfathered_plan_owner
after update of user_id on public.race_plans
for each row
when (old.user_id is distinct from new.user_id)
execute function public.sync_runner_launch_grandfathered_plan_owner();

revoke all on function public.runner_plan_is_unlocked(uuid, uuid),
  public.sanitize_runner_free_plan(),
  public.sync_runner_launch_grandfathered_plan_owner() from public, anon, authenticated;
grant execute on function public.runner_plan_is_unlocked(uuid, uuid) to authenticated, service_role;
