-- Organizer offers v2 and opt-in RaceBook modules.

alter table public.organizer_edition_entitlements
  drop constraint if exists organizer_edition_entitlements_tier_check;

alter table public.organizer_edition_payments
  drop constraint if exists organizer_edition_payments_purchase_kind_check,
  drop constraint if exists organizer_edition_payments_from_tier_check,
  drop constraint if exists organizer_edition_payments_to_tier_check;

update public.organizer_edition_entitlements
set tier = case tier
  when 'racebook' then 'complete'
  when 'pro' then 'signature'
  else tier
end,
updated_at = timezone('utc', now())
where tier in ('racebook', 'pro');

alter table public.organizer_edition_entitlements
  add constraint organizer_edition_entitlements_tier_check
  check (tier in ('visibility', 'essential', 'complete', 'signature'));

alter table public.organizer_edition_payments
  add constraint organizer_edition_payments_purchase_kind_check check (
    purchase_kind in (
      'racebook', 'pro_direct', 'pro_upgrade',
      'essential_direct', 'complete_direct', 'signature_direct',
      'essential_to_complete', 'essential_to_signature', 'complete_to_signature'
    )
  ),
  add constraint organizer_edition_payments_from_tier_check check (
    from_tier in ('visibility', 'racebook', 'essential', 'complete')
  ),
  add constraint organizer_edition_payments_to_tier_check check (
    to_tier in ('racebook', 'pro', 'essential', 'complete', 'signature')
  );

alter table public.race_event_editions
  add column if not exists module_setup_completed_at timestamptz;

create table public.organizer_racebook_module_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  race_id uuid references public.races(id) on delete cascade,
  module_key text not null,
  is_enabled boolean not null default false,
  configured_by uuid references auth.users(id) on delete set null,
  constraint organizer_racebook_module_settings_scope_check check (
    (race_id is null and module_key in ('equipment', 'bib_pickup', 'access', 'services', 'branding', 'sponsors'))
    or
    (race_id is not null and module_key in ('aid_stations', 'start_waves', 'awards', 'relay', 'official_products'))
  )
);

create unique index organizer_racebook_module_settings_edition_key_idx
  on public.organizer_racebook_module_settings (edition_id, module_key)
  where race_id is null;

create unique index organizer_racebook_module_settings_race_key_idx
  on public.organizer_racebook_module_settings (race_id, module_key)
  where race_id is not null;

create index organizer_racebook_module_settings_edition_idx
  on public.organizer_racebook_module_settings (edition_id);

alter table public.organizer_racebook_module_settings enable row level security;
revoke all on table public.organizer_racebook_module_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.organizer_racebook_module_settings to service_role;

create or replace function public.validate_organizer_racebook_module_setting()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.race_id is not null and not exists (
    select 1 from public.races race_row
    where race_row.id = new.race_id and race_row.edition_id = new.edition_id
  ) then
    raise exception 'Race does not belong to the selected edition.';
  end if;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger validate_organizer_racebook_module_setting_trigger
before insert or update on public.organizer_racebook_module_settings
for each row execute function public.validate_organizer_racebook_module_setting();

create or replace function public.initialize_organizer_edition_modules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
  values
    (new.id, 'equipment', true),
    (new.id, 'bib_pickup', true),
    (new.id, 'access', true)
  on conflict do nothing;
  return new;
end;
$$;

create trigger initialize_organizer_edition_modules_trigger
after insert on public.race_event_editions
for each row execute function public.initialize_organizer_edition_modules();

create or replace function public.initialize_organizer_race_modules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.edition_id is not null then
    insert into public.organizer_racebook_module_settings (edition_id, race_id, module_key, is_enabled)
    values (new.edition_id, new.id, 'aid_stations', true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger initialize_organizer_race_modules_trigger
after insert or update of edition_id on public.races
for each row execute function public.initialize_organizer_race_modules();

-- Preserve the legacy four-tab RaceBook experience and infer optional modules
-- from durable content before activation controls become visible.
insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
select edition_row.id, module_key, true
from public.race_event_editions edition_row
cross join unnest(array['equipment', 'bib_pickup', 'access']::text[]) module_key
on conflict do nothing;

insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
select distinct edition_row.id, 'services', true
from public.race_event_editions edition_row
join public.race_edition_services service_row on service_row.edition_id = edition_row.id
on conflict do nothing;

insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
select distinct sponsor_row.edition_id, 'sponsors', true
from public.race_event_edition_sponsors sponsor_row
on conflict do nothing;

insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
select branding_row.edition_id, 'branding', true
from public.race_event_edition_branding branding_row
on conflict do nothing;

insert into public.organizer_racebook_module_settings (edition_id, race_id, module_key, is_enabled)
select race_row.edition_id, race_row.id, 'aid_stations', true
from public.races race_row
where race_row.edition_id is not null
on conflict do nothing;

insert into public.organizer_racebook_module_settings (edition_id, race_id, module_key, is_enabled)
select distinct race_row.edition_id, race_row.id, inferred.module_key, true
from public.races race_row
cross join lateral (
  select 'start_waves'::text as module_key where exists (select 1 from public.race_start_waves row_value where row_value.race_id = race_row.id)
  union all select 'awards' where exists (select 1 from public.race_awards row_value where row_value.race_id = race_row.id)
  union all select 'relay' where race_row.participation_mode in ('relay', 'solo_and_relay')
    or exists (select 1 from public.race_relay_points row_value where row_value.race_id = race_row.id)
  union all select 'official_products' where exists (
    select 1 from public.race_aid_station_products product_link
    join public.race_aid_stations station_row on station_row.id = product_link.race_aid_station_id
    where station_row.race_id = race_row.id
  )
) inferred
where race_row.edition_id is not null
on conflict do nothing;

update public.race_event_editions
set module_setup_completed_at = coalesce(module_setup_completed_at, timezone('utc', now()));

create or replace function private.organizer_tier_rank(p_tier text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_tier
    when 'signature' then 3
    when 'complete' then 2
    when 'essential' then 1
    else 0
  end;
$$;

create or replace function private.racebook_module_is_enabled(p_race_id uuid, p_module_key text)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.races race_row
    join public.organizer_edition_entitlements entitlement_row on entitlement_row.edition_id = race_row.edition_id
    join public.organizer_racebook_module_settings setting_row
      on setting_row.edition_id = race_row.edition_id
      and setting_row.module_key = p_module_key
      and (setting_row.race_id = race_row.id or setting_row.race_id is null)
    where race_row.id = p_race_id
      and setting_row.is_enabled
      and entitlement_row.status = 'active'
      and private.organizer_tier_rank(entitlement_row.tier) >= case p_module_key
        when 'start_waves' then 2
        when 'awards' then 2
        when 'services' then 2
        when 'relay' then 3
        when 'official_products' then 3
        when 'sponsors' then 3
        when 'branding' then 3
        else 1
      end
  );
$$;

create or replace function private.organizer_edition_is_pro(p_edition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organizer_edition_entitlements entitlement_row
    where entitlement_row.edition_id = p_edition_id
      and entitlement_row.status = 'active'
      and entitlement_row.tier = 'signature'
  );
$$;

create or replace function public.recalculate_organizer_edition_entitlement(p_edition_id uuid)
returns public.organizer_edition_entitlements
language plpgsql
security invoker
set search_path = public
as $$
declare
  entitlement_row public.organizer_edition_entitlements;
  next_tier text := 'visibility';
  has_essential boolean := false;
  has_complete boolean := false;
  has_signature boolean := false;
begin
  select * into entitlement_row
  from public.organizer_edition_entitlements
  where edition_id = p_edition_id
  for update;

  if entitlement_row.id is null then
    insert into public.organizer_edition_entitlements (edition_id)
    values (p_edition_id)
    returning * into entitlement_row;
  end if;

  if entitlement_row.status = 'active' and entitlement_row.source in ('admin', 'legacy_admin') then
    return entitlement_row;
  end if;

  select exists (
    select 1 from public.organizer_edition_payments
    where edition_id = p_edition_id and status = 'paid'
      and purchase_kind = 'essential_direct'
  ) into has_essential;

  select
    exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind in ('complete_direct', 'racebook'))
    or (has_essential and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'essential_to_complete'))
  into has_complete;

  select
    exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind in ('signature_direct', 'pro_direct'))
    or (
      exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'racebook')
      and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'pro_upgrade')
    )
    or (has_essential and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'essential_to_signature'))
    or (has_complete and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'complete_to_signature'))
  into has_signature;

  next_tier := case when has_signature then 'signature' when has_complete then 'complete' when has_essential then 'essential' else 'visibility' end;

  update public.organizer_edition_entitlements
  set tier = next_tier,
      source = case when next_tier = 'visibility' then 'system' else 'stripe' end,
      status = 'active',
      activated_at = case when next_tier = 'visibility' then null else coalesce(activated_at, timezone('utc', now())) end,
      revoked_at = case when next_tier = 'visibility' then timezone('utc', now()) else null end,
      updated_at = timezone('utc', now()),
      granted_by = null
  where edition_id = p_edition_id
  returning * into entitlement_row;

  if next_tier = 'visibility' then
    update public.races set racebook_is_live = false
    where edition_id = p_edition_id and racebook_is_live = true;
  end if;
  return entitlement_row;
end;
$$;

create or replace function public.set_admin_organizer_edition_entitlement(p_edition_id uuid, p_admin_id uuid, p_tier text)
returns public.organizer_edition_entitlements
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare updated_entitlement public.organizer_edition_entitlements;
begin
  if p_tier not in ('visibility', 'essential', 'complete', 'signature') then raise exception 'Invalid organizer edition tier.'; end if;
  insert into public.organizer_edition_entitlements (edition_id, tier, source, status, activated_at, revoked_at, granted_by)
  values (
    p_edition_id, p_tier, 'admin', 'active',
    case when p_tier = 'visibility' then null else timezone('utc', now()) end,
    case when p_tier = 'visibility' then timezone('utc', now()) else null end,
    p_admin_id
  )
  on conflict (edition_id) do update set
    tier = excluded.tier, source = excluded.source, status = 'active',
    activated_at = excluded.activated_at, revoked_at = excluded.revoked_at,
    granted_by = excluded.granted_by, updated_at = timezone('utc', now())
  returning * into updated_entitlement;
  if p_tier = 'visibility' then
    update public.races set racebook_is_live = false where edition_id = p_edition_id and racebook_is_live = true;
  end if;
  return updated_entitlement;
end;
$$;

create or replace function public.set_organizer_racebook_visibility(p_user_id uuid, p_race_id uuid, p_is_live boolean)
returns public.races
language plpgsql
security invoker
set search_path = public
as $$
declare race_row public.races; entitlement_tier text; updated_race public.races;
begin
  select * into race_row from public.races where id = p_race_id for update;
  if race_row.id is null then raise exception 'Race not found.'; end if;
  if not exists (
    select 1 from public.race_event_organizers organizer_row
    where organizer_row.event_id = race_row.event_id and organizer_row.user_id = p_user_id and organizer_row.revoked_at is null
  ) then raise exception 'Organizer access required.'; end if;
  if p_is_live then
    if coalesce(race_row.data_status, 'complete') = 'draft' then raise exception 'Race format is incomplete.'; end if;
    if race_row.edition_id is null then raise exception 'Race edition is required.'; end if;
    if not exists (select 1 from public.race_event_editions where id = race_row.edition_id and is_visible) then raise exception 'Race edition is hidden.'; end if;
    select tier into entitlement_tier from public.organizer_edition_entitlements where edition_id = race_row.edition_id and status = 'active';
    if entitlement_tier not in ('essential', 'complete', 'signature') then raise exception 'RaceBook entitlement required.'; end if;
  end if;
  update public.races
  set racebook_is_live = p_is_live,
      racebook_publication_approved_at = case when p_is_live then coalesce(racebook_publication_approved_at, timezone('utc', now())) else racebook_publication_approved_at end,
      racebook_publication_approved_by = case when p_is_live then coalesce(racebook_publication_approved_by, p_user_id) else racebook_publication_approved_by end
  where id = p_race_id returning * into updated_race;
  return updated_race;
end;
$$;

drop policy if exists "Published edition services are viewable" on public.race_edition_services;
create policy "Published edition services are viewable" on public.race_edition_services for select to anon, authenticated
using (exists (
  select 1 from public.races race_row
  where race_row.edition_id = race_edition_services.edition_id
    and private.racebook_module_is_enabled(race_row.id, 'services')
    and (
      (race_row.is_public and race_row.is_live and race_row.racebook_is_live)
      or race_row.created_by = (select auth.uid())
      or exists (select 1 from public.race_event_organizers organizer_row where organizer_row.event_id = race_row.event_id and organizer_row.user_id = (select auth.uid()) and organizer_row.revoked_at is null)
      or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    )
));

drop policy if exists "Published start waves are viewable" on public.race_start_waves;
create policy "Published start waves are viewable" on public.race_start_waves for select to anon, authenticated
using (exists (
  select 1 from public.races race_row
  where race_row.id = race_start_waves.race_id
    and private.racebook_module_is_enabled(race_row.id, 'start_waves')
    and (
      (race_row.is_public and race_row.is_live and race_row.racebook_is_live)
      or race_row.created_by = (select auth.uid())
      or exists (select 1 from public.race_event_organizers organizer_row where organizer_row.event_id = race_row.event_id and organizer_row.user_id = (select auth.uid()) and organizer_row.revoked_at is null)
      or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    )
));

drop policy if exists "race_aid_stations_select" on public.race_aid_stations;
create policy "race_aid_stations_select" on public.race_aid_stations for select to anon, authenticated
using (exists (
  select 1 from public.races race_row
  where race_row.id = race_aid_stations.race_id
    and private.racebook_module_is_enabled(race_row.id, 'aid_stations')
    and (
    (race_row.is_public and race_row.is_live and race_row.racebook_is_live)
    or race_row.created_by = (select auth.uid())
    or exists (select 1 from public.race_event_organizers organizer_row where organizer_row.event_id = race_row.event_id and organizer_row.user_id = (select auth.uid()) and organizer_row.revoked_at is null)
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  )
));

drop policy if exists "Published awards are viewable" on public.race_awards;
create policy "Published awards are viewable" on public.race_awards for select to anon, authenticated
using (exists (
  select 1 from public.races race_row
  where race_row.id = race_awards.race_id
    and private.racebook_module_is_enabled(race_row.id, 'awards')
    and (
      (race_row.is_public and race_row.is_live and race_row.racebook_is_live)
      or race_row.created_by = (select auth.uid())
      or exists (select 1 from public.race_event_organizers organizer_row where organizer_row.event_id = race_row.event_id and organizer_row.user_id = (select auth.uid()) and organizer_row.revoked_at is null)
      or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    )
));

drop policy if exists "Visible race relay points are viewable" on public.race_relay_points;
create policy "Visible race relay points are viewable" on public.race_relay_points for select to anon, authenticated
using (exists (
  select 1 from public.races race_row
  where race_row.id = race_relay_points.race_id
    and private.racebook_module_is_enabled(race_row.id, 'relay')
    and (
    (race_row.is_public and race_row.is_live and race_row.racebook_is_live)
    or race_row.created_by = (select auth.uid())
    or exists (select 1 from public.race_event_organizers organizer_row where organizer_row.event_id = race_row.event_id and organizer_row.user_id = (select auth.uid()) and organizer_row.revoked_at is null)
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  )
));

drop policy if exists "Visible race aid station products are viewable" on public.race_aid_station_products;
create policy "Visible race aid station products are viewable" on public.race_aid_station_products for select to anon, authenticated
using (exists (
  select 1 from public.race_aid_stations station_row
  join public.races race_row on race_row.id = station_row.race_id
  where station_row.id = race_aid_station_products.race_aid_station_id
    and private.racebook_module_is_enabled(race_row.id, 'official_products')
    and (
    (race_row.is_public and race_row.is_live and race_row.racebook_is_live)
    or race_row.created_by = (select auth.uid())
    or exists (select 1 from public.race_event_organizers organizer_row where organizer_row.event_id = race_row.event_id and organizer_row.user_id = (select auth.uid()) and organizer_row.revoked_at is null)
    or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  )
));

revoke all on function public.validate_organizer_racebook_module_setting() from public, anon, authenticated;
revoke all on function public.initialize_organizer_edition_modules() from public, anon, authenticated;
revoke all on function public.initialize_organizer_race_modules() from public, anon, authenticated;
grant execute on function public.validate_organizer_racebook_module_setting() to service_role;
grant execute on function public.initialize_organizer_edition_modules() to service_role;
grant execute on function public.initialize_organizer_race_modules() to service_role;
revoke all on function private.organizer_tier_rank(text) from public;
revoke all on function private.racebook_module_is_enabled(uuid, text) from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.racebook_module_is_enabled(uuid, text) to anon, authenticated, service_role;

comment on table public.organizer_racebook_module_settings is 'Edition and format module activation without deleting organizer-authored RaceBook content.';
comment on column public.race_event_editions.module_setup_completed_at is 'Set when the organizer completes or skips the module setup assistant.';

-- Keep administrator acquisition and commercial KPIs aligned with the new tier names.
create or replace function public.get_admin_growth_metrics(
  p_start_date date,
  p_end_date date,
  p_timezone text default 'Europe/Paris'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_now timestamptz := now();
  v_result jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'Invalid reporting range';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'Reporting range cannot exceed 366 days';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown reporting timezone';
  end if;

  v_start := p_start_date::timestamp at time zone p_timezone;
  v_end := p_end_date::timestamp at time zone p_timezone;

  with
  non_admin_users as (
    select u.id, u.email, u.created_at, u.last_sign_in_at
    from auth.users u
    where not (
      coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
      or coalesce(u.raw_app_meta_data -> 'roles', '[]'::jsonb) ? 'admin'
    )
  ),
  mature_account_cohort as (
    select u.id, u.created_at
    from non_admin_users u
    where u.email is not null
      and u.created_at >= v_start
      and u.created_at < v_end
      and u.created_at <= v_now - interval '24 hours'
  ),
  activated_accounts as (
    select cohort.id, cohort.created_at
    from mature_account_cohort cohort
    where exists (
      select 1
      from public.race_plans plan
      where plan.user_id = cohort.id
        and plan.created_at >= cohort.created_at
        and plan.created_at <= cohort.created_at + interval '24 hours'
    )
  ),
  active_subscriptions as (
    select subscription.user_id, subscription.provider
    from public.subscriptions subscription
    join non_admin_users u on u.id = subscription.user_id
    where lower(coalesce(subscription.status, '')) in ('active', 'trialing')
      and (subscription.current_period_end is null or subscription.current_period_end > v_now)
  ),
  paid_subscriptions as (
    select user_id, provider
    from active_subscriptions subscription
    where exists (
      select 1 from public.subscriptions source
      where source.user_id = subscription.user_id
        and lower(coalesce(source.status, '')) = 'active'
    )
  ),
  active_trials as (
    select profile.user_id
    from public.user_profiles profile
    join non_admin_users u on u.id = profile.user_id
    where profile.trial_started_at <= v_now and profile.trial_ends_at > v_now
  ),
  active_grants as (
    select distinct grant_row.user_id
    from public.premium_grants grant_row
    join non_admin_users u on u.id = grant_row.user_id
    where grant_row.starts_at <= v_now
      and coalesce(grant_row.ends_at, grant_row.starts_at + make_interval(days => grant_row.initial_duration_days)) > v_now
  ),
  effective_premium as (
    select user_id from active_subscriptions
    union select user_id from active_trials
    union select user_id from active_grants
  ),
  memberships as (
    select membership.*
    from public.race_event_organizers membership
    join non_admin_users u on u.id = membership.user_id
    where membership.revoked_at is null
  ),
  event_cohort as (
    select distinct membership.event_id
    from memberships membership
    where membership.role = 'owner'
      and membership.created_by = membership.user_id
      and membership.created_at >= v_start
      and membership.created_at < v_end
  ),
  cohort_progress as (
    select
      cohort.event_id,
      exists (select 1 from public.race_event_editions edition where edition.event_id = cohort.event_id) as has_edition,
      exists (
        select 1 from public.races race
        where race.event_id = cohort.event_id
          and (race.data_status = 'complete' or (coalesce(race.data_status, '') <> 'draft' and cardinality(coalesce(race.missing_required_fields, '{}'::text[])) = 0))
      ) as has_complete_format,
      exists (select 1 from public.races race where race.event_id = cohort.event_id and race.racebook_is_live) as has_published_racebook
    from event_cohort cohort
  ),
  organizer_counts as (
    select
      count(distinct membership.user_id) filter (
        where membership.created_by = membership.user_id
          and membership.created_at >= v_start and membership.created_at < v_end
      )::integer as new_organizers,
      count(distinct membership.user_id) filter (
        where u.last_sign_in_at >= v_start and u.last_sign_in_at < v_end
      )::integer as active_organizers,
      count(distinct membership.user_id) filter (
        where u.last_sign_in_at >= v_start and u.last_sign_in_at < v_end
          and u.last_sign_in_at >= membership.created_at + interval '7 days'
      )::integer as returning_organizers
    from memberships membership
    join non_admin_users u on u.id = membership.user_id
  ),
  entitled_editions as (
    select entitlement.edition_id, entitlement.source
    from public.organizer_edition_entitlements entitlement
    join public.race_event_editions edition on edition.id = entitlement.edition_id
    where entitlement.status = 'active'
      and entitlement.tier in ('essential', 'complete', 'signature')
      and exists (select 1 from memberships membership where membership.event_id = edition.event_id)
  ),
  commercial_activity as (
    select
      count(*) filter (
        where payment.created_at >= v_start and payment.created_at < v_end
      )::integer as checkouts_started,
      count(*) filter (
        where payment.created_at >= v_start and payment.created_at < v_end
          and payment.paid_at is not null
      )::integer as checkout_cohort_paid,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
      )::integer as paid_transactions,
      coalesce(sum(payment.amount_total) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
      ), 0)::bigint as gross_revenue_minor,
      count(*) filter (
        where payment.invalidated_at >= v_start and payment.invalidated_at < v_end
          and payment.status in ('refunded', 'disputed')
      )::integer as invalidated_transactions,
      coalesce(sum(payment.amount_total) filter (
        where payment.invalidated_at >= v_start and payment.invalidated_at < v_end
          and payment.status in ('refunded', 'disputed')
      ), 0)::bigint as invalidated_revenue_minor,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
          and payment.purchase_kind in ('racebook', 'essential_direct', 'complete_direct', 'signature_direct')
      )::integer as racebook_sales,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
          and payment.purchase_kind in ('pro_direct', 'signature_direct')
      )::integer as pro_direct_sales,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
          and payment.purchase_kind in ('pro_upgrade', 'essential_to_complete', 'essential_to_signature', 'complete_to_signature')
      )::integer as pro_upgrade_sales
    from public.organizer_edition_payments payment
    where payment.purchaser_user_id is null
      or exists (select 1 from non_admin_users u where u.id = payment.purchaser_user_id)
  ),
  trend_days as (
    select day::date as day
    from generate_series(p_start_date, p_end_date - 1, interval '1 day') day
  ),
  trend as (
    select jsonb_agg(jsonb_build_object(
      'date', to_char(days.day, 'YYYY-MM-DD'),
      'newAccounts', (select count(*) from non_admin_users u where u.email is not null and (u.created_at at time zone p_timezone)::date = days.day),
      'activationEligibleAccounts', (select count(*) from mature_account_cohort u where (u.created_at at time zone p_timezone)::date = days.day),
      'activatedUsers', (select count(*) from activated_accounts u where (u.created_at at time zone p_timezone)::date = days.day),
      'activePlanUsers', (select count(distinct plan.user_id) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where (plan.updated_at at time zone p_timezone)::date = days.day),
      'newPlans', (select count(*) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where (plan.created_at at time zone p_timezone)::date = days.day)
    ) order by days.day) as value
    from trend_days days
  ),
  follow_ups as (
    select coalesce(jsonb_agg(item.value order by item.days_inactive desc), '[]'::jsonb) as value
    from (
      select jsonb_build_object(
        'eventId', event.id,
        'eventName', event.name,
        'organizerEmail', coalesce(u.email, membership.user_id::text),
        'lastActivityAt', coalesce(u.last_sign_in_at, membership.created_at),
        'status', case
          when exists (select 1 from public.races race where race.event_id = event.id and race.racebook_is_live) then 'published'
          when not exists (select 1 from public.races race where race.event_id = event.id) then 'no_format'
          when not exists (
            select 1 from public.races race where race.event_id = event.id
              and (race.data_status = 'complete' or (coalesce(race.data_status, '') <> 'draft' and cardinality(coalesce(race.missing_required_fields, '{}'::text[])) = 0))
          ) then 'incomplete'
          else 'ready_to_publish'
        end,
        'daysInactive', greatest(0, floor(extract(epoch from (v_now - coalesce(u.last_sign_in_at, membership.created_at))) / 86400)::integer)
      ) as value,
      greatest(0, floor(extract(epoch from (v_now - coalesce(u.last_sign_in_at, membership.created_at))) / 86400)::integer) as days_inactive
      from memberships membership
      join auth.users u on u.id = membership.user_id
      join public.race_events event on event.id = membership.event_id
      where membership.role = 'owner'
        and not exists (select 1 from public.races race where race.event_id = event.id and race.racebook_is_live)
        and v_now - coalesce(u.last_sign_in_at, membership.created_at) >= interval '3 days'
      order by days_inactive desc
      limit 20
    ) item
  )
  select jsonb_build_object(
    'overview', jsonb_build_object(
      'newAccounts', (select count(*) from non_admin_users u where u.email is not null and u.created_at >= v_start and u.created_at < v_end),
      'activationEligibleAccounts', (select count(*) from mature_account_cohort),
      'activatedUsers', (select count(*) from activated_accounts),
      'activePlanUsers', (select count(distinct plan.user_id) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where plan.updated_at >= v_start and plan.updated_at < v_end),
      'newPlans', (select count(*) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where plan.created_at >= v_start and plan.created_at < v_end),
      'activePremiumUsers', (select count(*) from effective_premium),
      'premium', jsonb_build_object(
        'paidSubscriptions', (select count(*) from paid_subscriptions),
        'appTrials', (select count(*) from active_trials),
        'grants', (select count(*) from active_grants),
        'effectiveUsers', (select count(*) from effective_premium),
        'providers', jsonb_build_object(
          'web', (select count(*) from paid_subscriptions where provider = 'web'),
          'apple', (select count(*) from paid_subscriptions where provider = 'apple'),
          'google', (select count(*) from paid_subscriptions where provider = 'google')
        )
      )
    ),
    'trend', (select value from trend),
    'organizers', jsonb_build_object(
      'newOrganizers', (select new_organizers from organizer_counts),
      'activeOrganizers', (select active_organizers from organizer_counts),
      'returningOrganizers', (select returning_organizers from organizer_counts),
      'eventsCreated', (select count(*) from event_cohort),
      'editionsCreated', (select count(*) from public.race_event_editions edition where edition.created_at >= v_start and edition.created_at < v_end and exists (select 1 from memberships membership where membership.event_id = edition.event_id)),
      'formatsCreated', (select count(*) from public.races race where race.created_at >= v_start and race.created_at < v_end and exists (select 1 from memberships membership where membership.event_id = race.event_id)),
      'publishedRacebooks', (select count(*) from public.races race where race.racebook_publication_approved_at >= v_start and race.racebook_publication_approved_at < v_end and exists (select 1 from memberships membership where membership.event_id = race.event_id)),
      'activatedRacebooks', (select count(*) from entitled_editions),
      'giftedRacebooks', (select count(*) from entitled_editions where source in ('admin', 'legacy_admin')),
      'paidRacebooks', (select count(*) from entitled_editions where source = 'stripe'),
      'commercial', jsonb_build_object(
        'checkoutsStarted', (select checkouts_started from commercial_activity),
        'checkoutCohortPaid', (select checkout_cohort_paid from commercial_activity),
        'checkoutConversion', case
          when (select checkouts_started from commercial_activity) = 0 then null
          else round(100.0 * (select checkout_cohort_paid from commercial_activity) / (select checkouts_started from commercial_activity), 1)
        end,
        'paidTransactions', (select paid_transactions from commercial_activity),
        'grossRevenueMinor', (select gross_revenue_minor from commercial_activity),
        'invalidatedTransactions', (select invalidated_transactions from commercial_activity),
        'invalidatedRevenueMinor', (select invalidated_revenue_minor from commercial_activity),
        'netRevenueMinor', (select gross_revenue_minor - invalidated_revenue_minor from commercial_activity),
        'currency', 'eur',
        'racebookSales', (select racebook_sales from commercial_activity),
        'proDirectSales', (select pro_direct_sales from commercial_activity),
        'proUpgradeSales', (select pro_upgrade_sales from commercial_activity)
      ),
      'funnel', jsonb_build_array(
        jsonb_build_object('step', 'Événements de la cohorte', 'count', (select count(*) from cohort_progress), 'conversionFromPrevious', null),
        jsonb_build_object('step', 'Avec une édition', 'count', (select count(*) from cohort_progress where has_edition), 'conversionFromPrevious', case when (select count(*) from cohort_progress) = 0 then null else round(100.0 * (select count(*) from cohort_progress where has_edition) / (select count(*) from cohort_progress), 1) end),
        jsonb_build_object('step', 'Avec un format complet', 'count', (select count(*) from cohort_progress where has_edition and has_complete_format), 'conversionFromPrevious', case when (select count(*) from cohort_progress where has_edition) = 0 then null else round(100.0 * (select count(*) from cohort_progress where has_edition and has_complete_format) / (select count(*) from cohort_progress where has_edition), 1) end),
        jsonb_build_object('step', 'Avec un RaceBook publié', 'count', (select count(*) from cohort_progress where has_edition and has_complete_format and has_published_racebook), 'conversionFromPrevious', case when (select count(*) from cohort_progress where has_edition and has_complete_format) = 0 then null else round(100.0 * (select count(*) from cohort_progress where has_edition and has_complete_format and has_published_racebook) / (select count(*) from cohort_progress where has_edition and has_complete_format), 1) end)
      ),
      'followUps', (select value from follow_ups)
    )
  ) into v_result;

  return v_result;
end;
$$;
