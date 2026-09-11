-- RaceBook module scope, uniqueness and service-only access checks.
-- Run after 20260911120508_fix_single_format_publication_admin_check.sql in a privileged SQL session.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'races'
      and column_name = 'racebook_preview_is_visible'
  ) then
    raise exception 'RaceBook organizer preview visibility column is missing.';
  end if;
  if has_function_privilege('anon', 'public.publish_organizer_edition_racebooks(uuid, uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.publish_organizer_edition_racebooks(uuid, uuid)', 'execute') then
    raise exception 'Edition RaceBook publication must not be executable by clients.';
  end if;
  if not has_function_privilege('service_role', 'public.publish_organizer_edition_racebooks(uuid, uuid)', 'execute') then
    raise exception 'Service role must be able to publish selected edition RaceBooks.';
  end if;
  if lower(pg_get_functiondef('public.set_organizer_racebook_visibility(uuid, uuid, boolean)'::regprocedure))
      not like '%private.user_has_trusted_admin_role%' then
    raise exception 'Format publication must use the private trusted-admin helper.';
  end if;
  if lower(pg_get_functiondef('public.set_organizer_racebook_visibility(uuid, uuid, boolean)'::regprocedure))
      like '%auth.users%' then
    raise exception 'The service-role publication RPC must not select auth.users directly.';
  end if;
  if not has_function_privilege('service_role', 'private.user_has_trusted_admin_role(uuid)', 'execute')
    or has_function_privilege('anon', 'private.user_has_trusted_admin_role(uuid)', 'execute')
    or has_function_privilege('authenticated', 'private.user_has_trusted_admin_role(uuid)', 'execute') then
    raise exception 'The trusted-admin helper must be executable only by service_role.';
  end if;
  if not (select prosecdef from pg_proc where oid = 'private.user_has_trusted_admin_role(uuid)'::regprocedure) then
    raise exception 'The private trusted-admin helper must own the privileged Auth lookup.';
  end if;
  if lower(pg_get_functiondef('private.user_has_trusted_admin_role(uuid)'::regprocedure))
      not like '%raw_app_meta_data%'
    or lower(pg_get_functiondef('private.user_has_trusted_admin_role(uuid)'::regprocedure))
      like '%raw_user_meta_data%' then
    raise exception 'The trusted-admin helper must use only app metadata.';
  end if;
  if lower(pg_get_functiondef('public.publish_organizer_edition_racebooks(uuid, uuid)'::regprocedure))
      not like '%set is_live = true,%' then
    raise exception 'Edition publication must restore catalog visibility for selected private formats.';
  end if;
  if lower(pg_get_functiondef('public.publish_organizer_edition_racebooks(uuid, uuid)'::regprocedure))
      like '%race_row.is_live = true%' then
    raise exception 'Edition publication must not require the private format to be live already.';
  end if;
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
