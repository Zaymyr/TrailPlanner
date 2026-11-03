-- Versioned RaceBook publication checks.
-- Run in a privileged SQL session after 20261103123918_racebook_versioned_publications.sql.

begin;

do $$
declare
  table_name text;
  function_name text;
begin
  foreach table_name in array array[
    'racebook_publication_states',
    'racebook_publications',
    'racebook_publication_assets',
    'racebook_publication_asset_cleanup_queue'
  ] loop
    if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = table_name) then
      raise exception '% must have RLS enabled.', table_name;
    end if;
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') then
      raise exception 'Client roles must not read %.', table_name;
    end if;
  end loop;

  foreach function_name in array array[
    'public.publish_racebook_snapshot(uuid,bigint,integer,jsonb,text,jsonb,uuid,boolean)',
    'public.publish_racebook_snapshots(jsonb,uuid)',
    'public.restore_racebook_publication(uuid,uuid,uuid)'
  ] loop
    if has_function_privilege('anon', function_name, 'EXECUTE')
      or has_function_privilege('authenticated', function_name, 'EXECUTE')
      or not has_function_privilege('service_role', function_name, 'EXECUTE') then
      raise exception 'Publication RPC privilege mismatch for %.', function_name;
    end if;
    if (select prosecdef from pg_proc where oid = function_name::regprocedure) then
      raise exception 'Publication RPC % must remain SECURITY INVOKER.', function_name;
    end if;
  end loop;

  if exists (
    select 1
    from public.races race_row
    join public.race_events event_row on event_row.id = race_row.event_id
    left join public.racebook_publication_states state_row on state_row.race_id = race_row.id
    left join public.racebook_publications publication_row on publication_row.id = state_row.current_publication_id
    where race_row.racebook_is_live and race_row.is_live and event_row.is_live
      and (
        publication_row.id is null
        or publication_row.schema_version <> 1
        or publication_row.content ->> 'schemaVersion' <> '1'
        or jsonb_typeof(publication_row.content -> 'raceRow') <> 'object'
        or jsonb_typeof(publication_row.content -> 'modules') <> 'object'
        or jsonb_typeof(publication_row.content -> 'assets') <> 'object'
      )
  ) then
    raise exception 'Every runner-visible RaceBook must have a structurally valid V1 current publication.';
  end if;
end $$;

create temp table _racebook_publication_fixture (
  race_id uuid not null,
  event_id uuid not null,
  edition_id uuid not null,
  initial_revision bigint not null,
  first_publication_id uuid
) on commit drop;

insert into _racebook_publication_fixture (race_id, event_id, edition_id, initial_revision)
select state_row.race_id, state_row.event_id, state_row.edition_id, state_row.draft_revision
from public.racebook_publication_states state_row
order by state_row.created_at
limit 1;

do $$
begin
  if not exists (select 1 from _racebook_publication_fixture) then
    raise exception 'Versioned publication checks require one edition-backed race.';
  end if;
end $$;

grant select, update on table _racebook_publication_fixture to service_role;

set local role service_role;

do $$
declare
  initial_revision bigint := (select initial_revision from _racebook_publication_fixture);
  result jsonb;
  publication_number integer;
begin
  for publication_number in 1..11 loop
    result := public.publish_racebook_snapshot(
      (select race_id from _racebook_publication_fixture),
      initial_revision,
      1,
      jsonb_build_object('schemaVersion', 1, 'testVersion', publication_number),
      repeat(to_hex(publication_number % 16), 64),
      jsonb_build_array(jsonb_build_object(
        'asset_type', 'gpx',
        'storage_bucket', 'racebook-test',
        'storage_path', format('version-%s.gpx', publication_number)
      )),
      null,
      false
    );
    if publication_number = 1 then
      update _racebook_publication_fixture set first_publication_id = (result ->> 'publicationId')::uuid;
    end if;
  end loop;

  if (select count(*) from public.racebook_publications where race_id = (select race_id from _racebook_publication_fixture)) <> 10 then
    raise exception 'Publication retention must keep exactly 10 versions.';
  end if;
  if not exists (
    select 1 from public.racebook_publication_asset_cleanup_queue
    where storage_bucket = 'racebook-test' and storage_path = 'version-1.gpx' and status = 'pending'
  ) then
    raise exception 'Pruned unreferenced assets must be queued for cleanup.';
  end if;
end $$;

do $$
declare
  target_race_id uuid := (select race_id from _racebook_publication_fixture);
  revision_before bigint;
  revision_after bigint;
  sponsor_id uuid;
begin
  select draft_revision into revision_before from public.racebook_publication_states where racebook_publication_states.race_id = target_race_id;
  update public.races set organizer_details = coalesce(organizer_details, '{}'::jsonb) || '{"publicationSqlCheck":true}'::jsonb where id = target_race_id;
  select draft_revision into revision_after from public.racebook_publication_states where racebook_publication_states.race_id = target_race_id;
  if revision_after <> revision_before + 1 then
    raise exception 'RaceBook source edits must increment draft_revision once.';
  end if;

  select sponsor_row.id into sponsor_id
  from public.race_event_edition_sponsors sponsor_row
  where sponsor_row.edition_id = (select edition_id from _racebook_publication_fixture)
  limit 1;
  if sponsor_id is not null then
    revision_before := revision_after;
    update public.race_event_edition_sponsors set click_count = click_count + 1 where id = sponsor_id;
    select draft_revision into revision_after from public.racebook_publication_states where racebook_publication_states.race_id = target_race_id;
    if revision_after <> revision_before then
      raise exception 'Sponsor analytics must not increment draft_revision.';
    end if;
  end if;
end $$;

do $$
declare
  target_race_id uuid := (select race_id from _racebook_publication_fixture);
  source_id uuid;
  source_revision bigint;
  draft_revision bigint;
  result jsonb;
begin
  select id, source_draft_revision into source_id, source_revision
  from public.racebook_publications
  where racebook_publications.race_id = target_race_id
  order by version asc
  limit 1;
  select racebook_publication_states.draft_revision into draft_revision
  from public.racebook_publication_states where racebook_publication_states.race_id = target_race_id;

  result := public.restore_racebook_publication(target_race_id, source_id, null);
  if (select restored_from_publication_id from public.racebook_publications where id = (result ->> 'publicationId')::uuid) <> source_id then
    raise exception 'Restore must create a new publication with durable provenance.';
  end if;
  if (select published_source_revision from public.racebook_publication_states where racebook_publication_states.race_id = target_race_id) <> source_revision then
    raise exception 'Restore must retain the source publication revision.';
  end if;
  if source_revision = draft_revision then
    raise exception 'Fixture must preserve a dirty draft after restoration.';
  end if;
end $$;

rollback;
