create table public.race_event_editions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  event_id uuid not null references public.race_events(id) on delete cascade,
  edition_year smallint not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  constraint race_event_editions_event_year_key unique (event_id, edition_year),
  constraint race_event_editions_year_check check (edition_year between 2000 and 2100),
  constraint race_event_editions_start_year_check check (edition_year = extract(year from start_date)::smallint),
  constraint race_event_editions_date_order_check check (end_date >= start_date)
);

create index race_event_editions_event_start_idx
  on public.race_event_editions(event_id, start_date desc);

create unique index race_event_editions_current_event_idx
  on public.race_event_editions(event_id)
  where is_current;

create or replace function public.set_race_event_editions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_race_event_editions_updated_at
before update on public.race_event_editions
for each row execute function public.set_race_event_editions_updated_at();

insert into public.race_event_editions (event_id, edition_year, start_date, end_date)
select
  r.event_id,
  extract(year from r.race_date)::smallint,
  min(r.race_date::date),
  max(r.race_date::date)
from public.races r
where r.event_id is not null
  and r.race_date is not null
group by r.event_id, extract(year from r.race_date)
on conflict (event_id, edition_year) do nothing;

insert into public.race_event_editions (event_id, edition_year, start_date, end_date)
select
  re.id,
  extract(year from re.race_date)::smallint,
  re.race_date::date,
  case
    when coalesce(re.organizer_details -> 'dateRange' ->> 'endDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and (re.organizer_details -> 'dateRange' ->> 'endDate')::date >= re.race_date::date
      then (re.organizer_details -> 'dateRange' ->> 'endDate')::date
    else re.race_date::date
  end
from public.race_events re
where re.race_date is not null
on conflict (event_id, edition_year) do update
set start_date = least(race_event_editions.start_date, excluded.start_date),
    end_date = greatest(race_event_editions.end_date, excluded.end_date);

with ranked_editions as (
  select
    ree.id,
    row_number() over (
      partition by ree.event_id
      order by
        case
          when re.race_date is not null and ree.edition_year = extract(year from re.race_date)::smallint then 0
          else 1
        end,
        ree.start_date desc
    ) as edition_rank
  from public.race_event_editions ree
  join public.race_events re on re.id = ree.event_id
)
update public.race_event_editions ree
set is_current = true
from ranked_editions ranked
where ranked.id = ree.id
  and ranked.edition_rank = 1;

alter table public.races
  add column if not exists edition_id uuid references public.race_event_editions(id) on delete set null;

update public.races r
set edition_id = ree.id
from public.race_event_editions ree
where r.edition_id is null
  and r.event_id = ree.event_id
  and r.race_date is not null
  and extract(year from r.race_date)::smallint = ree.edition_year;

create index if not exists races_edition_id_idx
  on public.races(edition_id);

create or replace function public.validate_race_event_edition_range()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.races r
    where r.edition_id = new.id
      and r.race_date is not null
      and (r.race_date::date < new.start_date or r.race_date::date > new.end_date)
  ) then
    raise exception 'Edition date range excludes an attached format.';
  end if;
  return new;
end;
$$;

create trigger validate_race_event_edition_range
before update of start_date, end_date on public.race_event_editions
for each row execute function public.validate_race_event_edition_range();

create or replace function public.validate_race_edition_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  edition_event_id uuid;
  edition_start_date date;
  edition_end_date date;
begin
  if new.edition_id is null then
    return new;
  end if;

  select event_id, start_date, end_date
  into edition_event_id, edition_start_date, edition_end_date
  from public.race_event_editions
  where id = new.edition_id;

  if edition_event_id is null or new.event_id is distinct from edition_event_id then
    raise exception 'Race and edition must belong to the same event.';
  end if;
  if new.race_date is not null
    and (new.race_date::date < edition_start_date or new.race_date::date > edition_end_date) then
    raise exception 'Race date must be inside its edition date range.';
  end if;
  return new;
end;
$$;

create trigger validate_race_edition_membership
before insert or update of event_id, edition_id, race_date on public.races
for each row execute function public.validate_race_edition_membership();

create or replace function public.sync_current_race_event_edition_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_current then
    update public.race_events
    set race_date = new.start_date,
        organizer_details = coalesce(organizer_details, '{}'::jsonb)
          || jsonb_build_object(
            'dateRange',
            coalesce(organizer_details -> 'dateRange', '{}'::jsonb)
              || jsonb_build_object('endDate', new.end_date::text)
          )
    where id = new.event_id;
  end if;
  return new;
end;
$$;

create trigger sync_current_race_event_edition_dates
after insert or update of start_date, end_date, is_current on public.race_event_editions
for each row execute function public.sync_current_race_event_edition_dates();

alter table public.race_event_editions enable row level security;

revoke all on public.race_event_editions from anon, authenticated;
grant select, insert, update, delete on public.race_event_editions to service_role;

comment on table public.race_event_editions is
  'Canonical yearly date ranges for organizer-managed race events.';
comment on column public.race_event_editions.is_current is
  'The edition mirrored to legacy race_events date fields and targeted by the next publication review.';
comment on column public.races.edition_id is
  'Canonical yearly event edition for this format; nullable only for legacy undated rows.';

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
    select ree.id into current_edition_id
    from public.race_event_editions ree
    where ree.event_id = publication_request.event_id
      and ree.is_current
      and ree.end_date >= ree.start_date
    limit 1;

    if current_edition_id is null or not exists (
      select 1
      from public.race_events re
      where re.id = publication_request.event_id
        and nullif(btrim(re.name), '') is not null
        and nullif(btrim(coalesce(re.location, '')), '') is not null
    ) then
      raise exception 'Event publication fields are incomplete.';
    end if;

    if not exists (
      select 1
      from public.races r
      where r.edition_id = current_edition_id
        and nullif(btrim(r.name), '') is not null
        and r.distance_km > 0
        and r.elevation_gain_m >= 0
    ) then
      raise exception 'No publishable format exists for the current edition.';
    end if;

    update public.races
    set is_live = true
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
