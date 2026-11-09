-- Fix edition-wide RaceBook publication.
-- The local variable `race_id` collided with racebook_publication_states.race_id,
-- so every call failed with "column reference race_id is ambiguous" (42702)
-- and the organizer "publish all" action always returned an error.
-- Signature, SECURITY INVOKER and grants are unchanged (CREATE OR REPLACE keeps privileges).

create or replace function public.publish_racebook_snapshots(p_items jsonb, p_actor_id uuid)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  item jsonb;
  result_items jsonb := '[]'::jsonb;
  v_race_id uuid;
  v_expected_revision bigint;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'RaceBook publication items must be a non-empty array.' using errcode = '22023';
  end if;
  if exists (
    select value ->> 'raceId'
    from jsonb_array_elements(p_items)
    group by value ->> 'raceId'
    having count(*) > 1
  ) then
    raise exception 'A RaceBook format may only be published once per batch.' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    v_race_id := (item ->> 'raceId')::uuid;
    v_expected_revision := (item ->> 'expectedDraftRevision')::bigint;
    perform 1 from public.racebook_publication_states s
    where s.race_id = v_race_id
      and s.draft_revision = v_expected_revision
    for update;
    if not found then raise exception 'RaceBook draft revision changed.' using errcode = 'PT409'; end if;
  end loop;

  for item in select value from jsonb_array_elements(p_items)
  loop
    result_items := result_items || jsonb_build_array(public.publish_racebook_snapshot(
      (item ->> 'raceId')::uuid,
      (item ->> 'expectedDraftRevision')::bigint,
      (item ->> 'schemaVersion')::integer,
      item -> 'content',
      item ->> 'contentHash',
      coalesce(item -> 'assets', '[]'::jsonb),
      p_actor_id,
      coalesce((item ->> 'makePublic')::boolean, false)
    ));
  end loop;
  return result_items;
end;
$function$;
