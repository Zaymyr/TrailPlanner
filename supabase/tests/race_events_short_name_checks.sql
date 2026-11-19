-- race_events.short_name checks (reel hook short name).
-- Run in a privileged SQL session after 20261119150000_add_race_events_short_name.sql.
-- Every data mutation is rolled back.

begin;

do $$
declare
  event_id uuid;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'race_events'
      and column_name = 'short_name'
      and data_type = 'text'
      and is_nullable = 'YES'
      and column_default is null
  ) then
    raise exception 'race_events.short_name must exist as a nullable text column without default.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.race_events'::regclass
      and conname = 'race_events_short_name_check'
      and contype = 'c'
  ) then
    raise exception 'race_events_short_name_check must exist.';
  end if;

  select id into event_id from public.race_events limit 1;
  if event_id is null then
    raise notice 'No race_events row: value checks skipped.';
    return;
  end if;

  update public.race_events set short_name = null where id = event_id;
  update public.race_events set short_name = 'Hivernale des Templiers' where id = event_id;
  update public.race_events set short_name = repeat('a', 40) where id = event_id;

  begin
    update public.race_events set short_name = repeat('a', 41) where id = event_id;
    raise exception 'A short name over 40 characters must be rejected.';
  exception when check_violation then
    null;
  end;

  begin
    update public.race_events set short_name = '   ' where id = event_id;
    raise exception 'A blank short name must be rejected.';
  exception when check_violation then
    null;
  end;

  begin
    update public.race_events set short_name = 'Hivernale des Templ…' where id = event_id;
    raise exception 'A short name with an ellipsis must be rejected.';
  exception when check_violation then
    null;
  end;
end $$;

rollback;
