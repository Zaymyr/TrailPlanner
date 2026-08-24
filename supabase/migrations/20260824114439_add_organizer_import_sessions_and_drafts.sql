alter table public.races
  add column if not exists data_status text not null default 'complete',
  add column if not exists missing_required_fields text[] not null default array[]::text[];

alter table public.races
  drop constraint if exists races_data_status_check,
  drop constraint if exists races_missing_required_fields_check,
  drop constraint if exists races_complete_has_no_missing_required_fields,
  drop constraint if exists races_draft_is_hidden,
  drop constraint if exists races_missing_distance_uses_sentinel,
  drop constraint if exists races_missing_elevation_gain_uses_sentinel,
  drop constraint if exists races_missing_date_is_null;

alter table public.races
  add constraint races_data_status_check
    check (data_status in ('draft', 'complete')),
  add constraint races_missing_required_fields_check
    check (
      array_position(missing_required_fields, null) is null
      and missing_required_fields <@ array['race_date', 'distance_km', 'elevation_gain_m']::text[]
    ),
  add constraint races_complete_has_no_missing_required_fields
    check (data_status <> 'complete' or cardinality(missing_required_fields) = 0),
  add constraint races_draft_is_hidden
    check (data_status <> 'draft' or (is_live = false and racebook_is_live = false)),
  add constraint races_missing_distance_uses_sentinel
    check (not ('distance_km' = any(missing_required_fields)) or distance_km = 0),
  add constraint races_missing_elevation_gain_uses_sentinel
    check (not ('elevation_gain_m' = any(missing_required_fields)) or elevation_gain_m = 0),
  add constraint races_missing_date_is_null
    check (not ('race_date' = any(missing_required_fields)) or race_date is null);

comment on column public.races.data_status is
  'Import completeness marker. Draft formats stay hidden until every required field is explicitly known.';
comment on column public.races.missing_required_fields is
  'Required organizer fields that are unknown. Zero is a sentinel only when its field is listed here.';

create table public.organizer_import_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.race_events(id) on delete cascade,
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'discovered',
  source_manifest jsonb not null default '{}'::jsonb,
  discovery_snapshot jsonb not null default '{}'::jsonb,
  confirmed_formats jsonb not null default '[]'::jsonb,
  field_snapshot jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '2 hours'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizer_import_sessions_status_check
    check (status in ('discovered', 'formats_confirmed', 'fields_analyzed', 'applied', 'cancelled')),
  constraint organizer_import_sessions_source_manifest_check
    check (jsonb_typeof(source_manifest) = 'object'),
  constraint organizer_import_sessions_discovery_snapshot_check
    check (jsonb_typeof(discovery_snapshot) = 'object'),
  constraint organizer_import_sessions_confirmed_formats_check
    check (jsonb_typeof(confirmed_formats) = 'array'),
  constraint organizer_import_sessions_field_snapshot_check
    check (jsonb_typeof(field_snapshot) = 'object'),
  constraint organizer_import_sessions_expiry_check
    check (expires_at > created_at)
);

create index organizer_import_sessions_event_id_idx
  on public.organizer_import_sessions(event_id);

create index organizer_import_sessions_edition_id_idx
  on public.organizer_import_sessions(edition_id);

create index organizer_import_sessions_created_by_idx
  on public.organizer_import_sessions(created_by);

create index organizer_import_sessions_expires_at_idx
  on public.organizer_import_sessions(expires_at);

create index organizer_import_sessions_active_event_idx
  on public.organizer_import_sessions(event_id, edition_id, created_at desc)
  where status in ('discovered', 'formats_confirmed', 'fields_analyzed');

create or replace function public.set_organizer_import_sessions_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.validate_organizer_import_session_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.race_event_editions as edition_row
    where edition_row.id = new.edition_id
      and edition_row.event_id = new.event_id
  ) then
    raise exception 'Organizer import session edition must belong to its event.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger set_organizer_import_sessions_updated_at
before update on public.organizer_import_sessions
for each row execute function public.set_organizer_import_sessions_updated_at();

create trigger validate_organizer_import_session_scope
before insert or update of event_id, edition_id on public.organizer_import_sessions
for each row execute function public.validate_organizer_import_session_scope();

alter table public.organizer_import_sessions enable row level security;

revoke all on table public.organizer_import_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.organizer_import_sessions to service_role;

revoke all on function public.set_organizer_import_sessions_updated_at() from public, anon, authenticated;
grant execute on function public.set_organizer_import_sessions_updated_at() to service_role;
revoke all on function public.validate_organizer_import_session_scope() from public, anon, authenticated;
grant execute on function public.validate_organizer_import_session_scope() to service_role;

comment on table public.organizer_import_sessions is
  'Temporary service-only state for the two-pass organizer import review. Expired rows are cleaned through the web cron route after Storage cleanup.';
comment on column public.organizer_import_sessions.source_manifest is
  'Bounded source metadata, including temporary Storage object paths needed by cleanup.';
comment on column public.organizer_import_sessions.confirmed_formats is
  'Canonical formatKey/raceId mappings produced by atomic format confirmation.';

create or replace function public.confirm_organizer_import_formats(
  p_session_id uuid,
  p_formats jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  import_session public.organizer_import_sessions;
  edition_start_date date;
  format_item jsonb;
  format_mode text;
  format_key text;
  confirmed_name text;
  target_race_id uuid;
  confirmed_row public.races;
  confirmed_payload jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_formats) is distinct from 'array'
    or jsonb_array_length(p_formats) = 0
    or jsonb_array_length(p_formats) > 100 then
    raise exception 'p_formats must be an array containing between 1 and 100 formats.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_formats) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
  ) then
    raise exception 'Every format must be a JSON object.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_formats) as item(value),
         lateral jsonb_object_keys(item.value) as supplied(key)
    where supplied.key not in ('formatKey', 'candidateKeys', 'mode', 'raceId', 'name')
  ) then
    raise exception 'A format contains an unsupported key.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_formats) as item(value)
    where jsonb_typeof(item.value -> 'formatKey') is distinct from 'string'
      or nullif(btrim(item.value ->> 'formatKey'), '') is null
      or jsonb_typeof(item.value -> 'mode') is distinct from 'string'
      or item.value ->> 'mode' not in ('create', 'bind-existing')
      or jsonb_typeof(item.value -> 'name') is distinct from 'string'
      or nullif(btrim(item.value ->> 'name'), '') is null
      or char_length(btrim(item.value ->> 'name')) > 300
      or jsonb_typeof(item.value -> 'candidateKeys') is distinct from 'array'
      or jsonb_array_length(item.value -> 'candidateKeys') > 30
      or exists (
        select 1
        from jsonb_array_elements(item.value -> 'candidateKeys') as candidate_key(value)
        where jsonb_typeof(candidate_key.value) is distinct from 'string'
          or nullif(btrim(candidate_key.value #>> '{}'), '') is null
          or char_length(btrim(candidate_key.value #>> '{}')) > 300
      )
      or (
        item.value ->> 'mode' = 'create'
        and item.value ? 'raceId'
      )
      or (
        item.value ->> 'mode' = 'bind-existing'
        and (
          jsonb_typeof(item.value -> 'raceId') is distinct from 'string'
          or coalesce(item.value ->> 'raceId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
      )
  ) then
    raise exception 'A confirmed format has an invalid shape.' using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_formats)
  ) <> (
    select count(distinct btrim(item.value ->> 'formatKey'))
    from jsonb_array_elements(p_formats) as item(value)
  ) then
    raise exception 'formatKey values must be unique.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_formats) as first_item(value)
    join jsonb_array_elements(p_formats) as second_item(value)
      on first_item.value ->> 'mode' = 'bind-existing'
     and second_item.value ->> 'mode' = 'bind-existing'
     and first_item.value ->> 'formatKey' < second_item.value ->> 'formatKey'
     and first_item.value ->> 'raceId' = second_item.value ->> 'raceId'
  ) then
    raise exception 'An existing race can be bound only once.' using errcode = '22023';
  end if;

  select session_row.*
  into import_session
  from public.organizer_import_sessions as session_row
  where session_row.id = p_session_id
  for update;

  if import_session.id is null then
    raise exception 'Organizer import session not found.' using errcode = 'P0002';
  end if;
  if import_session.expires_at <= timezone('utc', now()) then
    raise exception 'Organizer import session has expired.' using errcode = '22023';
  end if;
  if import_session.status <> 'discovered' then
    raise exception 'Organizer import formats have already been confirmed.' using errcode = '55000';
  end if;

  select edition_row.start_date
  into edition_start_date
  from public.race_event_editions as edition_row
  where edition_row.id = import_session.edition_id
    and edition_row.event_id = import_session.event_id;

  if edition_start_date is null then
    raise exception 'Organizer import edition does not belong to the event.' using errcode = '23514';
  end if;

  for format_item in
    select item.value
    from jsonb_array_elements(p_formats) with ordinality as item(value, position)
    order by item.position
  loop
    format_mode := format_item ->> 'mode';
    format_key := btrim(format_item ->> 'formatKey');
    confirmed_name := btrim(format_item ->> 'name');

    if format_mode = 'create' then
      target_race_id := gen_random_uuid();

      insert into public.races (
        id,
        slug,
        name,
        distance_km,
        elevation_gain_m,
        elevation_loss_m,
        gpx_path,
        gpx_hash,
        is_published,
        is_live,
        created_by,
        event_id,
        edition_id,
        edition_group_id,
        series_name,
        race_date,
        racebook_is_live,
        data_status,
        missing_required_fields
      )
      values (
        target_race_id,
        'organizer-import-' || replace(target_race_id::text, '-', ''),
        confirmed_name,
        0,
        0,
        0,
        'organizer/' || import_session.event_id::text || '/' || target_race_id::text || '.gpx',
        'pending:' || target_race_id::text,
        false,
        false,
        import_session.created_by,
        import_session.event_id,
        import_session.edition_id,
        target_race_id,
        confirmed_name,
        edition_start_date,
        false,
        'draft',
        array['distance_km', 'elevation_gain_m']::text[]
      )
      returning * into confirmed_row;
    else
      target_race_id := (format_item ->> 'raceId')::uuid;

      update public.races as race_row
      set name = confirmed_name,
          series_name = confirmed_name
      where race_row.id = target_race_id
        and race_row.event_id = import_session.event_id
        and race_row.edition_id = import_session.edition_id
      returning race_row.* into confirmed_row;

      if confirmed_row.id is null then
        raise exception 'Bound race does not belong to the import event and edition.'
          using errcode = '23514';
      end if;
    end if;

    confirmed_payload := confirmed_payload || jsonb_build_array(
      jsonb_build_object(
        'formatKey', format_key,
        'candidateKeys', format_item -> 'candidateKeys',
        'raceId', confirmed_row.id,
        'name', confirmed_row.name,
        'mode', format_mode,
        'dataStatus', confirmed_row.data_status,
        'missingRequiredFields', to_jsonb(confirmed_row.missing_required_fields)
      )
    );
  end loop;

  update public.organizer_import_sessions
  set confirmed_formats = confirmed_payload,
      status = 'formats_confirmed'
  where id = p_session_id;

  return jsonb_build_object(
    'sessionId', p_session_id,
    'formats', confirmed_payload,
    'createdCount', (
      select count(*)
      from jsonb_array_elements(confirmed_payload) as item(value)
      where item.value ->> 'mode' = 'create'
    ),
    'boundExistingCount', (
      select count(*)
      from jsonb_array_elements(confirmed_payload) as item(value)
      where item.value ->> 'mode' = 'bind-existing'
    )
  );
end;
$$;

revoke all on function public.confirm_organizer_import_formats(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_organizer_import_formats(uuid, jsonb) to service_role;

create or replace function public.apply_organizer_import_field_patches(
  p_session_id uuid,
  p_event_patch jsonb default '{}'::jsonb,
  p_race_patches jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  import_session public.organizer_import_sessions;
  race_patch jsonb;
  patch_fields jsonb;
  station_item jsonb;
  station_position bigint;
  target_race_id uuid;
  next_missing_fields text[];
  next_data_status text;
  updated_race public.races;
  updated_count integer := 0;
  drafts_remaining integer := 0;
  formats_completed integer := 0;
begin
  if jsonb_typeof(p_event_patch) is distinct from 'object' then
    raise exception 'p_event_patch must be a JSON object.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_race_patches) is distinct from 'array' or jsonb_array_length(p_race_patches) > 100 then
    raise exception 'p_race_patches must be an array containing at most 100 patches.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_event_patch) as supplied(key)
    where supplied.key not in ('name', 'location', 'thumbnailUrl', 'organizerDetails')
  ) then
    raise exception 'The event patch contains an unsupported key.' using errcode = '22023';
  end if;

  if (p_event_patch ? 'name') and (
    jsonb_typeof(p_event_patch -> 'name') is distinct from 'string'
    or nullif(btrim(p_event_patch ->> 'name'), '') is null
    or char_length(btrim(p_event_patch ->> 'name')) > 300
  ) then
    raise exception 'Event name must be a non-empty string of at most 300 characters.'
      using errcode = '22023';
  end if;
  if (p_event_patch ? 'location')
    and jsonb_typeof(p_event_patch -> 'location') not in ('string', 'null') then
    raise exception 'Event location must be a string or null.' using errcode = '22023';
  end if;
  if (p_event_patch ? 'thumbnailUrl')
    and jsonb_typeof(p_event_patch -> 'thumbnailUrl') not in ('string', 'null') then
    raise exception 'Event thumbnailUrl must be a string or null.' using errcode = '22023';
  end if;
  if (p_event_patch ? 'organizerDetails')
    and jsonb_typeof(p_event_patch -> 'organizerDetails') not in ('object', 'null') then
    raise exception 'Event organizerDetails must be an object or null.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_race_patches) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
  ) then
    raise exception 'Every race patch must be a JSON object.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_race_patches) as item(value),
         lateral jsonb_object_keys(item.value) as supplied(key)
    where supplied.key not in ('raceId', 'fields', 'missingRequiredFields')
  ) then
    raise exception 'A race patch contains an unsupported key.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_race_patches) as item(value)
    where jsonb_typeof(item.value -> 'raceId') is distinct from 'string'
      or coalesce(item.value ->> 'raceId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(item.value -> 'fields') is distinct from 'object'
      or jsonb_typeof(item.value -> 'missingRequiredFields') is distinct from 'array'
      or exists (
        select 1
        from jsonb_array_elements(item.value -> 'missingRequiredFields') as missing(value)
        where jsonb_typeof(missing.value) <> 'string'
          or missing.value #>> '{}' not in ('race_date', 'distance_km', 'elevation_gain_m')
      )
  ) then
    raise exception 'A race patch has an invalid shape.' using errcode = '22023';
  end if;

  if (
    select count(*) from jsonb_array_elements(p_race_patches)
  ) <> (
    select count(distinct item.value ->> 'raceId')
    from jsonb_array_elements(p_race_patches) as item(value)
  ) then
    raise exception 'Each race can be patched only once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_race_patches) as item(value),
         lateral jsonb_object_keys(item.value -> 'fields') as supplied(key)
    where supplied.key not in (
      'name', 'seriesName', 'raceDate', 'distanceKm', 'elevationGainM', 'elevationLossM',
      'externalSiteUrl', 'locationText', 'thumbnailUrl', 'gpxPath', 'gpxHash',
      'gpxStoragePath', 'gpxSha256', 'minAltM', 'maxAltM', 'startLat', 'startLng',
      'boundsMinLat', 'boundsMinLng', 'boundsMaxLat', 'boundsMaxLng', 'organizerDetails',
      'aidStations'
    )
  ) then
    raise exception 'Race fields contain an unsupported key.' using errcode = '22023';
  end if;

  select session_row.*
  into import_session
  from public.organizer_import_sessions as session_row
  where session_row.id = p_session_id
  for update;

  if import_session.id is null then
    raise exception 'Organizer import session not found.' using errcode = 'P0002';
  end if;
  if import_session.expires_at <= timezone('utc', now()) then
    raise exception 'Organizer import session has expired.' using errcode = '22023';
  end if;
  if import_session.status not in ('formats_confirmed', 'fields_analyzed') then
    raise exception 'Organizer import fields cannot be applied in the current session state.'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.race_event_editions as edition_row
    where edition_row.id = import_session.edition_id
      and edition_row.event_id = import_session.event_id
  ) then
    raise exception 'Organizer import edition does not belong to the event.' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.race_events as event_row
    where event_row.id = import_session.event_id
  ) then
    raise exception 'Organizer import event not found.' using errcode = 'P0002';
  end if;

  if p_event_patch <> '{}'::jsonb then
    update public.race_events as event_row
    set name = case
          when p_event_patch ? 'name' then btrim(p_event_patch ->> 'name')
          else event_row.name
        end,
        location = case
          when p_event_patch ? 'location' then nullif(btrim(p_event_patch ->> 'location'), '')
          else event_row.location
        end,
        thumbnail_url = case
          when p_event_patch ? 'thumbnailUrl' then nullif(btrim(p_event_patch ->> 'thumbnailUrl'), '')
          else event_row.thumbnail_url
        end,
        organizer_details = case
          when p_event_patch ? 'organizerDetails' then nullif(p_event_patch -> 'organizerDetails', 'null'::jsonb)
          else event_row.organizer_details
        end
    where event_row.id = import_session.event_id;
  end if;

  for race_patch in
    select item.value
    from jsonb_array_elements(p_race_patches) with ordinality as item(value, position)
    order by item.position
  loop
    target_race_id := (race_patch ->> 'raceId')::uuid;
    patch_fields := race_patch -> 'fields';

    if not exists (
      select 1
      from jsonb_array_elements(import_session.confirmed_formats) as confirmed(value)
      where confirmed.value ->> 'raceId' = target_race_id::text
    ) then
      raise exception 'Race patch target was not confirmed in this import session.'
        using errcode = '23514';
    end if;

    if (patch_fields ? 'name') and (
      jsonb_typeof(patch_fields -> 'name') is distinct from 'string'
      or nullif(btrim(patch_fields ->> 'name'), '') is null
      or char_length(btrim(patch_fields ->> 'name')) > 300
    ) then
      raise exception 'Race name must be a non-empty string of at most 300 characters.'
        using errcode = '22023';
    end if;
    if (patch_fields ? 'seriesName') and (
      jsonb_typeof(patch_fields -> 'seriesName') is distinct from 'string'
      or nullif(btrim(patch_fields ->> 'seriesName'), '') is null
      or char_length(btrim(patch_fields ->> 'seriesName')) > 300
    ) then
      raise exception 'Race seriesName must be a non-empty string of at most 300 characters.'
        using errcode = '22023';
    end if;
    if (patch_fields ? 'raceDate') and (
      jsonb_typeof(patch_fields -> 'raceDate') not in ('string', 'null')
      or (
        jsonb_typeof(patch_fields -> 'raceDate') = 'string'
        and (patch_fields ->> 'raceDate') !~ '^\d{4}-\d{2}-\d{2}$'
      )
    ) then
      raise exception 'Race raceDate must be an ISO date string or null.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(patch_fields) as supplied(key)
      where supplied.key in (
        'minAltM', 'maxAltM', 'startLat', 'startLng',
        'boundsMinLat', 'boundsMinLng', 'boundsMaxLat', 'boundsMaxLng'
      )
        and jsonb_typeof(patch_fields -> supplied.key) not in ('number', 'null')
    ) then
      raise exception 'Race numeric fields must contain numbers or null.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(patch_fields) as supplied(key)
      where supplied.key in ('distanceKm', 'elevationGainM', 'elevationLossM')
        and jsonb_typeof(patch_fields -> supplied.key) is distinct from 'number'
    ) then
      raise exception 'Race distance and elevation fields must contain numbers.' using errcode = '22023';
    end if;
    if (patch_fields ? 'distanceKm')
      and jsonb_typeof(patch_fields -> 'distanceKm') = 'number'
      and (patch_fields ->> 'distanceKm')::numeric <= 0 then
      raise exception 'Race distanceKm must be greater than zero when known.' using errcode = '22023';
    end if;
    if (patch_fields ? 'elevationGainM')
      and jsonb_typeof(patch_fields -> 'elevationGainM') = 'number'
      and (patch_fields ->> 'elevationGainM')::numeric < 0 then
      raise exception 'Race elevationGainM cannot be negative.' using errcode = '22023';
    end if;
    if (patch_fields ? 'elevationLossM')
      and jsonb_typeof(patch_fields -> 'elevationLossM') = 'number'
      and (patch_fields ->> 'elevationLossM')::numeric < 0 then
      raise exception 'Race elevationLossM cannot be negative.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(patch_fields) as supplied(key)
      where supplied.key in (
        'externalSiteUrl', 'locationText', 'thumbnailUrl', 'gpxStoragePath', 'gpxSha256'
      )
        and jsonb_typeof(patch_fields -> supplied.key) not in ('string', 'null')
    ) then
      raise exception 'Optional race text fields must contain strings or null.' using errcode = '22023';
    end if;
    if (patch_fields ? 'gpxPath') and (
      jsonb_typeof(patch_fields -> 'gpxPath') is distinct from 'string'
      or nullif(btrim(patch_fields ->> 'gpxPath'), '') is null
    ) then
      raise exception 'Race gpxPath must be a non-empty string.' using errcode = '22023';
    end if;
    if (patch_fields ? 'gpxHash') and (
      jsonb_typeof(patch_fields -> 'gpxHash') is distinct from 'string'
      or nullif(btrim(patch_fields ->> 'gpxHash'), '') is null
    ) then
      raise exception 'Race gpxHash must be a non-empty string.' using errcode = '22023';
    end if;
    if (patch_fields ? 'organizerDetails')
      and jsonb_typeof(patch_fields -> 'organizerDetails') not in ('object', 'null') then
      raise exception 'Race organizerDetails must be an object or null.' using errcode = '22023';
    end if;
    if (patch_fields ? 'aidStations') and (
      jsonb_typeof(patch_fields -> 'aidStations') is distinct from 'array'
      or jsonb_array_length(patch_fields -> 'aidStations') > 200
    ) then
      raise exception 'Race aidStations must be an array containing at most 200 stations.'
        using errcode = '22023';
    end if;
    if (patch_fields ? 'aidStations') and exists (
      select 1
      from jsonb_array_elements(patch_fields -> 'aidStations') as station(value)
      where jsonb_typeof(station.value) is distinct from 'object'
        or exists (
          select 1
          from jsonb_object_keys(station.value) as supplied(key)
          where supplied.key not in (
            'name', 'distanceKm', 'waterRefill', 'solidRefill', 'assistanceAllowed',
            'notes', 'orderIndex', 'organizerDetails'
          )
        )
        or jsonb_typeof(station.value -> 'name') is distinct from 'string'
        or nullif(btrim(station.value ->> 'name'), '') is null
        or char_length(btrim(station.value ->> 'name')) > 200
        or jsonb_typeof(station.value -> 'distanceKm') is distinct from 'number'
        or (station.value ->> 'distanceKm')::numeric < 0
        or (
          station.value ? 'waterRefill'
          and jsonb_typeof(station.value -> 'waterRefill') is distinct from 'boolean'
        )
        or (
          station.value ? 'solidRefill'
          and jsonb_typeof(station.value -> 'solidRefill') is distinct from 'boolean'
        )
        or (
          station.value ? 'assistanceAllowed'
          and jsonb_typeof(station.value -> 'assistanceAllowed') is distinct from 'boolean'
        )
        or (
          station.value ? 'notes'
          and jsonb_typeof(station.value -> 'notes') not in ('string', 'null')
        )
        or (
          station.value ? 'orderIndex'
          and (
            jsonb_typeof(station.value -> 'orderIndex') is distinct from 'number'
            or coalesce(station.value ->> 'orderIndex', '') !~ '^\d+$'
            or (station.value ->> 'orderIndex')::numeric > 2147483647
          )
        )
        or (
          station.value ? 'organizerDetails'
          and jsonb_typeof(station.value -> 'organizerDetails') not in ('object', 'null')
        )
    ) then
      raise exception 'A race aid station has an invalid shape.' using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct missing.value #>> '{}' order by missing.value #>> '{}'), array[]::text[])
    into next_missing_fields
    from jsonb_array_elements(race_patch -> 'missingRequiredFields') as missing(value);

    next_data_status := case when cardinality(next_missing_fields) = 0 then 'complete' else 'draft' end;

    update public.races as race_row
    set name = case when patch_fields ? 'name' then btrim(patch_fields ->> 'name') else race_row.name end,
        series_name = case
          when patch_fields ? 'seriesName' then btrim(patch_fields ->> 'seriesName')
          when patch_fields ? 'name' then btrim(patch_fields ->> 'name')
          else race_row.series_name
        end,
        race_date = case
          when 'race_date' = any(next_missing_fields) then null
          when patch_fields ? 'raceDate' then (patch_fields ->> 'raceDate')::date
          else race_row.race_date
        end,
        distance_km = case
          when 'distance_km' = any(next_missing_fields) then 0
          when patch_fields ? 'distanceKm' then (patch_fields ->> 'distanceKm')::numeric
          else race_row.distance_km
        end,
        elevation_gain_m = case
          when 'elevation_gain_m' = any(next_missing_fields) then 0
          when patch_fields ? 'elevationGainM' then (patch_fields ->> 'elevationGainM')::numeric
          else race_row.elevation_gain_m
        end,
        elevation_loss_m = case when patch_fields ? 'elevationLossM' then (patch_fields ->> 'elevationLossM')::numeric else race_row.elevation_loss_m end,
        external_site_url = case when patch_fields ? 'externalSiteUrl' then nullif(btrim(patch_fields ->> 'externalSiteUrl'), '') else race_row.external_site_url end,
        location_text = case when patch_fields ? 'locationText' then nullif(btrim(patch_fields ->> 'locationText'), '') else race_row.location_text end,
        thumbnail_url = case when patch_fields ? 'thumbnailUrl' then nullif(btrim(patch_fields ->> 'thumbnailUrl'), '') else race_row.thumbnail_url end,
        gpx_path = case when patch_fields ? 'gpxPath' then btrim(patch_fields ->> 'gpxPath') else race_row.gpx_path end,
        gpx_hash = case when patch_fields ? 'gpxHash' then btrim(patch_fields ->> 'gpxHash') else race_row.gpx_hash end,
        gpx_storage_path = case when patch_fields ? 'gpxStoragePath' then nullif(btrim(patch_fields ->> 'gpxStoragePath'), '') else race_row.gpx_storage_path end,
        gpx_sha256 = case when patch_fields ? 'gpxSha256' then nullif(btrim(patch_fields ->> 'gpxSha256'), '') else race_row.gpx_sha256 end,
        min_alt_m = case when patch_fields ? 'minAltM' then (patch_fields ->> 'minAltM')::numeric else race_row.min_alt_m end,
        max_alt_m = case when patch_fields ? 'maxAltM' then (patch_fields ->> 'maxAltM')::numeric else race_row.max_alt_m end,
        start_lat = case when patch_fields ? 'startLat' then (patch_fields ->> 'startLat')::numeric else race_row.start_lat end,
        start_lng = case when patch_fields ? 'startLng' then (patch_fields ->> 'startLng')::numeric else race_row.start_lng end,
        bounds_min_lat = case when patch_fields ? 'boundsMinLat' then (patch_fields ->> 'boundsMinLat')::numeric else race_row.bounds_min_lat end,
        bounds_min_lng = case when patch_fields ? 'boundsMinLng' then (patch_fields ->> 'boundsMinLng')::numeric else race_row.bounds_min_lng end,
        bounds_max_lat = case when patch_fields ? 'boundsMaxLat' then (patch_fields ->> 'boundsMaxLat')::numeric else race_row.bounds_max_lat end,
        bounds_max_lng = case when patch_fields ? 'boundsMaxLng' then (patch_fields ->> 'boundsMaxLng')::numeric else race_row.bounds_max_lng end,
        organizer_details = case when patch_fields ? 'organizerDetails' then nullif(patch_fields -> 'organizerDetails', 'null'::jsonb) else race_row.organizer_details end,
        missing_required_fields = next_missing_fields,
        data_status = next_data_status,
        is_live = case
          when next_data_status = 'draft' then false
          when race_row.data_status = 'draft' then true
          else race_row.is_live
        end,
        racebook_is_live = case
          when next_data_status = 'draft' or race_row.data_status = 'draft' then false
          else race_row.racebook_is_live
        end
    where race_row.id = target_race_id
      and race_row.event_id = import_session.event_id
      and race_row.edition_id = import_session.edition_id
    returning race_row.* into updated_race;

    if not found then
      raise exception 'Race patch target does not belong to the import event and edition.'
        using errcode = '23514';
    end if;

    if next_data_status = 'complete' and (
      updated_race.race_date is null
      or updated_race.distance_km <= 0
      or updated_race.elevation_gain_m < 0
      or nullif(btrim(updated_race.name), '') is null
    ) then
      raise exception 'A complete race must have name, date, positive distance, and known elevation gain.'
        using errcode = '23514';
    end if;

    if patch_fields ? 'aidStations' then
      delete from public.race_aid_stations as station_row
      where station_row.race_id = target_race_id;

      for station_item, station_position in
        select station.value, station.position
        from jsonb_array_elements(patch_fields -> 'aidStations')
          with ordinality as station(value, position)
        order by station.position
      loop
        insert into public.race_aid_stations (
          race_id,
          name,
          km,
          water_available,
          solid_available,
          assistance_allowed,
          notes,
          order_index,
          organizer_details
        )
        values (
          target_race_id,
          btrim(station_item ->> 'name'),
          (station_item ->> 'distanceKm')::numeric,
          coalesce((station_item ->> 'waterRefill')::boolean, true),
          coalesce((station_item ->> 'solidRefill')::boolean, true),
          coalesce((station_item ->> 'assistanceAllowed')::boolean, true),
          nullif(btrim(station_item ->> 'notes'), ''),
          coalesce((station_item ->> 'orderIndex')::integer, (station_position - 1)::integer),
          nullif(station_item -> 'organizerDetails', 'null'::jsonb)
        );
      end loop;
    end if;

    updated_count := updated_count + 1;
  end loop;

  select
    count(*) filter (where race_row.data_status = 'draft'),
    count(*) filter (where race_row.data_status = 'complete')
  into drafts_remaining, formats_completed
  from public.races as race_row
  where race_row.id in (
    select (confirmed.value ->> 'raceId')::uuid
    from jsonb_array_elements(import_session.confirmed_formats) as confirmed(value)
  );

  if drafts_remaining + formats_completed <> jsonb_array_length(import_session.confirmed_formats) then
    raise exception 'One or more confirmed import formats no longer exist in the session scope.'
      using errcode = '23514';
  end if;

  update public.organizer_import_sessions
  set status = 'applied'
  where id = p_session_id;

  return jsonb_build_object(
    'sessionId', p_session_id,
    'formatsUpdated', updated_count,
    'draftsRemaining', drafts_remaining,
    'formatsCompleted', formats_completed
  );
end;
$$;

revoke all on function public.apply_organizer_import_field_patches(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_organizer_import_field_patches(uuid, jsonb, jsonb)
  to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.configure_organizer_import_cleanup_cron()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_name constant text := 'organizer-import-cleanup-hourly';
  job_schedule constant text := '17 * * * *';
  web_app_url text;
  cron_secret text;
  existing_job_id bigint;
begin
  select secret.decrypted_secret
  into web_app_url
  from vault.decrypted_secrets as secret
  where secret.name = 'web_app_url'
  order by secret.created_at desc
  limit 1;

  select secret.decrypted_secret
  into cron_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'cron_secret'
  order by secret.created_at desc
  limit 1;

  if nullif(btrim(web_app_url), '') is null or nullif(btrim(cron_secret), '') is null then
    raise notice
      'Skipping organizer import cleanup schedule because Vault secrets web_app_url or cron_secret are missing.';
    return;
  end if;

  web_app_url := rtrim(web_app_url, '/');

  for existing_job_id in
    select job.jobid
    from cron.job as job
    where job.jobname = job_name
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    job_name,
    job_schedule,
    format(
      $job$
        select net.http_get(
          url := %L,
          headers := jsonb_build_object('Authorization', 'Bearer ' || %L),
          timeout_milliseconds := 10000
        ) as request_id;
      $job$,
      web_app_url || '/api/cron/organizer-import-cleanup',
      cron_secret
    )
  );
end;
$$;

revoke all on function public.configure_organizer_import_cleanup_cron()
  from public, anon, authenticated;
grant execute on function public.configure_organizer_import_cleanup_cron()
  to service_role;

select public.configure_organizer_import_cleanup_cron();
