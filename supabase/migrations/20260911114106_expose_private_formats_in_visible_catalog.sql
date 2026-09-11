-- Check parent visibility without exposing race_event_editions through the
-- Data API. The helper returns only a boolean and remains callable solely by
-- the two roles that evaluate the races SELECT policy.
create or replace function private.race_is_in_visible_catalog(
  p_event_id uuid,
  p_edition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.race_events event_row
    where event_row.id = p_event_id
      and event_row.is_live = true
      and (
        p_edition_id is null
        or exists (
          select 1
          from public.race_event_editions edition_row
          where edition_row.id = p_edition_id
            and edition_row.event_id = p_event_id
            and edition_row.is_visible = true
        )
      )
  );
$$;

revoke all on function private.race_is_in_visible_catalog(uuid, uuid) from public;
grant execute on function private.race_is_in_visible_catalog(uuid, uuid) to anon, authenticated;

comment on function private.race_is_in_visible_catalog(uuid, uuid) is
  'Returns whether a race parent event and optional edition are runner-catalog visible without exposing edition rows.';

-- A private RaceBook state keeps the course format in the runner catalog for
-- plan creation. Only racebook_is_live controls the RaceBook entry point;
-- racebook_preview_is_visible=false remains the explicit masked state.
drop policy if exists "races_select" on public.races;
create policy "races_select" on public.races
for select
to anon, authenticated
using (
  (is_public = true and is_live = true)
  or (
    is_public = true
    and racebook_preview_is_visible = true
    and event_id is not null
    and private.race_is_in_visible_catalog(event_id, edition_id)
  )
  or created_by = (select auth.uid())
  or exists (
    select 1
    from public.race_event_organizers organizer_row
    where organizer_row.event_id = races.event_id
      and organizer_row.user_id = (select auth.uid())
      and organizer_row.revoked_at is null
  )
  or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
  or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
);
