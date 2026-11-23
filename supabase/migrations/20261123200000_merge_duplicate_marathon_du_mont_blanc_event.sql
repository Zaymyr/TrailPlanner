-- Merge the duplicate "Marathon du Mont-Blanc" race events (founder decision, 2026-11-23).
--
-- The 2026 edition lived under event 08a81d9c (catalogue import, March 2026) and the 2027
-- edition under event d1472716 (organizer-style import, November 2026). Both are the same
-- event, so the permanent hub /courses/evenements/<slug> was split in two suffixed slugs.
--
-- Kept event: d1472716 (2027 edition, 12 formats, Livret coureur publication states).
-- Merged event: 08a81d9c (2026 edition, 2 formats). Its edition, formats and any other
-- reference move to the kept event, missing event fields are filled from it, then it is
-- deleted. The kept event takes the clean slug "marathon-du-mont-blanc"; the two former
-- suffixed hub URLs redirect permanently in apps/web/next.config.mjs.
--
-- Idempotent: does nothing once the merged event no longer exists.

do $$
declare
  kept_id constant uuid := 'd1472716-487c-490e-a022-7af079a3bc48';
  merged_id constant uuid := '08a81d9c-7682-4e6a-947d-9b17573dca92';
begin
  if not exists (select 1 from public.race_events where id = merged_id) then
    raise notice 'Marathon du Mont-Blanc already merged, nothing to do.';
    return;
  end if;

  if not exists (select 1 from public.race_events where id = kept_id) then
    raise exception 'Kept Marathon du Mont-Blanc event % is missing; refusing to merge.', kept_id;
  end if;

  -- Fill event-level fields the kept event does not have yet.
  update public.race_events as kept
  set
    thumbnail_url = coalesce(kept.thumbnail_url, merged.thumbnail_url),
    logo_url = coalesce(kept.logo_url, merged.logo_url),
    description = coalesce(kept.description, merged.description),
    location_latitude = coalesce(kept.location_latitude, merged.location_latitude),
    location_longitude = coalesce(kept.location_longitude, merged.location_longitude),
    location_city_code = coalesce(kept.location_city_code, merged.location_city_code),
    organizer_details = coalesce(kept.organizer_details, merged.organizer_details)
  from public.race_events as merged
  where kept.id = kept_id
    and merged.id = merged_id;

  -- Re-point every reference to the merged event (all on delete cascade or set null,
  -- so nothing may be left behind before the delete).
  -- One current edition per event (race_event_editions_current_event_idx): the kept event's
  -- 2027 edition stays current, the merged 2026 edition (already run) becomes historical.
  update public.race_event_editions set is_current = false where event_id = merged_id and is_current;
  update public.race_event_editions set event_id = kept_id where event_id = merged_id;
  update public.races set event_id = kept_id where event_id = merged_id;
  update public.race_event_claims set event_id = kept_id where event_id = merged_id;
  update public.race_event_edition_requests set event_id = kept_id where event_id = merged_id;
  update public.race_event_publication_requests set event_id = kept_id where event_id = merged_id;
  update public.race_event_updates set event_id = kept_id where event_id = merged_id;
  update public.organizer_import_sessions set event_id = kept_id where event_id = merged_id;
  update public.racebook_publication_states set event_id = kept_id where event_id = merged_id;
  update public.racebook_publications set event_id = kept_id where event_id = merged_id;

  -- Membership and favorites are unique per (user, event): keep the kept event's row.
  update public.race_event_organizers as row_to_move
  set event_id = kept_id
  where row_to_move.event_id = merged_id
    and not exists (
      select 1 from public.race_event_organizers as existing
      where existing.event_id = kept_id and existing.user_id = row_to_move.user_id
    );
  update public.user_favorite_race_events as row_to_move
  set event_id = kept_id
  where row_to_move.event_id = merged_id
    and not exists (
      select 1 from public.user_favorite_race_events as existing
      where existing.event_id = kept_id and existing.user_id = row_to_move.user_id
    );

  delete from public.race_events where id = merged_id;

  -- Event slugs are immutable by design (assign_race_event_slug). This one-off rename to the
  -- clean base slug is safe: the slug is free once the duplicate is gone, no edition uses it,
  -- and both former hub URLs redirect in next.config.mjs.
  alter table public.race_events disable trigger assign_race_event_slug;
  update public.race_events set slug = 'marathon-du-mont-blanc', name = 'Marathon du Mont-Blanc' where id = kept_id;
  alter table public.race_events enable trigger assign_race_event_slug;
end
$$;
