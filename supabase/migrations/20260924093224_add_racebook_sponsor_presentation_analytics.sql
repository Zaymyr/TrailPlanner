alter table public.race_event_edition_sponsors
  add column partnership_level text not null default 'official',
  add column category text,
  add column contextual_placement text not null default 'none',
  add column impression_count bigint not null default 0,
  add constraint race_event_edition_sponsors_partnership_level_check
    check (partnership_level in ('principal', 'official', 'service')),
  add constraint race_event_edition_sponsors_category_check
    check (
      category is null
      or (
        category = btrim(category)
        and char_length(category) between 1 and 60
      )
    ),
  add constraint race_event_edition_sponsors_contextual_placement_check
    check (contextual_placement in ('none', 'aid_stations', 'equipment', 'access', 'services')),
  add constraint race_event_edition_sponsors_impression_count_check
    check (impression_count >= 0);

alter table public.race_event_edition_sponsors
  drop constraint race_event_edition_sponsors_active_placement_check,
  add constraint race_event_edition_sponsors_active_placement_check
    check (
      not is_active
      or show_on_loading
      or show_in_banner
      or contextual_placement <> 'none'
    );

create or replace function public.increment_racebook_sponsor_impression(
  p_sponsor_id uuid,
  p_race_id uuid,
  p_placement text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_count bigint;
begin
  if p_placement not in ('loading', 'hero', 'aid_stations', 'equipment', 'access', 'services') then
    raise exception 'Invalid sponsor impression placement.' using errcode = '22023';
  end if;

  update public.race_event_edition_sponsors as sponsor
  set impression_count = sponsor.impression_count + 1
  from public.races as race,
       public.race_events as event_row
  where sponsor.id = p_sponsor_id
    and sponsor.is_active
    and race.id = p_race_id
    and race.edition_id = sponsor.edition_id
    and race.event_id = event_row.id
    and race.is_live
    and race.racebook_is_live
    and coalesce(race.racebook_preview_is_visible, true)
    and event_row.is_live
    and (
      (p_placement = 'loading' and sponsor.show_on_loading)
      or (p_placement = 'hero' and sponsor.show_in_banner)
      or sponsor.contextual_placement = p_placement
    )
  returning sponsor.impression_count into updated_count;

  if updated_count is null then
    raise exception 'Sponsor impression target not found.' using errcode = 'P0002';
  end if;

  return updated_count;
end;
$$;

revoke all on function public.increment_racebook_sponsor_impression(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.increment_racebook_sponsor_impression(uuid, uuid, text)
  to service_role;

comment on column public.race_event_edition_sponsors.partnership_level is
  'Presentation hierarchy: principal, official, or service.';
comment on column public.race_event_edition_sponsors.category is
  'Optional short organizer-authored partner category shown with the sponsor.';
comment on column public.race_event_edition_sponsors.contextual_placement is
  'Optional RaceBook section where the sponsor may be presented contextually.';
comment on column public.race_event_edition_sponsors.impression_count is
  'Aggregate count of accepted viewable presentations; no runner identity or individual history is stored.';
comment on function public.increment_racebook_sponsor_impression(uuid, uuid, text) is
  'Atomically counts one eligible sponsor impression for a published RaceBook and validated placement.';

-- Give the fictitious Trail TST showcase a representative hierarchy without
-- changing any real organizer content.
update public.race_event_edition_sponsors
set partnership_level = 'principal',
    category = 'Équipement outdoor',
    contextual_placement = 'equipment'
where id = '7a110000-5001-4000-8000-000000000001';

update public.race_event_edition_sponsors
set partnership_level = 'official',
    category = 'Engagement environnemental',
    contextual_placement = 'services'
where id = '7a110000-5002-4000-8000-000000000002';

update public.race_event_edition_sponsors
set partnership_level = 'service',
    category = 'Hébergement',
    contextual_placement = 'services'
where id = '7a110000-5003-4000-8000-000000000003';
