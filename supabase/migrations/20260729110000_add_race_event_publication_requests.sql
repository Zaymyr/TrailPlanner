create table if not exists public.race_event_publication_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.race_events(id) on delete cascade,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_notes text,
  constraint race_event_publication_requests_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

create or replace function public.set_race_event_publication_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_race_event_publication_requests_updated_at
  on public.race_event_publication_requests;
create trigger set_race_event_publication_requests_updated_at
before update on public.race_event_publication_requests
for each row execute function public.set_race_event_publication_requests_updated_at();

create index if not exists race_event_publication_requests_user_idx
  on public.race_event_publication_requests(user_id, created_at desc);
create index if not exists race_event_publication_requests_event_idx
  on public.race_event_publication_requests(event_id, status, created_at desc);
create unique index if not exists race_event_publication_requests_pending_event_idx
  on public.race_event_publication_requests(event_id)
  where status = 'pending';

alter table public.race_event_publication_requests enable row level security;

grant select, insert on public.race_event_publication_requests to authenticated;
grant select, insert, update on public.race_event_publication_requests to service_role;

create policy "Users can create own race event publication requests"
on public.race_event_publication_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1
    from public.race_event_organizers reo
    where reo.event_id = race_event_publication_requests.event_id
      and reo.user_id = (select auth.uid())
      and reo.revoked_at is null
  )
);

create policy "Users can view own race event publication requests"
on public.race_event_publication_requests
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
);

create or replace function public.review_race_event_publication_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_status text,
  p_reviewer_notes text default null
)
returns public.race_event_publication_requests
language plpgsql
set search_path = public
as $$
declare
  publication_request public.race_event_publication_requests;
  reviewed_request public.race_event_publication_requests;
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
      from public.race_events re
      where re.id = publication_request.event_id
        and nullif(btrim(re.name), '') is not null
        and nullif(btrim(coalesce(re.location, '')), '') is not null
        and re.race_date is not null
        and nullif(btrim(coalesce(re.organizer_details -> 'dateRange' ->> 'endDate', '')), '') is not null
    ) then
      raise exception 'Event publication fields are incomplete.';
    end if;

    if not exists (
      select 1
      from public.races r
      where r.event_id = publication_request.event_id
        and nullif(btrim(r.name), '') is not null
        and r.distance_km > 0
        and r.elevation_gain_m >= 0
    ) then
      raise exception 'No publishable format exists for this event.';
    end if;

    update public.races
    set is_live = true
    where event_id = publication_request.event_id
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

comment on table public.race_event_publication_requests is
  'Organizer requests requiring admin review before an event and its complete formats become live.';

-- Yearly editions are now created directly as drafts; close and disable the retired review queue.
update public.race_event_edition_requests
set status = 'rejected',
    reviewed_at = timezone('utc', now()),
    reviewer_notes = coalesce(reviewer_notes, 'Workflow retired: editions are now created directly as drafts.')
where status = 'pending';

revoke insert, update on public.race_event_edition_requests from authenticated;
drop policy if exists "Users can create own race event edition requests" on public.race_event_edition_requests;
