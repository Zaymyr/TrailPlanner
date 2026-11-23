begin;

-- MaXi-Race Annecy kept its finished 2026 edition as the current one while the
-- published 2027 formats belong to the 2027 edition. The stale event date
-- (2026-05-16) pulled the event to the top of the mobile catalog. Promote the
-- 2027 edition; sync_current_race_event_edition_dates then moves the event
-- date to the 2027 start date.
do $$
declare
  target_event uuid := '8b7ea449-90a9-4695-805a-4926ef7a4a0e';
begin
  if not exists (
    select 1 from public.race_event_editions
    where event_id = target_event and edition_year = 2027
  ) then
    raise exception 'MaXi-Race Annecy 2027 edition not found';
  end if;

  update public.race_event_editions
  set is_current = false
  where event_id = target_event and is_current and edition_year <> 2027;

  update public.race_event_editions
  set is_current = true
  where event_id = target_event and edition_year = 2027;

  if not exists (
    select 1 from public.race_events
    where id = target_event and race_date >= date '2027-01-01'
  ) then
    raise exception 'MaXi-Race Annecy event date was not moved to the 2027 edition';
  end if;
end;
$$;

commit;
