-- RaceBook branding constraints, service-only access and atomic publication.
-- Run after 20260907171043_add_racebook_edition_branding.sql in a privileged test database.

begin;

do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.race_event_edition_branding'::regclass
      and relrowsecurity
  ) then
    raise exception 'RaceBook branding must have RLS enabled.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.race_event_edition_branding'::regclass
      and contype = 'p'
      and conkey = array[(select attnum from pg_attribute where attrelid = conrelid and attname = 'edition_id')]::smallint[]
  ) then
    raise exception 'RaceBook branding must be unique by edition.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.race_event_edition_branding'::regclass
      and contype = 'f'
      and confrelid = 'public.race_event_editions'::regclass
      and confdeltype = 'c'
  ) then
    raise exception 'RaceBook branding edition FK must cascade on delete.';
  end if;

  if has_table_privilege('anon', 'public.race_event_edition_branding', 'select')
    or has_table_privilege('authenticated', 'public.race_event_edition_branding', 'select') then
    raise exception 'RaceBook branding must not be directly readable by client roles.';
  end if;

  if not has_table_privilege('service_role', 'public.race_event_edition_branding', 'select,insert,update,delete') then
    raise exception 'service_role needs full RaceBook branding table access.';
  end if;

  if has_function_privilege('anon', 'public.publish_racebook_edition_branding(uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.publish_racebook_edition_branding(uuid)', 'execute') then
    raise exception 'RaceBook branding publication must be service-role-only.';
  end if;

  if not has_function_privilege('service_role', 'public.publish_racebook_edition_branding(uuid)', 'execute') then
    raise exception 'service_role must be able to publish RaceBook branding.';
  end if;
end;
$$;

create temp table _racebook_branding_fixture (edition_id uuid not null) on commit drop;

insert into _racebook_branding_fixture (edition_id)
select id from public.race_event_editions order by created_at limit 1;

do $$
begin
  if not exists (select 1 from _racebook_branding_fixture) then
    raise exception 'RaceBook branding checks require one event edition.';
  end if;
end;
$$;

insert into public.race_event_edition_branding (
  edition_id,
  draft_logo_url,
  draft_primary_color,
  draft_accent_color
)
values (
  (select edition_id from _racebook_branding_fixture),
  'https://example.com/logo.png',
  '#123456',
  '#ABCDEF'
);

select public.publish_racebook_edition_branding((select edition_id from _racebook_branding_fixture));

do $$
begin
  if not exists (
    select 1
    from public.race_event_edition_branding
    where edition_id = (select edition_id from _racebook_branding_fixture)
      and published_logo_url = draft_logo_url
      and published_primary_color = draft_primary_color
      and published_accent_color = draft_accent_color
      and published_at is not null
  ) then
    raise exception 'Publishing must copy the complete branding draft atomically.';
  end if;
end;
$$;

do $$
begin
  begin
    update public.race_event_edition_branding
    set draft_primary_color = 'red'
    where edition_id = (select edition_id from _racebook_branding_fixture);
    raise exception 'Malformed hex color unexpectedly accepted.';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
