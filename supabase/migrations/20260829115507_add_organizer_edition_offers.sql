create table if not exists public.organizer_edition_entitlements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  edition_id uuid not null unique references public.race_event_editions(id) on delete cascade,
  tier text not null default 'visibility'
    check (tier in ('visibility', 'racebook', 'pro')),
  source text not null default 'system'
    check (source in ('system', 'stripe', 'admin', 'legacy_admin')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  activated_at timestamptz,
  revoked_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  constraint organizer_edition_entitlements_activation_check check (
    (tier = 'visibility' and activated_at is null)
    or (tier <> 'visibility' and activated_at is not null)
  )
);

create table if not exists public.organizer_edition_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  purchaser_user_id uuid references auth.users(id) on delete set null,
  purchase_kind text not null
    check (purchase_kind in ('racebook', 'pro_direct', 'pro_upgrade')),
  from_tier text not null check (from_tier in ('visibility', 'racebook')),
  to_tier text not null check (to_tier in ('racebook', 'pro')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'expired', 'refunded', 'disputed')),
  stripe_checkout_session_id text unique,
  stripe_checkout_url text,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  amount_subtotal integer check (amount_subtotal is null or amount_subtotal >= 0),
  amount_tax integer check (amount_tax is null or amount_tax >= 0),
  amount_total integer check (amount_total is null or amount_total >= 0),
  currency text,
  paid_at timestamptz,
  invalidated_at timestamptz
);

create index if not exists organizer_edition_payments_edition_created_idx
  on public.organizer_edition_payments(edition_id, created_at desc);
create index if not exists organizer_edition_payments_payment_intent_idx
  on public.organizer_edition_payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create unique index if not exists organizer_edition_payments_pending_edition_idx
  on public.organizer_edition_payments(edition_id)
  where status = 'pending';

alter table public.organizer_edition_entitlements enable row level security;
alter table public.organizer_edition_payments enable row level security;

revoke all on table public.organizer_edition_entitlements from public, anon, authenticated;
revoke all on table public.organizer_edition_payments from public, anon, authenticated;
grant select, insert, update, delete on table public.organizer_edition_entitlements to service_role;
grant select, insert, update, delete on table public.organizer_edition_payments to service_role;

insert into public.organizer_edition_entitlements (
  edition_id,
  tier,
  source,
  status,
  activated_at,
  granted_by
)
select
  edition_row.id,
  case when bool_or(race_row.racebook_publication_approved_at is not null or race_row.racebook_is_live) then 'pro' else 'visibility' end,
  case when bool_or(race_row.racebook_publication_approved_at is not null or race_row.racebook_is_live) then 'legacy_admin' else 'system' end,
  'active',
  case
    when bool_or(race_row.racebook_publication_approved_at is not null or race_row.racebook_is_live)
      then coalesce(min(race_row.racebook_publication_approved_at), timezone('utc', now()))
    else null
  end,
  case
    when count(distinct race_row.racebook_publication_approved_by) = 1
      then min(race_row.racebook_publication_approved_by::text)::uuid
    else null
  end
from public.race_event_editions edition_row
left join public.races race_row on race_row.edition_id = edition_row.id
group by edition_row.id
on conflict (edition_id) do nothing;

create or replace function public.ensure_organizer_edition_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.organizer_edition_entitlements (edition_id)
  values (new.id)
  on conflict (edition_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_organizer_edition_entitlement_trigger on public.race_event_editions;
create trigger ensure_organizer_edition_entitlement_trigger
after insert on public.race_event_editions
for each row execute function public.ensure_organizer_edition_entitlement();

create or replace function public.recalculate_organizer_edition_entitlement(p_edition_id uuid)
returns public.organizer_edition_entitlements
language plpgsql
security invoker
set search_path = public
as $$
declare
  entitlement_row public.organizer_edition_entitlements;
  next_tier text := 'visibility';
  has_racebook boolean := false;
  has_direct_pro boolean := false;
  has_upgrade boolean := false;
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

  select
    bool_or(purchase_kind = 'racebook' and status = 'paid'),
    bool_or(purchase_kind = 'pro_direct' and status = 'paid'),
    bool_or(purchase_kind = 'pro_upgrade' and status = 'paid')
  into has_racebook, has_direct_pro, has_upgrade
  from public.organizer_edition_payments
  where edition_id = p_edition_id;

  if coalesce(has_direct_pro, false) or (coalesce(has_racebook, false) and coalesce(has_upgrade, false)) then
    next_tier := 'pro';
  elsif coalesce(has_racebook, false) then
    next_tier := 'racebook';
  end if;

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
    update public.races
    set racebook_is_live = false
    where edition_id = p_edition_id
      and racebook_is_live = true;
  end if;

  return entitlement_row;
end;
$$;

create or replace function public.set_organizer_racebook_visibility(
  p_user_id uuid,
  p_race_id uuid,
  p_is_live boolean
)
returns public.races
language plpgsql
security invoker
set search_path = public
as $$
declare
  race_row public.races;
  entitlement_tier text;
  updated_race public.races;
begin
  select * into race_row from public.races where id = p_race_id for update;
  if race_row.id is null then raise exception 'Race not found.'; end if;

  if not exists (
    select 1 from public.race_event_organizers organizer_row
    where organizer_row.event_id = race_row.event_id
      and organizer_row.user_id = p_user_id
      and organizer_row.revoked_at is null
  ) then
    raise exception 'Organizer access required.';
  end if;

  if p_is_live then
    if coalesce(race_row.data_status, 'complete') = 'draft' then
      raise exception 'Race format is incomplete.';
    end if;
    if race_row.edition_id is null then raise exception 'Race edition is required.'; end if;
    if not exists (
      select 1 from public.race_event_editions edition_row
      where edition_row.id = race_row.edition_id and edition_row.is_visible = true
    ) then
      raise exception 'Race edition is hidden.';
    end if;
    select tier into entitlement_tier
    from public.organizer_edition_entitlements
    where edition_id = race_row.edition_id and status = 'active';
    if entitlement_tier not in ('racebook', 'pro') then
      raise exception 'RaceBook entitlement required.';
    end if;
  end if;

  update public.races
  set racebook_is_live = p_is_live,
      racebook_publication_approved_at = case
        when p_is_live then coalesce(racebook_publication_approved_at, timezone('utc', now()))
        else racebook_publication_approved_at
      end,
      racebook_publication_approved_by = case
        when p_is_live then coalesce(racebook_publication_approved_by, p_user_id)
        else racebook_publication_approved_by
      end
  where id = p_race_id
  returning * into updated_race;
  return updated_race;
end;
$$;

create or replace function public.set_admin_organizer_edition_entitlement(
  p_edition_id uuid,
  p_admin_id uuid,
  p_tier text
)
returns public.organizer_edition_entitlements
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  updated_entitlement public.organizer_edition_entitlements;
begin
  if p_tier not in ('visibility', 'racebook', 'pro') then
    raise exception 'Invalid organizer edition tier.';
  end if;

  insert into public.organizer_edition_entitlements (
    edition_id, tier, source, status, activated_at, revoked_at, granted_by
  ) values (
    p_edition_id,
    p_tier,
    'admin',
    'active',
    case when p_tier = 'visibility' then null else timezone('utc', now()) end,
    case when p_tier = 'visibility' then timezone('utc', now()) else null end,
    p_admin_id
  )
  on conflict (edition_id) do update set
    tier = excluded.tier,
    source = excluded.source,
    status = 'active',
    activated_at = excluded.activated_at,
    revoked_at = excluded.revoked_at,
    granted_by = excluded.granted_by,
    updated_at = timezone('utc', now())
  returning * into updated_entitlement;

  if p_tier = 'visibility' then
    update public.races
    set racebook_is_live = false
    where edition_id = p_edition_id
      and racebook_is_live = true;
  end if;

  return updated_entitlement;
end;
$$;

drop policy if exists "Organizers can create race event updates" on public.race_event_updates;
revoke insert on public.race_event_updates from authenticated;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.organizer_edition_is_pro(p_edition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organizer_edition_entitlements entitlement_row
    where entitlement_row.edition_id = p_edition_id
      and entitlement_row.status = 'active'
      and entitlement_row.tier = 'pro'
  );
$$;

drop policy if exists "Visible race relay points are viewable" on public.race_relay_points;
create policy "Visible race relay points are viewable"
on public.race_relay_points
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.races race_row
    where race_row.id = race_relay_points.race_id
      and (
        (
          race_row.is_public = true
          and race_row.is_live = true
          and race_row.racebook_is_live = true
          and private.organizer_edition_is_pro(race_row.edition_id)
        )
        or race_row.created_by = (select auth.uid())
        or exists (
          select 1
          from public.race_event_organizers organizer_row
          where organizer_row.event_id = race_row.event_id
            and organizer_row.user_id = (select auth.uid())
            and organizer_row.revoked_at is null
        )
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

drop policy if exists "Visible race aid station products are viewable" on public.race_aid_station_products;
create policy "Visible race aid station products are viewable"
on public.race_aid_station_products
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.race_aid_stations station_row
    join public.races race_row on race_row.id = station_row.race_id
    where station_row.id = race_aid_station_products.race_aid_station_id
      and (
        (
          race_row.is_public = true
          and race_row.is_live = true
          and race_row.racebook_is_live = true
          and private.organizer_edition_is_pro(race_row.edition_id)
        )
        or race_row.created_by = (select auth.uid())
        or exists (
          select 1
          from public.race_event_organizers organizer_row
          where organizer_row.event_id = race_row.event_id
            and organizer_row.user_id = (select auth.uid())
            and organizer_row.revoked_at is null
        )
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

drop policy if exists "Organizers can add race aid station products" on public.race_aid_station_products;
drop policy if exists "Organizers can update race aid station products" on public.race_aid_station_products;
drop policy if exists "Organizers can delete race aid station products" on public.race_aid_station_products;
revoke insert, update, delete on public.race_aid_station_products from authenticated;
revoke insert, update, delete on public.race_relay_points from authenticated;

revoke all on function public.ensure_organizer_edition_entitlement() from public, anon, authenticated;
grant execute on function public.ensure_organizer_edition_entitlement() to service_role;
revoke all on function public.recalculate_organizer_edition_entitlement(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_organizer_edition_entitlement(uuid) to service_role;
revoke all on function public.set_organizer_racebook_visibility(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_organizer_racebook_visibility(uuid, uuid, boolean) to service_role;
revoke all on function public.set_admin_organizer_edition_entitlement(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_admin_organizer_edition_entitlement(uuid, uuid, text) to service_role;
revoke all on function private.organizer_edition_is_pro(uuid) from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.organizer_edition_is_pro(uuid) to anon, authenticated, service_role;

comment on table public.organizer_edition_entitlements is
  'Current organizer commercial tier for one event edition. Human membership remains event-scoped.';
comment on table public.organizer_edition_payments is
  'Immutable-ish Stripe payment attempt ledger used to derive an edition commercial tier.';
comment on function private.organizer_edition_is_pro(uuid) is
  'Returns only the non-sensitive Pro capability state used by public mobile RLS policies.';
