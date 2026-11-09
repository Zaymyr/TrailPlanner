-- Edition-wide RaceBook publication regression check.
-- Run in a privileged SQL session after 20261109080000_fix_bulk_racebook_publish_ambiguous_race_id.sql.
-- The batch RPC must reach its revision preflight (it previously failed with
-- 42702 "column reference race_id is ambiguous" on every call).

begin;

do $$
declare
  target_race_id uuid;
begin
  select race_id into target_race_id from public.racebook_publication_states limit 1;
  if target_race_id is null then
    raise notice 'No RaceBook publication state; batch preflight check skipped.';
    return;
  end if;
  begin
    perform public.publish_racebook_snapshots(
      jsonb_build_array(jsonb_build_object('raceId', target_race_id, 'expectedDraftRevision', -1)),
      null
    );
    raise exception 'Batch publication must reject a stale draft revision.';
  exception when sqlstate 'PT409' then
    null;
  end;
end $$;

rollback;
