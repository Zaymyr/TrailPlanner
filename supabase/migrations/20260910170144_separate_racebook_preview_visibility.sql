alter table public.races
  add column if not exists racebook_preview_is_visible boolean not null default true;

comment on column public.races.racebook_preview_is_visible is
  'Whether this format appears in the private organizer RaceBook preview. Disabling it also excludes the format from publication.';

alter table public.races
  drop constraint if exists races_live_racebook_requires_preview_check;

alter table public.races
  add constraint races_live_racebook_requires_preview_check
  check (racebook_is_live = false or racebook_preview_is_visible = true);

create or replace function public.publish_organizer_edition_racebooks(
  p_edition_id uuid,
  p_actor_id uuid
)
returns setof public.races
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  entitlement_tier text;
begin
  if not exists (
    select 1
    from public.race_event_editions edition_row
    where edition_row.id = p_edition_id
      and edition_row.is_visible = true
  ) then
    raise exception 'Visible event edition required.';
  end if;

  select entitlement_row.tier
  into entitlement_tier
  from public.organizer_edition_entitlements entitlement_row
  where entitlement_row.edition_id = p_edition_id
    and entitlement_row.status = 'active';

  if entitlement_tier not in ('essential', 'complete', 'signature') then
    raise exception 'RaceBook entitlement required.';
  end if;

  return query
  update public.races race_row
  set racebook_is_live = true,
      racebook_publication_approved_at = coalesce(
        race_row.racebook_publication_approved_at,
        timezone('utc', now())
      ),
      racebook_publication_approved_by = coalesce(
        race_row.racebook_publication_approved_by,
        p_actor_id
      )
  where race_row.edition_id = p_edition_id
    and race_row.racebook_preview_is_visible = true
    and race_row.is_public = true
    and race_row.is_live = true
    and coalesce(race_row.data_status, 'complete') = 'complete'
  returning race_row.*;
end;
$$;

revoke all on function public.publish_organizer_edition_racebooks(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_organizer_edition_racebooks(uuid, uuid) to service_role;
