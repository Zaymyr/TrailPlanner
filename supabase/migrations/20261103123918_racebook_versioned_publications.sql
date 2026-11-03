-- Versioned RaceBook publication boundary. Organizer writes continue to mutate
-- the existing draft tables; runner-facing routes read only immutable snapshots.

create table public.racebook_publication_states (
  race_id uuid primary key references public.races(id) on delete cascade,
  event_id uuid not null references public.race_events(id) on delete cascade,
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  draft_revision bigint not null default 1 check (draft_revision >= 1),
  current_publication_id uuid,
  published_source_revision bigint check (published_source_revision is null or published_source_revision >= 1),
  last_published_at timestamptz,
  last_published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint racebook_publication_states_parent_key unique (race_id, event_id, edition_id),
  constraint racebook_publication_states_publication_metadata_check check (
    (current_publication_id is null and published_source_revision is null and last_published_at is null)
    or
    (current_publication_id is not null and published_source_revision is not null and last_published_at is not null)
  )
);

create index racebook_publication_states_edition_idx
  on public.racebook_publication_states (edition_id, race_id);
create index racebook_publication_states_event_idx
  on public.racebook_publication_states (event_id, race_id);
create index racebook_publication_states_dirty_idx
  on public.racebook_publication_states (edition_id, race_id)
  where current_publication_id is null or draft_revision <> published_source_revision;

create table public.racebook_publications (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  event_id uuid not null references public.race_events(id) on delete cascade,
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  version integer not null check (version >= 1),
  schema_version integer not null check (schema_version >= 1),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  source_draft_revision bigint not null check (source_draft_revision >= 1),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default timezone('utc', now()),
  -- Deliberately not a foreign key: the source may leave the 10-version retention
  -- window, while the restoration provenance must remain durable.
  restored_from_publication_id uuid,
  constraint racebook_publications_race_version_key unique (race_id, version),
  constraint racebook_publications_parent_key unique (id, race_id, event_id, edition_id)
);

create index racebook_publications_race_published_idx
  on public.racebook_publications (race_id, published_at desc);
create index racebook_publications_edition_published_idx
  on public.racebook_publications (edition_id, published_at desc);

alter table public.racebook_publication_states
  add constraint racebook_publication_states_current_publication_fkey
  foreign key (current_publication_id, race_id, event_id, edition_id)
  references public.racebook_publications (id, race_id, event_id, edition_id)
  on delete set null (current_publication_id);

create table public.racebook_publication_assets (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.racebook_publications(id) on delete cascade,
  asset_type text not null check (asset_type in ('gpx', 'image', 'event_image', 'format_image', 'branding_logo', 'sponsor_logo', 'product_image')),
  storage_bucket text,
  storage_path text,
  public_url text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint racebook_publication_assets_location_check check (
    (storage_bucket is not null and storage_path is not null)
    or public_url is not null
  ),
  constraint racebook_publication_assets_storage_pair_check check (
    (storage_bucket is null) = (storage_path is null)
  ),
  constraint racebook_publication_assets_public_url_check check (
    public_url is null or public_url ~* '^https?://'
  ),
  constraint racebook_publication_assets_unique_key unique nulls not distinct (
    publication_id, asset_type, storage_bucket, storage_path, public_url
  )
);

create index racebook_publication_assets_storage_idx
  on public.racebook_publication_assets (storage_bucket, storage_path)
  where storage_bucket is not null;

create table public.racebook_publication_asset_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed', 'deleted')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default timezone('utc', now()),
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  constraint racebook_publication_asset_cleanup_queue_key unique (storage_bucket, storage_path),
  constraint racebook_publication_asset_cleanup_completion_check check (
    (status = 'deleted' and completed_at is not null)
    or (status <> 'deleted' and completed_at is null)
  )
);

create index racebook_publication_asset_cleanup_pending_idx
  on public.racebook_publication_asset_cleanup_queue (available_at, created_at)
  where status in ('pending', 'failed');

alter table public.racebook_publication_states enable row level security;
alter table public.racebook_publications enable row level security;
alter table public.racebook_publication_assets enable row level security;
alter table public.racebook_publication_asset_cleanup_queue enable row level security;

revoke all on table public.racebook_publication_states from public, anon, authenticated;
revoke all on table public.racebook_publications from public, anon, authenticated;
revoke all on table public.racebook_publication_assets from public, anon, authenticated;
revoke all on table public.racebook_publication_asset_cleanup_queue from public, anon, authenticated;
grant select, insert, update, delete on table public.racebook_publication_states to service_role;
grant select, insert, delete on table public.racebook_publications to service_role;
grant select, insert, delete on table public.racebook_publication_assets to service_role;
grant select, insert, update, delete on table public.racebook_publication_asset_cleanup_queue to service_role;

create or replace function public.ensure_racebook_publication_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_id is not null and new.edition_id is not null then
    insert into public.racebook_publication_states (race_id, event_id, edition_id)
    values (new.id, new.event_id, new.edition_id)
    on conflict (race_id) do update
    set event_id = excluded.event_id,
        edition_id = excluded.edition_id,
        draft_revision = case
          when racebook_publication_states.event_id is distinct from excluded.event_id
            or racebook_publication_states.edition_id is distinct from excluded.edition_id
          then racebook_publication_states.draft_revision + 1
          else racebook_publication_states.draft_revision
        end,
        updated_at = timezone('utc', now());
  end if;
  return new;
end;
$$;

create or replace function public.bump_racebook_race_draft_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_draft jsonb;
  new_draft jsonb;
begin
  old_draft := to_jsonb(old) - array[
    'updated_at', 'is_live', 'is_public', 'web_catalog_is_live',
    'racebook_is_live', 'racebook_preview_is_visible',
    'racebook_publication_approved_at', 'racebook_publication_approved_by',
    'source_revision'
  ];
  new_draft := to_jsonb(new) - array[
    'updated_at', 'is_live', 'is_public', 'web_catalog_is_live',
    'racebook_is_live', 'racebook_preview_is_visible',
    'racebook_publication_approved_at', 'racebook_publication_approved_by',
    'source_revision'
  ];

  if old_draft is distinct from new_draft and new.event_id is not null and new.edition_id is not null then
    insert into public.racebook_publication_states (race_id, event_id, edition_id, draft_revision)
    values (new.id, new.event_id, new.edition_id, 2)
    on conflict (race_id) do update
    set event_id = excluded.event_id,
        edition_id = excluded.edition_id,
        draft_revision = racebook_publication_states.draft_revision + 1,
        updated_at = timezone('utc', now());
  end if;
  return new;
end;
$$;

create or replace function public.bump_racebook_event_draft_revisions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (to_jsonb(old) - array['updated_at', 'is_live']) is distinct from
     (to_jsonb(new) - array['updated_at', 'is_live']) then
    update public.racebook_publication_states
    set draft_revision = draft_revision + 1,
        updated_at = timezone('utc', now())
    where event_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.bump_racebook_edition_draft_revisions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (to_jsonb(old) - array['updated_at', 'is_visible', 'is_current']) is distinct from
     (to_jsonb(new) - array['updated_at', 'is_visible', 'is_current']) then
    update public.racebook_publication_states
    set draft_revision = draft_revision + 1,
        updated_at = timezone('utc', now())
    where edition_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.bump_racebook_race_child_draft_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_race_id uuid;
begin
  target_race_id := case when tg_op = 'DELETE' then old.race_id else new.race_id end;
  update public.racebook_publication_states
  set draft_revision = draft_revision + 1,
      updated_at = timezone('utc', now())
  where race_id = target_race_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.bump_racebook_edition_child_draft_revisions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_edition_id uuid;
begin
  target_edition_id := case when tg_op = 'DELETE' then old.edition_id else new.edition_id end;
  update public.racebook_publication_states
  set draft_revision = draft_revision + 1,
      updated_at = timezone('utc', now())
  where edition_id = target_edition_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.bump_racebook_sponsor_draft_revisions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_edition_id uuid;
begin
  target_edition_id := case when tg_op = 'DELETE' then old.edition_id else new.edition_id end;
  if tg_op <> 'UPDATE'
    or (to_jsonb(old) - array['updated_at', 'click_count', 'impression_count']) is distinct from
       (to_jsonb(new) - array['updated_at', 'click_count', 'impression_count']) then
    update public.racebook_publication_states
    set draft_revision = draft_revision + 1,
        updated_at = timezone('utc', now())
    where edition_id = target_edition_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.bump_racebook_module_draft_revisions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_edition_id uuid;
  target_race_id uuid;
begin
  target_edition_id := case when tg_op = 'DELETE' then old.edition_id else new.edition_id end;
  target_race_id := case when tg_op = 'DELETE' then old.race_id else new.race_id end;
  update public.racebook_publication_states
  set draft_revision = draft_revision + 1,
      updated_at = timezone('utc', now())
  where (target_race_id is not null and race_id = target_race_id)
     or (target_race_id is null and edition_id = target_edition_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.bump_racebook_aid_product_draft_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  station_id uuid;
begin
  station_id := case when tg_op = 'DELETE' then old.race_aid_station_id else new.race_aid_station_id end;
  update public.racebook_publication_states state_row
  set draft_revision = state_row.draft_revision + 1,
      updated_at = timezone('utc', now())
  from public.race_aid_stations station_row
  where station_row.id = station_id
    and state_row.race_id = station_row.race_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.bump_racebook_product_draft_revisions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_product_id uuid;
begin
  target_product_id := case when tg_op = 'DELETE' then old.id else new.id end;
  if tg_op <> 'UPDATE' or (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    update public.racebook_publication_states state_row
    set draft_revision = state_row.draft_revision + 1,
        updated_at = timezone('utc', now())
    where exists (
      select 1
      from public.race_aid_station_products link_row
      join public.race_aid_stations station_row on station_row.id = link_row.race_aid_station_id
      where link_row.product_id = target_product_id
        and station_row.race_id = state_row.race_id
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger ensure_racebook_publication_state_trigger
after insert or update of event_id, edition_id on public.races
for each row execute function public.ensure_racebook_publication_state();
create trigger bump_racebook_race_draft_revision_trigger
after update on public.races
for each row execute function public.bump_racebook_race_draft_revision();
create trigger bump_racebook_event_draft_revisions_trigger
after update on public.race_events
for each row execute function public.bump_racebook_event_draft_revisions();
create trigger bump_racebook_edition_draft_revisions_trigger
after update on public.race_event_editions
for each row execute function public.bump_racebook_edition_draft_revisions();

create trigger bump_racebook_aid_station_draft_revision_trigger after insert or update or delete on public.race_aid_stations for each row execute function public.bump_racebook_race_child_draft_revision();
create trigger bump_racebook_supporter_point_draft_revision_trigger after insert or update or delete on public.race_supporter_points for each row execute function public.bump_racebook_race_child_draft_revision();
create trigger bump_racebook_relay_point_draft_revision_trigger after insert or update or delete on public.race_relay_points for each row execute function public.bump_racebook_race_child_draft_revision();
create trigger bump_racebook_start_wave_draft_revision_trigger after insert or update or delete on public.race_start_waves for each row execute function public.bump_racebook_race_child_draft_revision();
create trigger bump_racebook_award_draft_revision_trigger after insert or update or delete on public.race_awards for each row execute function public.bump_racebook_race_child_draft_revision();
create trigger bump_racebook_service_draft_revisions_trigger after insert or update or delete on public.race_edition_services for each row execute function public.bump_racebook_edition_child_draft_revisions();
create trigger bump_racebook_branding_draft_revisions_trigger after insert or update or delete on public.race_event_edition_branding for each row execute function public.bump_racebook_edition_child_draft_revisions();
create trigger bump_racebook_module_draft_revisions_trigger after insert or update or delete on public.organizer_racebook_module_settings for each row execute function public.bump_racebook_module_draft_revisions();
create trigger bump_racebook_sponsor_draft_revisions_trigger after insert or update or delete on public.race_event_edition_sponsors for each row execute function public.bump_racebook_sponsor_draft_revisions();
create trigger bump_racebook_aid_product_draft_revision_trigger after insert or update or delete on public.race_aid_station_products for each row execute function public.bump_racebook_aid_product_draft_revision();
create trigger bump_racebook_product_draft_revisions_trigger after update on public.products for each row execute function public.bump_racebook_product_draft_revisions();

insert into public.racebook_publication_states (race_id, event_id, edition_id)
select race_row.id, race_row.event_id, race_row.edition_id
from public.races race_row
where race_row.event_id is not null and race_row.edition_id is not null
on conflict (race_id) do nothing;

-- Build the first immutable V1 snapshot for every currently runner-visible
-- RaceBook before snapshot-only reads are deployed. This mirrors the explicit
-- columns loaded by apps/web/lib/racebook-publications.ts and deliberately
-- omits private actor/source fields from raceRow.
create or replace function private.build_racebook_backfill_snapshot_v1(p_race_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  race_row public.races;
  event_row public.race_events;
  modules jsonb;
  sponsors jsonb;
  branding jsonb;
  image_urls jsonb;
begin
  select * into race_row from public.races where id = p_race_id;
  if race_row.id is null or race_row.event_id is null or race_row.edition_id is null then
    raise exception 'Edition-backed race required for RaceBook backfill.' using errcode = '22023';
  end if;
  select * into event_row from public.race_events where id = race_row.event_id;

  modules := jsonb_build_object(
    'equipment', private.racebook_module_is_enabled(race_row.id, 'equipment'),
    'bib_pickup', private.racebook_module_is_enabled(race_row.id, 'bib_pickup'),
    'access', private.racebook_module_is_enabled(race_row.id, 'access'),
    'services', private.racebook_module_is_enabled(race_row.id, 'services'),
    'branding', private.racebook_module_is_enabled(race_row.id, 'branding'),
    'sponsors', private.racebook_module_is_enabled(race_row.id, 'sponsors'),
    'aid_stations', private.racebook_module_is_enabled(race_row.id, 'aid_stations'),
    'supporter_points', private.racebook_module_is_enabled(race_row.id, 'supporter_points'),
    'start_waves', private.racebook_module_is_enabled(race_row.id, 'start_waves'),
    'awards', private.racebook_module_is_enabled(race_row.id, 'awards'),
    'relay', private.racebook_module_is_enabled(race_row.id, 'relay'),
    'official_products', private.racebook_module_is_enabled(race_row.id, 'official_products')
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sponsor_row.id,
    'name', sponsor_row.name,
    'logoUrl', sponsor_row.logo_url,
    'destinationUrl', sponsor_row.website_url,
    'tier', sponsor_row.partnership_level,
    'category', sponsor_row.category,
    'contextualPlacement', sponsor_row.contextual_placement,
    'showOnLoading', sponsor_row.show_on_loading,
    'showInBanner', sponsor_row.show_in_banner,
    'position', sponsor_row.position
  ) order by sponsor_row.position, sponsor_row.created_at), '[]'::jsonb)
  into sponsors
  from public.race_event_edition_sponsors sponsor_row
  where sponsor_row.edition_id = race_row.edition_id
    and sponsor_row.is_active
    and (modules ->> 'sponsors')::boolean;

  select case
    when (modules ->> 'branding')::boolean and branding_row.published_at is not null then jsonb_build_object(
      'logoUrl', branding_row.published_logo_url,
      'primaryColor', upper(coalesce(branding_row.published_primary_color, '#2D5016')),
      'accentColor', upper(coalesce(branding_row.published_accent_color, '#3F6F8F'))
    )
    else jsonb_build_object('logoUrl', null, 'primaryColor', '#2D5016', 'accentColor', '#3F6F8F')
  end
  into branding
  from (select 1) seed
  left join public.race_event_edition_branding branding_row on branding_row.edition_id = race_row.edition_id;

  select coalesce(jsonb_agg(to_jsonb(image_url) order by image_url), '[]'::jsonb)
  into image_urls
  from (
    select race_row.thumbnail_url as image_url where race_row.thumbnail_url is not null
    union
    select event_row.thumbnail_url where event_row.thumbnail_url is not null
    union
    select sponsor_value ->> 'logoUrl' from jsonb_array_elements(sponsors) sponsor_value
    union
    select branding ->> 'logoUrl' where branding ->> 'logoUrl' is not null
    union
    select product_row.image_url
    from public.race_aid_station_products link_row
    join public.race_aid_stations station_row on station_row.id = link_row.race_aid_station_id
    join public.products product_row on product_row.id = link_row.product_id
    where station_row.race_id = race_row.id
      and product_row.image_url is not null
      and (modules ->> 'aid_stations')::boolean
      and (modules ->> 'official_products')::boolean
  ) images;

  return jsonb_build_object(
    'schemaVersion', 1,
    'raceRow', jsonb_build_object(
      'id', race_row.id,
      'event_id', race_row.event_id,
      'edition_id', race_row.edition_id,
      'name', race_row.name,
      'distance_km', race_row.distance_km,
      'elevation_gain_m', race_row.elevation_gain_m,
      'elevation_loss_m', race_row.elevation_loss_m,
      'plan_source_updated_at', race_row.plan_source_updated_at,
      'race_date', race_row.race_date,
      'is_live', race_row.is_live,
      'racebook_is_live', race_row.racebook_is_live,
      'racebook_preview_is_visible', race_row.racebook_preview_is_visible,
      'thumbnail_url', race_row.thumbnail_url,
      'location_text', race_row.location_text,
      'participation_mode', race_row.participation_mode,
      'start_lat', race_row.start_lat,
      'start_lng', race_row.start_lng,
      'organizer_details', race_row.organizer_details,
      'race_events', jsonb_build_object(
        'id', event_row.id,
        'name', event_row.name,
        'location', event_row.location,
        'race_date', event_row.race_date,
        'thumbnail_url', event_row.thumbnail_url,
        'is_live', event_row.is_live,
        'organizer_details', event_row.organizer_details
      )
    ),
    'stationRows', case when (modules ->> 'aid_stations')::boolean then coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', station_row.id, 'name', station_row.name, 'km', station_row.km,
          'water_available', station_row.water_available, 'solid_available', station_row.solid_available,
          'assistance_allowed', station_row.assistance_allowed, 'notes', station_row.notes,
          'order_index', station_row.order_index, 'organizer_details', station_row.organizer_details,
          'race_aid_station_products', case when (modules ->> 'official_products')::boolean then coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', link_row.id, 'notes', link_row.notes, 'order_index', link_row.order_index,
              'products', jsonb_build_object(
                'id', product_row.id, 'name', product_row.name, 'brand', product_row.brand, 'image_url', product_row.image_url
              )
            ) order by link_row.order_index)
            from public.race_aid_station_products link_row
            join public.products product_row on product_row.id = link_row.product_id
            where link_row.race_aid_station_id = station_row.id
          ), '[]'::jsonb) else '[]'::jsonb end
        ) order by station_row.order_index
      )
      from public.race_aid_stations station_row where station_row.race_id = race_row.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'relayPointRows', case when (modules ->> 'relay')::boolean then coalesce((
      select jsonb_agg(to_jsonb(relay_row) - array['race_id', 'created_at'] order by relay_row.order_index)
      from public.race_relay_points relay_row where relay_row.race_id = race_row.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'startWaveRows', case when (modules ->> 'start_waves')::boolean then coalesce((
      select jsonb_agg(to_jsonb(wave_row) - array['race_id', 'created_at', 'updated_at'] order by wave_row.order_index)
      from public.race_start_waves wave_row where wave_row.race_id = race_row.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'awardRows', case when (modules ->> 'awards')::boolean then coalesce((
      select jsonb_agg(to_jsonb(award_row) - array['race_id', 'created_at', 'updated_at'] order by award_row.podium_time, award_row.order_index)
      from public.race_awards award_row where award_row.race_id = race_row.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'editionServiceRows', case when (modules ->> 'services')::boolean then coalesce((
      select jsonb_agg(to_jsonb(service_row) - array['edition_id', 'created_at', 'updated_at'] order by service_row.service_type, service_row.order_index)
      from public.race_edition_services service_row where service_row.edition_id = race_row.edition_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'supporterPointRows', case when (modules ->> 'supporter_points')::boolean then coalesce((
      select jsonb_agg(to_jsonb(point_row) - array['race_id', 'created_at', 'updated_at'] order by point_row.order_index)
      from public.race_supporter_points point_row where point_row.race_id = race_row.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'sponsors', sponsors,
    'branding', branding,
    'modules', modules,
    'assets', jsonb_build_object('gpxStoragePath', race_row.gpx_storage_path, 'imageUrls', image_urls)
  );
end;
$$;

revoke all on function private.build_racebook_backfill_snapshot_v1(uuid) from public, anon, authenticated;
grant execute on function private.build_racebook_backfill_snapshot_v1(uuid) to service_role;

with snapshot_rows as (
  select
    state_row.*,
    private.build_racebook_backfill_snapshot_v1(state_row.race_id) as content
  from public.racebook_publication_states state_row
  join public.races race_row on race_row.id = state_row.race_id
  join public.race_events event_row on event_row.id = state_row.event_id
  where race_row.racebook_is_live and race_row.is_live and event_row.is_live
), inserted as (
  insert into public.racebook_publications (
    race_id, event_id, edition_id, version, schema_version, content, content_hash,
    source_draft_revision, published_by, published_at
  )
  select
    snapshot_row.race_id, snapshot_row.event_id, snapshot_row.edition_id, 1, 1,
    snapshot_row.content,
    encode(extensions.digest(convert_to(snapshot_row.content::text, 'UTF8'), 'sha256'), 'hex'),
    snapshot_row.draft_revision,
    race_row.racebook_publication_approved_by,
    coalesce(race_row.racebook_publication_approved_at, timezone('utc', now()))
  from snapshot_rows snapshot_row
  join public.races race_row on race_row.id = snapshot_row.race_id
  returning *
)
update public.racebook_publication_states state_row
set current_publication_id = inserted.id,
    published_source_revision = inserted.source_draft_revision,
    last_published_at = inserted.published_at,
    last_published_by = inserted.published_by,
    updated_at = timezone('utc', now())
from inserted
where state_row.race_id = inserted.race_id;

insert into public.racebook_publication_assets (publication_id, asset_type, storage_bucket, storage_path)
select publication_row.id, 'gpx', 'race-gpx', publication_row.content -> 'assets' ->> 'gpxStoragePath'
from public.racebook_publications publication_row
where publication_row.version = 1
  and nullif(publication_row.content -> 'assets' ->> 'gpxStoragePath', '') is not null;

insert into public.racebook_publication_assets (
  publication_id, asset_type, storage_bucket, storage_path, public_url
)
select
  publication_row.id,
  'image',
  case when image_value.url ~ '/storage/v1/object/public/race-images/.+$' then 'race-images' end,
  case when image_value.url ~ '/storage/v1/object/public/race-images/.+$'
    then regexp_replace(image_value.url, '^.*/storage/v1/object/public/race-images/', '')
  end,
  image_value.url
from public.racebook_publications publication_row
cross join lateral jsonb_array_elements_text(publication_row.content -> 'assets' -> 'imageUrls') image_value(url)
where publication_row.version = 1;

drop function private.build_racebook_backfill_snapshot_v1(uuid);

create or replace function public.guard_racebook_visibility_requires_publication()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.racebook_is_live and not old.racebook_is_live and not exists (
    select 1 from public.racebook_publication_states state_row
    where state_row.race_id = new.id and state_row.current_publication_id is not null
  ) then
    raise exception 'A RaceBook publication is required before runner visibility.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_racebook_visibility_requires_publication_trigger
before update of racebook_is_live on public.races
for each row execute function public.guard_racebook_visibility_requires_publication();

create or replace function private.prune_racebook_publications(p_race_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  doomed_ids uuid[];
begin
  select coalesce(array_agg(ranked.id), '{}'::uuid[])
  into doomed_ids
  from (
    select publication_row.id,
           row_number() over (order by publication_row.version desc) as version_rank
    from public.racebook_publications publication_row
    where publication_row.race_id = p_race_id
  ) ranked
  where ranked.version_rank > 10;

  if cardinality(doomed_ids) = 0 then return; end if;

  insert into public.racebook_publication_asset_cleanup_queue (storage_bucket, storage_path)
  select distinct asset_row.storage_bucket, asset_row.storage_path
  from public.racebook_publication_assets asset_row
  where asset_row.publication_id = any(doomed_ids)
    and asset_row.storage_bucket is not null
    and not exists (
      select 1 from public.racebook_publication_assets retained_asset
      where retained_asset.storage_bucket = asset_row.storage_bucket
        and retained_asset.storage_path = asset_row.storage_path
        and not (retained_asset.publication_id = any(doomed_ids))
    )
  on conflict (storage_bucket, storage_path) do update
  set status = case when racebook_publication_asset_cleanup_queue.status = 'deleted' then 'pending' else racebook_publication_asset_cleanup_queue.status end,
      completed_at = case when racebook_publication_asset_cleanup_queue.status = 'deleted' then null else racebook_publication_asset_cleanup_queue.completed_at end,
      available_at = least(racebook_publication_asset_cleanup_queue.available_at, timezone('utc', now()));

  delete from public.racebook_publications where id = any(doomed_ids);
end;
$$;

create or replace function public.publish_racebook_snapshot(
  p_race_id uuid,
  p_expected_draft_revision bigint,
  p_schema_version integer,
  p_content jsonb,
  p_content_hash text,
  p_assets jsonb,
  p_actor_id uuid,
  p_make_public boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  state_row public.racebook_publication_states;
  publication_row public.racebook_publications;
  next_version integer;
begin
  if jsonb_typeof(p_content) <> 'object' or p_schema_version < 1 or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid RaceBook publication payload.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_assets, '[]'::jsonb)) <> 'array' then
    raise exception 'RaceBook publication assets must be an array.' using errcode = '22023';
  end if;

  select * into state_row
  from public.racebook_publication_states
  where race_id = p_race_id
  for update;
  if state_row.race_id is null then raise exception 'RaceBook publication state not found.' using errcode = 'P0002'; end if;
  if state_row.draft_revision <> p_expected_draft_revision then
    raise exception 'RaceBook draft revision changed.' using errcode = 'PT409';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.racebook_publications where race_id = p_race_id;

  insert into public.racebook_publications (
    race_id, event_id, edition_id, version, schema_version, content, content_hash,
    source_draft_revision, published_by
  ) values (
    state_row.race_id, state_row.event_id, state_row.edition_id, next_version,
    p_schema_version, p_content, lower(p_content_hash), state_row.draft_revision, p_actor_id
  ) returning * into publication_row;

  insert into public.racebook_publication_assets (
    publication_id, asset_type, storage_bucket, storage_path, public_url
  )
  select publication_row.id, asset.asset_type, nullif(asset.storage_bucket, ''),
         nullif(asset.storage_path, ''), nullif(asset.public_url, '')
  from jsonb_to_recordset(coalesce(p_assets, '[]'::jsonb)) asset(
    asset_type text, storage_bucket text, storage_path text, public_url text
  );

  update public.racebook_publication_states
  set current_publication_id = publication_row.id,
      published_source_revision = publication_row.source_draft_revision,
      last_published_at = publication_row.published_at,
      last_published_by = publication_row.published_by,
      updated_at = timezone('utc', now())
  where race_id = p_race_id;

  if p_make_public then
    update public.races
    set is_live = true,
        racebook_preview_is_visible = true,
        racebook_is_live = true,
        racebook_publication_approved_at = coalesce(racebook_publication_approved_at, publication_row.published_at),
        racebook_publication_approved_by = coalesce(racebook_publication_approved_by, p_actor_id)
    where id = p_race_id;
  end if;

  perform private.prune_racebook_publications(p_race_id);
  return jsonb_build_object(
    'raceId', publication_row.race_id,
    'publicationId', publication_row.id,
    'version', publication_row.version,
    'sourceDraftRevision', publication_row.source_draft_revision,
    'publishedAt', publication_row.published_at
  );
end;
$$;

create or replace function public.publish_racebook_snapshots(p_items jsonb, p_actor_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  result_items jsonb := '[]'::jsonb;
  race_id uuid;
  expected_revision bigint;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'RaceBook publication items must be a non-empty array.' using errcode = '22023';
  end if;
  if exists (
    select value ->> 'raceId'
    from jsonb_array_elements(p_items)
    group by value ->> 'raceId'
    having count(*) > 1
  ) then
    raise exception 'A RaceBook format may only be published once per batch.' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    race_id := (item ->> 'raceId')::uuid;
    expected_revision := (item ->> 'expectedDraftRevision')::bigint;
    perform 1 from public.racebook_publication_states
    where racebook_publication_states.race_id = race_id
      and racebook_publication_states.draft_revision = expected_revision
    for update;
    if not found then raise exception 'RaceBook draft revision changed.' using errcode = 'PT409'; end if;
  end loop;

  for item in select value from jsonb_array_elements(p_items)
  loop
    result_items := result_items || jsonb_build_array(public.publish_racebook_snapshot(
      (item ->> 'raceId')::uuid,
      (item ->> 'expectedDraftRevision')::bigint,
      (item ->> 'schemaVersion')::integer,
      item -> 'content',
      item ->> 'contentHash',
      coalesce(item -> 'assets', '[]'::jsonb),
      p_actor_id,
      coalesce((item ->> 'makePublic')::boolean, false)
    ));
  end loop;
  return result_items;
end;
$$;

create or replace function public.restore_racebook_publication(
  p_race_id uuid,
  p_publication_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  state_row public.racebook_publication_states;
  source_row public.racebook_publications;
  restored_row public.racebook_publications;
  next_version integer;
begin
  select * into state_row from public.racebook_publication_states where race_id = p_race_id for update;
  if state_row.race_id is null then raise exception 'RaceBook publication state not found.' using errcode = 'PT404'; end if;
  select * into source_row from public.racebook_publications
  where id = p_publication_id and race_id = p_race_id;
  if source_row.id is null then raise exception 'RaceBook publication not found.' using errcode = 'PT404'; end if;

  select coalesce(max(version), 0) + 1 into next_version from public.racebook_publications where race_id = p_race_id;
  insert into public.racebook_publications (
    race_id, event_id, edition_id, version, schema_version, content, content_hash,
    source_draft_revision, published_by, restored_from_publication_id
  ) values (
    state_row.race_id, state_row.event_id, state_row.edition_id, next_version,
    source_row.schema_version, source_row.content, source_row.content_hash,
    source_row.source_draft_revision, p_actor_id, source_row.id
  ) returning * into restored_row;

  insert into public.racebook_publication_assets (publication_id, asset_type, storage_bucket, storage_path, public_url)
  select restored_row.id, asset_type, storage_bucket, storage_path, public_url
  from public.racebook_publication_assets where publication_id = source_row.id;

  update public.racebook_publication_states
  set current_publication_id = restored_row.id,
      published_source_revision = restored_row.source_draft_revision,
      last_published_at = restored_row.published_at,
      last_published_by = restored_row.published_by,
      updated_at = timezone('utc', now())
  where race_id = p_race_id;

  perform private.prune_racebook_publications(p_race_id);
  return jsonb_build_object(
    'raceId', restored_row.race_id,
    'publicationId', restored_row.id,
    'version', restored_row.version,
    'sourceDraftRevision', restored_row.source_draft_revision,
    'publishedAt', restored_row.published_at,
    'restoredFromPublicationId', source_row.id
  );
end;
$$;

revoke all on function public.ensure_racebook_publication_state() from public, anon, authenticated;
revoke all on function public.bump_racebook_race_draft_revision() from public, anon, authenticated;
revoke all on function public.bump_racebook_event_draft_revisions() from public, anon, authenticated;
revoke all on function public.bump_racebook_edition_draft_revisions() from public, anon, authenticated;
revoke all on function public.bump_racebook_race_child_draft_revision() from public, anon, authenticated;
revoke all on function public.bump_racebook_edition_child_draft_revisions() from public, anon, authenticated;
revoke all on function public.bump_racebook_sponsor_draft_revisions() from public, anon, authenticated;
revoke all on function public.bump_racebook_module_draft_revisions() from public, anon, authenticated;
revoke all on function public.bump_racebook_aid_product_draft_revision() from public, anon, authenticated;
revoke all on function public.bump_racebook_product_draft_revisions() from public, anon, authenticated;
revoke all on function public.guard_racebook_visibility_requires_publication() from public, anon, authenticated;
revoke all on function private.prune_racebook_publications(uuid) from public, anon, authenticated;
revoke all on function public.publish_racebook_snapshot(uuid, bigint, integer, jsonb, text, jsonb, uuid, boolean) from public, anon, authenticated;
revoke all on function public.publish_racebook_snapshots(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.restore_racebook_publication(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_racebook_publication_state() to service_role;
grant execute on function public.bump_racebook_race_draft_revision() to service_role;
grant execute on function public.bump_racebook_event_draft_revisions() to service_role;
grant execute on function public.bump_racebook_edition_draft_revisions() to service_role;
grant execute on function public.bump_racebook_race_child_draft_revision() to service_role;
grant execute on function public.bump_racebook_edition_child_draft_revisions() to service_role;
grant execute on function public.bump_racebook_sponsor_draft_revisions() to service_role;
grant execute on function public.bump_racebook_module_draft_revisions() to service_role;
grant execute on function public.bump_racebook_aid_product_draft_revision() to service_role;
grant execute on function public.bump_racebook_product_draft_revisions() to service_role;
grant execute on function public.guard_racebook_visibility_requires_publication() to service_role;
grant execute on function private.prune_racebook_publications(uuid) to service_role;
grant execute on function public.publish_racebook_snapshot(uuid, bigint, integer, jsonb, text, jsonb, uuid, boolean) to service_role;
grant execute on function public.publish_racebook_snapshots(jsonb, uuid) to service_role;
grant execute on function public.restore_racebook_publication(uuid, uuid, uuid) to service_role;

comment on table public.racebook_publication_states is 'Service-only draft/publication revision state for each organizer RaceBook format.';
comment on table public.racebook_publications is 'Immutable service-only RaceBook snapshots; only the current state pointer is runner-visible through server routes.';
comment on table public.racebook_publication_assets is 'Assets retained by an immutable RaceBook publication.';
comment on table public.racebook_publication_asset_cleanup_queue is 'Retryable Storage cleanup work created only after no retained publication references an object.';
