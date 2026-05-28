-- Organizer portal: event claims, approved event managers, and products offered at race aid stations.

create table if not exists public.race_event_claims (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.race_events(id) on delete cascade,
  organization_name text not null,
  role_title text not null,
  contact_email text not null,
  official_site_url text,
  message text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_notes text,
  constraint race_event_claims_status_check check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists public.race_event_organizers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  event_id uuid not null references public.race_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid references public.race_event_claims(id) on delete set null,
  role text not null default 'owner',
  created_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoke_reason text
);

create table if not exists public.race_aid_station_products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  race_aid_station_id uuid not null references public.race_aid_stations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  notes text,
  order_index integer not null default 0,
  constraint race_aid_station_products_station_product_key unique (race_aid_station_id, product_id)
);

create or replace function public.set_race_event_claims_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_race_event_claims_updated_at on public.race_event_claims;
create trigger set_race_event_claims_updated_at
before update on public.race_event_claims
for each row
execute function public.set_race_event_claims_updated_at();

create or replace function public.set_race_aid_station_products_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_race_aid_station_products_updated_at on public.race_aid_station_products;
create trigger set_race_aid_station_products_updated_at
before update on public.race_aid_station_products
for each row
execute function public.set_race_aid_station_products_updated_at();

create index if not exists race_event_claims_user_idx on public.race_event_claims(user_id, created_at desc);
create index if not exists race_event_claims_event_idx on public.race_event_claims(event_id, status);
create unique index if not exists race_event_claims_open_user_event_idx
  on public.race_event_claims(user_id, event_id)
  where status in ('pending', 'approved');

create index if not exists race_event_organizers_user_idx on public.race_event_organizers(user_id);
create index if not exists race_event_organizers_event_idx on public.race_event_organizers(event_id);
create unique index if not exists race_event_organizers_active_user_event_idx
  on public.race_event_organizers(user_id, event_id)
  where revoked_at is null;

create index if not exists race_aid_station_products_station_idx
  on public.race_aid_station_products(race_aid_station_id, order_index);
create index if not exists race_aid_station_products_product_idx
  on public.race_aid_station_products(product_id);

alter table public.race_event_claims enable row level security;
alter table public.race_event_organizers enable row level security;
alter table public.race_aid_station_products enable row level security;

grant select, insert, update on public.race_event_claims to authenticated;
grant select, insert, update, delete on public.race_event_organizers to authenticated;
grant select on public.race_aid_station_products to anon, authenticated;
grant insert, update, delete on public.race_aid_station_products to authenticated;

drop policy if exists "Users can create own race event claims" on public.race_event_claims;
create policy "Users can create own race event claims"
on public.race_event_claims
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
);

drop policy if exists "Users can view own race event claims" on public.race_event_claims;
create policy "Users can view own race event claims"
on public.race_event_claims
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "Admins can update race event claims" on public.race_event_claims;
create policy "Admins can update race event claims"
on public.race_event_claims
for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Users can view own organizer memberships" on public.race_event_organizers;
create policy "Users can view own organizer memberships"
on public.race_event_organizers
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "Admins can manage organizer memberships" on public.race_event_organizers;
create policy "Admins can manage organizer memberships"
on public.race_event_organizers
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Visible race aid station products are viewable" on public.race_aid_station_products;
create policy "Visible race aid station products are viewable"
on public.race_aid_station_products
for select
using (
  exists (
    select 1
    from public.race_aid_stations ras
    join public.races r on r.id = ras.race_id
    where ras.id = race_aid_station_products.race_aid_station_id
      and (
        (r.is_public = true and r.is_live = true)
        or r.created_by = (select auth.uid())
        or exists (
          select 1
          from public.race_event_organizers reo
          where reo.event_id = r.event_id
            and reo.user_id = (select auth.uid())
            and reo.revoked_at is null
        )
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

drop policy if exists "Organizers can add race aid station products" on public.race_aid_station_products;
create policy "Organizers can add race aid station products"
on public.race_aid_station_products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.race_aid_stations ras
    join public.races r on r.id = ras.race_id
    where ras.id = race_aid_station_products.race_aid_station_id
      and (
        exists (
          select 1
          from public.race_event_organizers reo
          where reo.event_id = r.event_id
            and reo.user_id = (select auth.uid())
            and reo.revoked_at is null
        )
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
  and exists (
    select 1
    from public.products p
    where p.id = race_aid_station_products.product_id
      and (
        (p.is_live = true and p.is_archived = false)
        or p.created_by = (select auth.uid())
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
  and exists (
    select 1
    from public.products p
    where p.id = race_aid_station_products.product_id
      and (
        (p.is_live = true and p.is_archived = false)
        or p.created_by = (select auth.uid())
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

drop policy if exists "Organizers can update race aid station products" on public.race_aid_station_products;
create policy "Organizers can update race aid station products"
on public.race_aid_station_products
for update
to authenticated
using (
  exists (
    select 1
    from public.race_aid_stations ras
    join public.races r on r.id = ras.race_id
    where ras.id = race_aid_station_products.race_aid_station_id
      and (
        exists (
          select 1
          from public.race_event_organizers reo
          where reo.event_id = r.event_id
            and reo.user_id = (select auth.uid())
            and reo.revoked_at is null
        )
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
)
with check (
  exists (
    select 1
    from public.race_aid_stations ras
    join public.races r on r.id = ras.race_id
    where ras.id = race_aid_station_products.race_aid_station_id
      and (
        exists (
          select 1
          from public.race_event_organizers reo
          where reo.event_id = r.event_id
            and reo.user_id = (select auth.uid())
            and reo.revoked_at is null
        )
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

drop policy if exists "Organizers can delete race aid station products" on public.race_aid_station_products;
create policy "Organizers can delete race aid station products"
on public.race_aid_station_products
for delete
to authenticated
using (
  exists (
    select 1
    from public.race_aid_stations ras
    join public.races r on r.id = ras.race_id
    where ras.id = race_aid_station_products.race_aid_station_id
      and (
        exists (
          select 1
          from public.race_event_organizers reo
          where reo.event_id = r.event_id
            and reo.user_id = (select auth.uid())
            and reo.revoked_at is null
        )
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);
