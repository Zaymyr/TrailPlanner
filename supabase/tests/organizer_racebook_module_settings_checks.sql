-- RaceBook module scope, uniqueness and service-only access checks.
-- Run after 20260908093008_add_organizer_offer_modules_v2.sql in a privileged SQL session.

begin;

do $$
begin
  if has_table_privilege('anon', 'public.organizer_racebook_module_settings', 'select')
    or has_table_privilege('authenticated', 'public.organizer_racebook_module_settings', 'select') then
    raise exception 'Module settings must not be readable directly by clients.';
  end if;
  if not has_table_privilege('service_role', 'public.organizer_racebook_module_settings', 'select') then
    raise exception 'Service role must be able to read module settings.';
  end if;
end $$;

create temp table _module_fixture as
select race_row.edition_id, race_row.id as race_id
from public.races race_row
where race_row.edition_id is not null
limit 1;

do $$
begin
  if not exists (select 1 from _module_fixture) then
    raise exception 'Module setting checks require one race attached to an edition.';
  end if;
end $$;

delete from public.organizer_racebook_module_settings
where edition_id = (select edition_id from _module_fixture)
  and module_key = 'services';

insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
select edition_id, 'services', true from _module_fixture;

do $$
begin
  begin
    insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
    select edition_id, 'services', false from _module_fixture;
    raise exception 'Expected duplicate edition/module setting to fail.';
  exception when unique_violation then null;
  end;

  begin
    insert into public.organizer_racebook_module_settings (edition_id, race_id, module_key, is_enabled)
    select edition_id, race_id, 'branding', true from _module_fixture;
    raise exception 'Expected an edition-scoped key with race_id to fail.';
  exception when check_violation then null;
  end;

  begin
    insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
    select edition_id, 'relay', true from _module_fixture;
    raise exception 'Expected a race-scoped key without race_id to fail.';
  exception when check_violation then null;
  end;
end $$;

rollback;
