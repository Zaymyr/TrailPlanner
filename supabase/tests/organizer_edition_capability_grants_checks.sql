-- Organizer edition complimentary capability checks.
-- Run manually in a privileged Supabase SQL editor or psql session after migrations.
-- Every fixture is rollback-only.

begin;

do $$
begin
  if not (
    select relation.relrowsecurity
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'organizer_edition_capability_grants'
  ) then
    raise exception 'organizer_edition_capability_grants must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.organizer_edition_capability_grants', 'SELECT')
    or has_table_privilege('authenticated', 'public.organizer_edition_capability_grants', 'SELECT')
    or has_table_privilege('anon', 'public.organizer_edition_capability_grants', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.organizer_edition_capability_grants', 'INSERT,UPDATE,DELETE') then
    raise exception 'Client roles must not access organizer edition capability grants.';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.organizer_edition_capability_grants',
    'SELECT,INSERT,UPDATE,DELETE'
  ) then
    raise exception 'service_role must manage organizer edition capability grants.';
  end if;

  if has_function_privilege(
    'anon',
    'public.set_admin_organizer_edition_capability_grant(uuid,uuid,text,boolean)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.set_admin_organizer_edition_capability_grant(uuid,uuid,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'Client roles must not execute the capability-grant RPC.';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.set_admin_organizer_edition_capability_grant(uuid,uuid,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute the capability-grant RPC.';
  end if;

  if (
    select procedure.prosecdef
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'set_admin_organizer_edition_capability_grant'
      and pg_get_function_identity_arguments(procedure.oid) = 'p_edition_id uuid, p_admin_id uuid, p_capability_key text, p_enabled boolean'
  ) then
    raise exception 'The capability-grant RPC must remain SECURITY INVOKER.';
  end if;
end $$;

create temp table _organizer_capability_fixture (
  edition_id uuid not null,
  admin_id uuid not null
) on commit drop;

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
values (
  '10000000-0000-0000-0000-000000000097',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'organizer-capability-admin@example.test',
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
values (
  '10000000-0000-0000-0000-000000000098',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'organizer-capability-admin-2@example.test',
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

with available_year as (
  select event_row.id as event_id, candidate.year
  from public.race_events as event_row
  cross join lateral (
    select year
    from generate_series(2080, 2089) as year
    where not exists (
      select 1
      from public.race_event_editions as existing
      where existing.event_id = event_row.id
        and existing.edition_year = year
    )
    limit 1
  ) as candidate
  limit 1
), inserted as (
  insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current)
  select event_id, year, make_date(year, 6, 1), make_date(year, 6, 2), false
  from available_year
  returning id
)
insert into _organizer_capability_fixture (edition_id, admin_id)
select id, '10000000-0000-0000-0000-000000000097'
from inserted;

do $$
begin
  if not exists (select 1 from _organizer_capability_fixture) then
    raise exception 'Capability checks require a race event with a free edition year between 2080 and 2089.';
  end if;
end $$;

set local role service_role;

select public.set_admin_organizer_edition_capability_grant(
  (select edition_id from _organizer_capability_fixture),
  (select admin_id from _organizer_capability_fixture),
  'racebook_analytics.view',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.organizer_edition_capability_grants
    where edition_id = (select edition_id from _organizer_capability_fixture)
      and capability_key = 'racebook_analytics.view'
      and status = 'active'
      and granted_by = (select admin_id from _organizer_capability_fixture)
      and granted_at is not null
      and revoked_by is null
      and revoked_at is null
  ) then
    raise exception 'Expected an active attributed analytics grant.';
  end if;
end $$;

-- A retry (including one made by a different administrator) must preserve the
-- audit identity and date of the transition that already happened.
select public.set_admin_organizer_edition_capability_grant(
  (select edition_id from _organizer_capability_fixture),
  '10000000-0000-0000-0000-000000000098',
  'racebook_analytics.view',
  true
);

do $$
begin
  if exists (
    select 1
    from public.organizer_edition_capability_grants
    where edition_id = (select edition_id from _organizer_capability_fixture)
      and capability_key = 'racebook_analytics.view'
      and granted_by = '10000000-0000-0000-0000-000000000098'
  ) then
    raise exception 'An idempotent activation must not rewrite the original grant audit.';
  end if;
end $$;

select public.set_admin_organizer_edition_grant(
  (select edition_id from _organizer_capability_fixture),
  (select admin_id from _organizer_capability_fixture),
  'essential',
  'complimentary'
);

do $$
begin
  if not exists (
    select 1
    from public.organizer_edition_capability_grants
    where edition_id = (select edition_id from _organizer_capability_fixture)
      and capability_key = 'racebook_analytics.view'
      and status = 'active'
  ) then
    raise exception 'Changing the commercial tier must not remove an independent module grant.';
  end if;
end $$;

select public.set_admin_organizer_edition_capability_grant(
  (select edition_id from _organizer_capability_fixture),
  (select admin_id from _organizer_capability_fixture),
  'racebook_analytics.view',
  false
);

do $$
begin
  if not exists (
    select 1
    from public.organizer_edition_capability_grants
    where edition_id = (select edition_id from _organizer_capability_fixture)
      and capability_key = 'racebook_analytics.view'
      and status = 'revoked'
      and granted_by = (select admin_id from _organizer_capability_fixture)
      and granted_at is not null
      and revoked_by = (select admin_id from _organizer_capability_fixture)
      and revoked_at is not null
  ) then
    raise exception 'Expected revocation to retain grant audit and add revoke audit.';
  end if;
end $$;

select public.set_admin_organizer_edition_capability_grant(
  (select edition_id from _organizer_capability_fixture),
  '10000000-0000-0000-0000-000000000098',
  'racebook_analytics.view',
  false
);

do $$
begin
  if exists (
    select 1
    from public.organizer_edition_capability_grants
    where edition_id = (select edition_id from _organizer_capability_fixture)
      and capability_key = 'racebook_analytics.view'
      and revoked_by = '10000000-0000-0000-0000-000000000098'
  ) then
    raise exception 'An idempotent revocation must not rewrite the original revoke audit.';
  end if;
end $$;

do $$
declare
  unsupported_rejected boolean := false;
  null_state_rejected boolean := false;
  null_admin_rejected boolean := false;
begin
  begin
    perform public.set_admin_organizer_edition_capability_grant(
      (select edition_id from _organizer_capability_fixture),
      (select admin_id from _organizer_capability_fixture),
      'branding.manage',
      true
    );
  exception when sqlstate '22023' then
    unsupported_rejected := true;
  end;

  begin
    perform public.set_admin_organizer_edition_capability_grant(
      (select edition_id from _organizer_capability_fixture),
      (select admin_id from _organizer_capability_fixture),
      'racebook_analytics.view',
      null
    );
  exception when sqlstate '22023' then
    null_state_rejected := true;
  end;

  begin
    perform public.set_admin_organizer_edition_capability_grant(
      (select edition_id from _organizer_capability_fixture),
      null,
      'racebook_analytics.view',
      true
    );
  exception when sqlstate '22023' then
    null_admin_rejected := true;
  end;

  if not unsupported_rejected then
    raise exception 'Expected an unsupported capability key to be rejected.';
  end if;
  if not null_state_rejected then
    raise exception 'Expected a null enabled state to be rejected.';
  end if;
  if not null_admin_rejected then
    raise exception 'Expected missing administrator attribution to be rejected.';
  end if;
end $$;

delete from public.organizer_edition_capability_grants
where edition_id = (select edition_id from _organizer_capability_fixture)
  and capability_key = 'racebook_analytics.view';

select public.set_admin_organizer_edition_capability_grant(
  (select edition_id from _organizer_capability_fixture),
  (select admin_id from _organizer_capability_fixture),
  'racebook_analytics.view',
  false
);

do $$
begin
  if exists (
    select 1
    from public.organizer_edition_capability_grants
    where edition_id = (select edition_id from _organizer_capability_fixture)
      and capability_key = 'racebook_analytics.view'
  ) then
    raise exception 'Revoking an absent capability must not fabricate an audit row.';
  end if;
end $$;

rollback;
