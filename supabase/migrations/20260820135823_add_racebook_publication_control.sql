alter table public.races
  add column if not exists racebook_is_live boolean not null default false,
  add column if not exists racebook_publication_approved_at timestamptz,
  add column if not exists racebook_publication_approved_by uuid references auth.users(id) on delete set null;

alter table public.races
  drop constraint if exists races_racebook_live_requires_approval;
alter table public.races
  add constraint races_racebook_live_requires_approval
  check (racebook_is_live = false or racebook_publication_approved_at is not null);

comment on column public.races.racebook_is_live is
  'Runner-facing Racebook visibility, independent from catalog race visibility.';
comment on column public.races.racebook_publication_approved_at is
  'Durable admin approval timestamp after which an organizer may publish or hide this Racebook.';
comment on column public.races.racebook_publication_approved_by is
  'Trusted admin who first approved this Racebook for organizer-controlled publication.';

-- Organizer-managed course rows remain visible in the catalog. Racebooks deliberately
-- start hidden and require a fresh admin approval through the new workflow.
update public.race_events event_row
set is_live = true
where exists (
  select 1
  from public.race_event_organizers organizer_row
  where organizer_row.event_id = event_row.id
);

update public.races race_row
set is_live = true,
    racebook_is_live = false,
    racebook_publication_approved_at = null,
    racebook_publication_approved_by = null
where race_row.event_id is not null
  and exists (
    select 1
    from public.race_event_organizers organizer_row
    where organizer_row.event_id = race_row.event_id
  );

create or replace function public.review_race_event_publication_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_status text,
  p_reviewer_notes text default null
)
returns public.race_event_publication_requests
language plpgsql
set search_path = ''
as $$
declare
  publication_request public.race_event_publication_requests;
  reviewed_request public.race_event_publication_requests;
  current_edition_id uuid;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid publication review status.';
  end if;

  select * into publication_request
  from public.race_event_publication_requests
  where id = p_request_id
  for update;

  if publication_request.id is null then
    raise exception 'Publication request not found.';
  end if;
  if publication_request.status <> 'pending' then
    raise exception 'Publication request has already been reviewed.';
  end if;

  if p_status = 'approved' then
    select edition_row.id into current_edition_id
    from public.race_event_editions edition_row
    where edition_row.event_id = publication_request.event_id
      and edition_row.is_current
      and edition_row.end_date >= edition_row.start_date
    limit 1;

    if current_edition_id is null or not exists (
      select 1
      from public.race_events event_row
      where event_row.id = publication_request.event_id
        and nullif(btrim(event_row.name), '') is not null
        and nullif(btrim(coalesce(event_row.location, '')), '') is not null
    ) then
      raise exception 'Event publication fields are incomplete.';
    end if;

    if not exists (
      select 1
      from public.races race_row
      where race_row.edition_id = current_edition_id
        and nullif(btrim(race_row.name), '') is not null
        and race_row.distance_km > 0
        and race_row.elevation_gain_m >= 0
    ) then
      raise exception 'No publishable format exists for the current edition.';
    end if;

    update public.races
    set is_live = true,
        racebook_is_live = true,
        racebook_publication_approved_at = coalesce(racebook_publication_approved_at, timezone('utc', now())),
        racebook_publication_approved_by = coalesce(racebook_publication_approved_by, p_reviewer_id)
    where edition_id = current_edition_id
      and nullif(btrim(name), '') is not null
      and distance_km > 0
      and elevation_gain_m >= 0;

    update public.race_events
    set is_live = true
    where id = publication_request.event_id;
  end if;

  update public.race_event_publication_requests
  set status = p_status,
      reviewed_by = p_reviewer_id,
      reviewed_at = timezone('utc', now()),
      reviewer_notes = nullif(btrim(coalesce(p_reviewer_notes, '')), '')
  where id = p_request_id
  returning * into reviewed_request;

  return reviewed_request;
end;
$$;

revoke all on function public.review_race_event_publication_request(uuid, uuid, text, text) from public;
grant execute on function public.review_race_event_publication_request(uuid, uuid, text, text) to service_role;

create or replace function public.set_race_event_racebook_visibility(
  p_event_id uuid,
  p_reviewer_id uuid,
  p_is_live boolean
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  current_edition_id uuid;
  changed_count integer := 0;
begin
  if p_is_live then
    select edition_row.id into current_edition_id
    from public.race_event_editions edition_row
    where edition_row.event_id = p_event_id
      and edition_row.is_current
      and edition_row.end_date >= edition_row.start_date
    limit 1;

    if current_edition_id is null or not exists (
      select 1
      from public.race_events event_row
      where event_row.id = p_event_id
        and nullif(btrim(event_row.name), '') is not null
        and nullif(btrim(coalesce(event_row.location, '')), '') is not null
    ) then
      raise exception 'Event publication fields are incomplete.';
    end if;

    update public.races
    set is_live = true,
        racebook_is_live = true,
        racebook_publication_approved_at = coalesce(racebook_publication_approved_at, timezone('utc', now())),
        racebook_publication_approved_by = coalesce(racebook_publication_approved_by, p_reviewer_id)
    where edition_id = current_edition_id
      and nullif(btrim(name), '') is not null
      and distance_km > 0
      and elevation_gain_m >= 0;
    get diagnostics changed_count = row_count;

    if changed_count = 0 then
      raise exception 'No publishable format exists for the current edition.';
    end if;

    update public.race_events
    set is_live = true
    where id = p_event_id;

    update public.race_event_publication_requests
    set status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_at = timezone('utc', now()),
        reviewer_notes = coalesce(reviewer_notes, 'Publication validée depuis le contrôle admin des Racebooks.')
    where event_id = p_event_id
      and status = 'pending';
  else
    update public.races
    set racebook_is_live = false
    where event_id = p_event_id
      and racebook_is_live = true;
    get diagnostics changed_count = row_count;
  end if;

  return changed_count;
end;
$$;

revoke all on function public.set_race_event_racebook_visibility(uuid, uuid, boolean) from public;
grant execute on function public.set_race_event_racebook_visibility(uuid, uuid, boolean) to service_role;
