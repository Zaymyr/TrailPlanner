-- Hong Kong has its own ISO 3166-1 alpha-2 code. Keep the event's official
-- Lantau/Hong Kong identity distinct from mainland-China catalog filters.
update public.race_events
set location_country = 'Hong Kong',
    location_country_code = 'HK'
where id = '80ab8ea8-f911-438f-8706-19acefbdd5ac'
  and name = 'Translantau™ by UTMB®'
  and location_country_code = 'CN';

do $$
begin
  if not exists (
    select 1
    from public.race_events
    where id = '80ab8ea8-f911-438f-8706-19acefbdd5ac'
      and location_country = 'Hong Kong'
      and location_country_code = 'HK'
  ) then
    raise exception 'Expected Translantau to use Hong Kong country code HK';
  end if;
end;
$$;
