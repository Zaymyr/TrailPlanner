create or replace function public.assign_race_event_edition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_edition_id uuid;
  target_year smallint;
begin
  if new.edition_id is not null or new.event_id is null or new.race_date is null then
    return new;
  end if;

  target_year := extract(year from new.race_date)::smallint;

  -- Serialize edition creation per event so concurrent imports cannot both
  -- attempt to create the first current edition.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.event_id::text, 0)
  );

  insert into public.race_event_editions (
    event_id,
    edition_year,
    start_date,
    end_date,
    is_current
  ) values (
    new.event_id,
    target_year,
    new.race_date::date,
    new.race_date::date,
    false
  )
  on conflict (event_id, edition_year) do update
  set start_date = least(public.race_event_editions.start_date, excluded.start_date),
      end_date = greatest(public.race_event_editions.end_date, excluded.end_date)
  returning id into target_edition_id;

  if not exists (
    select 1
    from public.race_event_editions edition_row
    where edition_row.event_id = new.event_id
      and edition_row.is_current = true
  ) then
    update public.race_event_editions
    set is_current = true
    where id = target_edition_id;
  end if;

  new.edition_id := target_edition_id;
  return new;
end;
$$;

drop trigger if exists assign_race_event_edition_trigger on public.races;
create trigger assign_race_event_edition_trigger
before insert or update of event_id, edition_id, race_date on public.races
for each row execute function public.assign_race_event_edition();

-- Repair events and formats created by catalog/import paths after the original
-- race_event_editions backfill migration.
insert into public.race_event_editions (
  event_id,
  edition_year,
  start_date,
  end_date,
  is_current
)
select
  race_row.event_id,
  extract(year from race_row.race_date)::smallint,
  min(race_row.race_date::date),
  max(race_row.race_date::date),
  false
from public.races race_row
where race_row.event_id is not null
  and race_row.race_date is not null
group by race_row.event_id, extract(year from race_row.race_date)
on conflict (event_id, edition_year) do update
set start_date = least(public.race_event_editions.start_date, excluded.start_date),
    end_date = greatest(public.race_event_editions.end_date, excluded.end_date);

insert into public.race_event_editions (
  event_id,
  edition_year,
  start_date,
  end_date,
  is_current
)
select
  event_row.id,
  extract(year from event_row.race_date)::smallint,
  event_row.race_date::date,
  case
    when coalesce(event_row.organizer_details -> 'dateRange' ->> 'endDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and (event_row.organizer_details -> 'dateRange' ->> 'endDate')::date >= event_row.race_date::date
      then (event_row.organizer_details -> 'dateRange' ->> 'endDate')::date
    else event_row.race_date::date
  end,
  false
from public.race_events event_row
where event_row.race_date is not null
on conflict (event_id, edition_year) do update
set start_date = least(public.race_event_editions.start_date, excluded.start_date),
    end_date = greatest(public.race_event_editions.end_date, excluded.end_date);

with ranked_missing_current as (
  select
    edition_row.id,
    row_number() over (
      partition by edition_row.event_id
      order by
        case
          when event_row.race_date is not null
            and edition_row.edition_year = extract(year from event_row.race_date)::smallint
            then 0
          else 1
        end,
        edition_row.start_date desc,
        edition_row.id
    ) as edition_rank
  from public.race_event_editions edition_row
  join public.race_events event_row on event_row.id = edition_row.event_id
  where not exists (
    select 1
    from public.race_event_editions current_row
    where current_row.event_id = edition_row.event_id
      and current_row.is_current = true
  )
)
update public.race_event_editions edition_row
set is_current = true
from ranked_missing_current ranked
where ranked.id = edition_row.id
  and ranked.edition_rank = 1;

update public.races race_row
set edition_id = edition_row.id
from public.race_event_editions edition_row
where race_row.edition_id is null
  and race_row.event_id = edition_row.event_id
  and race_row.race_date is not null
  and extract(year from race_row.race_date)::smallint = edition_row.edition_year;

revoke all on function public.assign_race_event_edition() from public, anon, authenticated;
grant execute on function public.assign_race_event_edition() to service_role;

comment on function public.assign_race_event_edition() is
  'Assigns a dated event format to its canonical yearly edition, creating that edition atomically when missing.';
