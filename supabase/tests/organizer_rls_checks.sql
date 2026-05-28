-- Organizer portal RLS checks
-- Run manually in a privileged Supabase SQL editor or psql session.
-- The script uses existing live race_events/races rows, seeds temporary auth users,
-- exercises authenticated RLS contexts, and rolls back at the end.

begin;

create temp table _organizer_rls_fixture (
  event_id uuid not null,
  race_id uuid not null,
  station_id uuid not null,
  product_id uuid not null,
  other_product_id uuid not null,
  claim_id uuid,
  rejected_claim_id uuid
) on commit drop;

with source as (
  select e.id as event_id, r.id as race_id
  from public.race_events e
  join public.races r on r.event_id = e.id
  limit 1
),
station as (
  insert into public.race_aid_stations (race_id, name, km, water_available, notes, order_index)
  select race_id, 'Organizer RLS Station', 1, true, 'temporary RLS fixture', 9999
  from source
  returning id, race_id
),
product_a as (
  insert into public.products (
    slug,
    sku,
    name,
    calories_kcal,
    carbs_g,
    protein_g,
    fat_g,
    sodium_mg,
    is_live,
    is_archived
  )
  values (
    'organizer-rls-product-' || replace(gen_random_uuid()::text, '-', ''),
    'organizer-rls-product-' || replace(gen_random_uuid()::text, '-', ''),
    'Organizer RLS Product A',
    100,
    25,
    0,
    0,
    100,
    true,
    false
  )
  returning id
),
product_b as (
  insert into public.products (
    slug,
    sku,
    name,
    calories_kcal,
    carbs_g,
    protein_g,
    fat_g,
    sodium_mg,
    is_live,
    is_archived
  )
  values (
    'organizer-rls-product-' || replace(gen_random_uuid()::text, '-', ''),
    'organizer-rls-product-' || replace(gen_random_uuid()::text, '-', ''),
    'Organizer RLS Product B',
    100,
    25,
    0,
    0,
    100,
    true,
    false
  )
  returning id
)
insert into _organizer_rls_fixture (event_id, race_id, station_id, product_id, other_product_id)
select source.event_id, source.race_id, station.id, product_a.id, product_b.id
from source
join station on station.race_id = source.race_id
cross join product_a
cross join product_b;

do $$
begin
  if not exists (select 1 from _organizer_rls_fixture) then
    raise exception 'Organizer RLS checks require at least one race_events row joined to races.event_id.';
  end if;
end $$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'organizer-rls-owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'organizer-rls-other@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'organizer-rls-admin@example.test',
    '',
    now(),
    '{"role":"admin"}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set raw_app_meta_data = excluded.raw_app_meta_data,
    updated_at = excluded.updated_at;

set local role authenticated;

-- Organizer can create and read their own pending claim.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","app_metadata":{}}',
  true
);

with inserted_claim as (
  insert into public.race_event_claims (
    user_id,
    event_id,
    organization_name,
    role_title,
    contact_email,
    official_site_url,
    message
  )
  select
    '10000000-0000-0000-0000-000000000001',
    event_id,
    'RLS Test Org',
    'Race director',
    'organizer-rls-owner@example.test',
    'https://example.test',
    'RLS claim create check'
  from _organizer_rls_fixture
  returning id
)
update _organizer_rls_fixture
set claim_id = inserted_claim.id
from inserted_claim;

do $$
begin
  if (select count(*) from public.race_event_claims where id = (select claim_id from _organizer_rls_fixture)) <> 1 then
    raise exception 'Expected organizer to read their own claim.';
  end if;
end $$;

-- Another authenticated user cannot read the organizer claim.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","app_metadata":{}}',
  true
);

do $$
begin
  if exists (select 1 from public.race_event_claims where id = (select claim_id from _organizer_rls_fixture)) then
    raise exception 'Expected other user not to read organizer claim.';
  end if;
end $$;

-- The same other user can create their own claim, which admin can reject.
with inserted_rejected_claim as (
  insert into public.race_event_claims (
    user_id,
    event_id,
    organization_name,
    role_title,
    contact_email,
    message
  )
  select
    '10000000-0000-0000-0000-000000000002',
    event_id,
    'Rejected RLS Org',
    'Volunteer',
    'organizer-rls-other@example.test',
    'RLS claim reject check'
  from _organizer_rls_fixture
  returning id
)
update _organizer_rls_fixture
set rejected_claim_id = inserted_rejected_claim.id
from inserted_rejected_claim;

-- Admin can approve/reject claims and create organizer memberships.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","app_metadata":{"role":"admin"}}',
  true
);

update public.race_event_claims
set status = 'approved',
    reviewed_by = '10000000-0000-0000-0000-000000000003',
    reviewed_at = now(),
    reviewer_notes = 'RLS approval check'
where id = (select claim_id from _organizer_rls_fixture);

update public.race_event_claims
set status = 'rejected',
    reviewed_by = '10000000-0000-0000-0000-000000000003',
    reviewed_at = now(),
    reviewer_notes = 'RLS rejection check'
where id = (select rejected_claim_id from _organizer_rls_fixture);

insert into public.race_event_organizers (event_id, user_id, claim_id, role, created_by)
select
  event_id,
  '10000000-0000-0000-0000-000000000001',
  claim_id,
  'owner',
  '10000000-0000-0000-0000-000000000003'
from _organizer_rls_fixture;

do $$
begin
  if not exists (
    select 1
    from public.race_event_claims
    where id = (select rejected_claim_id from _organizer_rls_fixture)
      and status = 'rejected'
  ) then
    raise exception 'Expected admin to reject organizer claim.';
  end if;

  if not exists (
    select 1
    from public.race_event_organizers
    where user_id = '10000000-0000-0000-0000-000000000001'
      and event_id = (select event_id from _organizer_rls_fixture)
      and revoked_at is null
  ) then
    raise exception 'Expected admin to create organizer membership.';
  end if;
end $$;

-- Approved organizer can read their membership and attach aid-station products.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","app_metadata":{}}',
  true
);

do $$
begin
  if (select count(*) from public.race_event_organizers) <> 1 then
    raise exception 'Expected organizer to read exactly one active membership.';
  end if;
end $$;

insert into public.race_aid_station_products (race_aid_station_id, product_id, notes, order_index)
select station_id, product_id, 'Available at the aid station', 0
from _organizer_rls_fixture;

do $$
begin
  if (select count(*) from public.race_aid_station_products) <> 1 then
    raise exception 'Expected organizer to attach one race aid station product.';
  end if;
end $$;

-- A non-organizer cannot attach products to the same event.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","app_metadata":{}}',
  true
);

do $$
begin
  insert into public.race_aid_station_products (race_aid_station_id, product_id, notes, order_index)
  select station_id, other_product_id, 'Should be blocked', 1
  from _organizer_rls_fixture;

  raise exception 'Expected non-organizer insert to be blocked.';
exception
  when insufficient_privilege or check_violation or with_check_option_violation then
    null;
end $$;

rollback;
