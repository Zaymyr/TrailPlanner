alter table public.race_event_publication_requests
  add column if not exists race_id uuid references public.races(id) on delete cascade;

comment on column public.race_event_publication_requests.race_id is
  'Exact Racebook format requested by the organizer. Nullable only for legacy event-level requests.';

create index if not exists race_event_publication_requests_race_idx
  on public.race_event_publication_requests(race_id, status, created_at desc);

drop index if exists public.race_event_publication_requests_pending_event_idx;
create unique index if not exists race_event_publication_requests_pending_race_idx
  on public.race_event_publication_requests(race_id)
  where status = 'pending' and race_id is not null;
create unique index if not exists race_event_publication_requests_pending_legacy_event_idx
  on public.race_event_publication_requests(event_id)
  where status = 'pending' and race_id is null;

drop policy if exists "Users can create own race event publication requests"
  on public.race_event_publication_requests;
create policy "Users can create own race event publication requests"
on public.race_event_publication_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and race_id is not null
  and exists (
    select 1
    from public.race_event_organizers organizer_row
    where organizer_row.event_id = race_event_publication_requests.event_id
      and organizer_row.user_id = (select auth.uid())
      and organizer_row.revoked_at is null
  )
  and exists (
    select 1
    from public.races race_row
    where race_row.id = race_event_publication_requests.race_id
      and race_row.event_id = race_event_publication_requests.event_id
  )
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
    if not exists (
      select 1
      from public.race_events event_row
      where event_row.id = publication_request.event_id
        and nullif(btrim(event_row.name), '') is not null
        and nullif(btrim(coalesce(event_row.location, '')), '') is not null
    ) then
      raise exception 'Event publication fields are incomplete.';
    end if;

    if publication_request.race_id is not null then
      if not exists (
        select 1
        from public.races race_row
        join public.race_event_editions edition_row
          on edition_row.id = race_row.edition_id
         and edition_row.event_id = publication_request.event_id
         and edition_row.end_date >= edition_row.start_date
        where race_row.id = publication_request.race_id
          and race_row.event_id = publication_request.event_id
          and nullif(btrim(race_row.name), '') is not null
          and race_row.distance_km > 0
          and race_row.elevation_gain_m >= 0
      ) then
        raise exception 'Requested format publication fields are incomplete.';
      end if;

      update public.races
      set is_live = true,
          racebook_is_live = true,
          racebook_publication_approved_at = coalesce(racebook_publication_approved_at, timezone('utc', now())),
          racebook_publication_approved_by = coalesce(racebook_publication_approved_by, p_reviewer_id)
      where id = publication_request.race_id
        and event_id = publication_request.event_id;
    else
      select edition_row.id into current_edition_id
      from public.race_event_editions edition_row
      where edition_row.event_id = publication_request.event_id
        and edition_row.is_current
        and edition_row.end_date >= edition_row.start_date
      limit 1;

      if current_edition_id is null or not exists (
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
    end if;

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

    update public.race_event_publication_requests request_row
    set status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_at = timezone('utc', now()),
        reviewer_notes = coalesce(request_row.reviewer_notes, 'Publication validée depuis le contrôle admin des Racebooks.')
    where request_row.event_id = p_event_id
      and request_row.status = 'pending'
      and (
        request_row.race_id is null
        or exists (
          select 1
          from public.races race_row
          where race_row.id = request_row.race_id
            and race_row.edition_id = current_edition_id
            and race_row.racebook_publication_approved_at is not null
        )
      );
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
