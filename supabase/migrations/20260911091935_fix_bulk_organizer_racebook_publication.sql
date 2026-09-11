-- Bulk publication starts from organizer-private formats. Restore catalog and
-- RaceBook visibility in the same statement after entitlement/readiness checks.
create or replace function public.publish_organizer_edition_racebooks(
  p_edition_id uuid,
  p_actor_id uuid
)
returns setof public.races
language plpgsql
security invoker
set search_path = ''
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
  set is_live = true,
      racebook_preview_is_visible = true,
      racebook_is_live = true,
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
    and coalesce(race_row.data_status, 'complete') = 'complete'
  returning race_row.*;
end;
$$;

revoke all on function public.publish_organizer_edition_racebooks(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.publish_organizer_edition_racebooks(uuid, uuid)
to service_role;
