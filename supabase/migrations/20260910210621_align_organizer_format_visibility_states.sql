-- Keep Organizer's format visibility states atomic across catalog and RaceBook access.
create or replace function public.set_organizer_racebook_visibility(
  p_user_id uuid,
  p_race_id uuid,
  p_is_live boolean
)
returns public.races
language plpgsql
security invoker
set search_path = ''
as $$
declare
  race_row public.races;
  entitlement_tier text;
  updated_race public.races;
begin
  select *
  into race_row
  from public.races
  where id = p_race_id
  for update;

  if race_row.id is null then
    raise exception 'Race not found.';
  end if;

  if not exists (
    select 1
    from public.race_event_organizers organizer_row
    where organizer_row.event_id = race_row.event_id
      and organizer_row.user_id = p_user_id
      and organizer_row.revoked_at is null
  ) then
    raise exception 'Organizer access required.';
  end if;

  if p_is_live then
    if coalesce(race_row.data_status, 'complete') = 'draft' then
      raise exception 'Race format is incomplete.';
    end if;

    if race_row.edition_id is null then
      raise exception 'Race edition is required.';
    end if;

    if not exists (
      select 1
      from public.race_event_editions edition_row
      where edition_row.id = race_row.edition_id
        and edition_row.is_visible
    ) then
      raise exception 'Race edition is hidden.';
    end if;

    select entitlement_row.tier
    into entitlement_tier
    from public.organizer_edition_entitlements entitlement_row
    where entitlement_row.edition_id = race_row.edition_id
      and entitlement_row.status = 'active';

    if entitlement_tier not in ('essential', 'complete', 'signature') then
      raise exception 'RaceBook entitlement required.';
    end if;
  end if;

  update public.races
  set is_live = p_is_live,
      racebook_preview_is_visible = true,
      racebook_is_live = p_is_live,
      racebook_publication_approved_at = case
        when p_is_live then coalesce(racebook_publication_approved_at, timezone('utc', now()))
        else racebook_publication_approved_at
      end,
      racebook_publication_approved_by = case
        when p_is_live then coalesce(racebook_publication_approved_by, p_user_id)
        else racebook_publication_approved_by
      end
  where id = p_race_id
  returning * into updated_race;

  return updated_race;
end;
$$;

revoke all on function public.set_organizer_racebook_visibility(uuid, uuid, boolean)
from public, anon, authenticated;
grant execute on function public.set_organizer_racebook_visibility(uuid, uuid, boolean)
to service_role;

-- Normalize existing Organizer formats to the clarified contract. A format
-- whose RaceBook is not public is private or masked, never a public course.
update public.races race_row
set is_live = false
where race_row.racebook_is_live = false
  and exists (
    select 1
    from public.race_event_organizers organizer_row
    where organizer_row.event_id = race_row.event_id
  );

-- A catalog format can remain an is_public source row while its Organizer
-- visibility is private. Only live rows are public; active event organizers
-- keep the direct read access needed by the mobile private preview.
drop policy if exists "races_select" on public.races;
create policy "races_select" on public.races
for select
using (
  (is_public = true and is_live = true)
  or created_by = (select auth.uid())
  or exists (
    select 1
    from public.race_event_organizers organizer_row
    where organizer_row.event_id = races.event_id
      and organizer_row.user_id = (select auth.uid())
      and organizer_row.revoked_at is null
  )
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

-- Hiding an edition still makes every attached format private. Showing the
-- edition again must not publish those formats implicitly: each format keeps
-- its private state until the organizer explicitly selects Public.
create or replace function public.sync_race_event_edition_visibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_visible is not distinct from old.is_visible then
    return new;
  end if;

  if not new.is_visible then
    update public.races
    set is_live = false,
        racebook_is_live = false
    where edition_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_race_event_edition_visibility()
from public, anon, authenticated;
