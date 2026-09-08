-- Keep client-facing structured RaceBook policies independent from
-- race_event_editions, which is intentionally service-role-only.

drop policy if exists "Published edition services are viewable" on public.race_edition_services;
create policy "Published edition services are viewable"
on public.race_edition_services
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.races as race_row
    where race_row.edition_id = race_edition_services.edition_id
      and race_row.is_public = true
      and race_row.is_live = true
      and race_row.racebook_is_live = true
  )
);

drop policy if exists "Managed edition services are viewable" on public.race_edition_services;
create policy "Managed edition services are viewable"
on public.race_edition_services
for select
to authenticated
using (
  exists (
    select 1
    from public.races as race_row
    where race_row.edition_id = race_edition_services.edition_id
      and (
        race_row.created_by = (select auth.uid())
        or exists (
          select 1
          from public.race_event_organizers as organizer_row
          where organizer_row.event_id = race_row.event_id
            and organizer_row.user_id = (select auth.uid())
            and organizer_row.revoked_at is null
        )
      )
  )
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "Published start waves are viewable" on public.race_start_waves;
create policy "Published start waves are viewable"
on public.race_start_waves
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.races as race_row
    where race_row.id = race_start_waves.race_id
      and race_row.is_public = true
      and race_row.is_live = true
      and race_row.racebook_is_live = true
  )
);

drop policy if exists "Published awards are viewable" on public.race_awards;
create policy "Published awards are viewable"
on public.race_awards
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.races as race_row
    where race_row.id = race_awards.race_id
      and race_row.is_public = true
      and race_row.is_live = true
      and race_row.racebook_is_live = true
  )
);
