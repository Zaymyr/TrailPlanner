-- Structured SAS times are authoritative while at least one wave exists.
-- Removing the last wave restores manual control without erasing the last
-- useful global start time from races.organizer_details.
create or replace function public.replace_race_start_waves(p_race_id uuid, p_items jsonb)
returns setof public.race_start_waves
language plpgsql
security invoker
set search_path = ''
as $$
declare
  first_time time;
begin
  delete from public.race_start_waves where race_id = p_race_id;

  insert into public.race_start_waves (
    id,
    race_id,
    name,
    start_time,
    eligibility_type,
    bib_number_min,
    bib_number_max,
    finish_minutes_min,
    finish_minutes_max,
    pace_seconds_min,
    pace_seconds_max,
    eligibility_note,
    order_index
  )
  select
    coalesce(x.id, gen_random_uuid()),
    p_race_id,
    x.name,
    x.start_time,
    x.eligibility_type,
    x.bib_number_min,
    x.bib_number_max,
    x.finish_minutes_min,
    x.finish_minutes_max,
    x.pace_seconds_min,
    x.pace_seconds_max,
    x.eligibility_note,
    x.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(
    id uuid,
    name text,
    start_time time,
    eligibility_type text,
    bib_number_min integer,
    bib_number_max integer,
    finish_minutes_min integer,
    finish_minutes_max integer,
    pace_seconds_min integer,
    pace_seconds_max integer,
    eligibility_note text,
    order_index integer
  );

  select min(start_time)
  into first_time
  from public.race_start_waves
  where race_id = p_race_id;

  if first_time is not null then
    update public.races
    set organizer_details = jsonb_set(
      coalesce(organizer_details, '{}'::jsonb)
        || jsonb_build_object('schedule', coalesce(organizer_details -> 'schedule', '{}'::jsonb)),
      '{schedule,startTime}',
      to_jsonb(first_time::text),
      true
    )
    where id = p_race_id;
  end if;

  return query
  select *
  from public.race_start_waves
  where race_id = p_race_id
  order by order_index;
end;
$$;

revoke all on function public.replace_race_start_waves(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_race_start_waves(uuid, jsonb) to service_role;
