-- Fill the canonical event website for every currently published catalog event
-- that was missing one when the catalog was audited on 2026-09-23. Existing
-- values always win so a newer organizer correction is never overwritten.
with event_websites (id, website_url) as (
  values
    ('8b7ea449-90a9-4695-805a-4926ef7a4a0e'::uuid, 'https://www.maxi-race.org/'),
    ('4611d361-52e1-46e9-9860-4b197448e416'::uuid, 'https://www.tracedesmaquisards.fr/'),
    ('08a81d9c-7682-4e6a-947d-9b17573dca92'::uuid, 'https://www.marathonmontblanc.fr/'),
    ('664f160a-76d7-434c-a805-5ba8690b3304'::uuid, 'https://duotrailvert.fr/'),
    ('5e328b3c-2301-4178-a0b0-30cfcb71505c'::uuid, 'https://amazeaunes.fr/'),
    ('e0105312-c180-4924-87bd-7de6824dd87f'::uuid, 'https://www.courirvosges.com/trailbouzey2026'),
    ('6ff90fc0-b949-451c-9b53-17acb95a3a05'::uuid, 'https://chouettecourse.com/'),
    ('bddc615a-1474-495c-9d77-315c58c02750'::uuid, 'https://www.estran.org/'),
    ('f8a7ce9e-99da-4571-9227-ae7b7e4273e4'::uuid, 'https://www.traildesroismaudits.com/'),
    ('3593fa6a-ee15-4236-85c0-a4cc1cecc9c7'::uuid, 'https://mythp.fr/thp-winter/'),
    ('aab7ab38-eae1-4e2e-b6dd-6c57e6a04da0'::uuid, 'https://www.trail-cabornis.fr/'),
    ('fc02a808-53cb-46fc-8be0-ab8fa1d5e943'::uuid, 'https://www.trailfortdetamie.com/'),
    ('0eec876e-bb5c-4bef-85f1-073904fad739'::uuid, 'https://www.traildulacdepaladru.fr/')
)
update public.race_events as event
set
  website_url = source.website_url,
  organizer_details = case
    when nullif(btrim(event.organizer_details #>> '{officialWebsiteUrl}'), '') is null then
      jsonb_set(
        coalesce(event.organizer_details, '{}'::jsonb),
        '{officialWebsiteUrl}',
        to_jsonb(source.website_url),
        true
      )
    else event.organizer_details
  end
from event_websites as source
where event.id = source.id
  and nullif(btrim(event.website_url), '') is null;
