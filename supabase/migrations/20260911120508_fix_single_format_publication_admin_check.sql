-- The service role intentionally cannot select auth.users directly. Keep the
-- trusted admin lookup behind a private, fixed-output helper instead of
-- broadening auth schema privileges.
create or replace function private.user_has_trusted_admin_role(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users user_row
    where user_row.id = p_user_id
      and (
        coalesce(user_row.raw_app_meta_data ->> 'role', '') = 'admin'
        or coalesce(user_row.raw_app_meta_data -> 'roles', '[]'::jsonb) ? 'admin'
      )
  );
$$;

revoke all on function private.user_has_trusted_admin_role(uuid)
from public, anon, authenticated;
grant execute on function private.user_has_trusted_admin_role(uuid)
to service_role;

comment on function private.user_has_trusted_admin_role(uuid) is
  'Returns whether one server-authorized actor has a trusted Auth app-metadata admin role.';

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
  ) and not private.user_has_trusted_admin_role(p_user_id) then
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

    if entitlement_tier is null or entitlement_tier not in ('essential', 'complete', 'signature') then
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

