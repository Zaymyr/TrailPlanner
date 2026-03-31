alter table public.race_events
  add column if not exists thumbnail_url text;

with ranked_race_images as (
  select distinct on (event_id)
    event_id,
    thumbnail_url
  from public.races
  where event_id is not null
    and thumbnail_url is not null
    and btrim(thumbnail_url) <> ''
  order by event_id, is_live desc, id asc
)
update public.race_events as events
set thumbnail_url = ranked_race_images.thumbnail_url
from ranked_race_images
where events.id = ranked_race_images.event_id
  and (events.thumbnail_url is null or btrim(events.thumbnail_url) = '');
