-- Linked plan uniqueness checks.
-- Run after 20261029090122_link_racebook_plans.sql in a schema-compatible test database.

begin;

do $$
declare
  index_definition text;
begin
  select pg_get_indexdef(indexrelid)
  into index_definition
  from pg_index
  where indexrelid = 'public.race_plans_user_race_unique_idx'::regclass;

  if index_definition is null
    or index_definition not ilike '%unique index%'
    or index_definition not ilike '%(user_id, race_id)%'
    or index_definition not ilike '%where (race_id is not null)%' then
    raise exception 'Linked race plans require a partial unique user_id/race_id index.';
  end if;
end;
$$;

rollback;
