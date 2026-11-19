-- Saved reel narration checks.
-- Run in a privileged SQL session after 20261105160000_add_video_narrations.sql and
-- 20261119120000_add_video_narrations_mode.sql and 20261119160000_add_reel_content.sql.

begin;

do $$
declare
  key_columns text[];
  race uuid;
begin
  if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'video_narrations') then
    raise exception 'video_narrations must have RLS enabled.';
  end if;
  if has_table_privilege('anon', 'public.video_narrations', 'SELECT')
    or has_table_privilege('authenticated', 'public.video_narrations', 'SELECT')
    or has_table_privilege('authenticated', 'public.video_narrations', 'UPDATE') then
    raise exception 'Client roles must not access video_narrations.';
  end if;
  if not has_table_privilege('service_role', 'public.video_narrations', 'UPDATE') then
    raise exception 'The service role must manage video_narrations.';
  end if;
  if not exists (select 1 from storage.buckets where id = 'video-narrations' and public = false) then
    raise exception 'The video-narrations bucket must exist and stay private.';
  end if;

  -- One narration per race and story mode.
  select array_agg(attribute.attname::text order by key.ordinality)
    into key_columns
    from pg_constraint constraint_row
    cross join lateral unnest(constraint_row.conkey) with ordinality as key(attnum, ordinality)
    join pg_attribute attribute on attribute.attrelid = constraint_row.conrelid and attribute.attnum = key.attnum
   where constraint_row.conrelid = 'public.video_narrations'::regclass and constraint_row.contype = 'p';
  if key_columns is distinct from array['race_id', 'mode'] then
    raise exception 'video_narrations must be keyed by (race_id, mode), got %.', key_columns;
  end if;

  -- Reel content: a nullable jsonb object.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'video_narrations' and column_name = 'content' and data_type = 'jsonb' and is_nullable = 'YES') then
    raise exception 'video_narrations.content must be a nullable jsonb column.';
  end if;

  select id into race from public.races limit 1;
  if race is not null then
    delete from public.video_narrations where race_id = race;
    insert into public.video_narrations (race_id) values (race);
    if (select mode from public.video_narrations where race_id = race) <> 'full' then
      raise exception 'A narration without mode must default to full.';
    end if;
    insert into public.video_narrations (race_id, mode) values (race, 'highlights');
    begin
      insert into public.video_narrations (race_id, mode) values (race, 'teaser');
      raise exception 'An unknown story mode must be rejected.';
    exception when check_violation then
      null;
    end;
    begin
      insert into public.video_narrations (race_id, mode) values (race, 'full');
      raise exception 'A second full narration for the same race must be rejected.';
    exception when unique_violation then
      null;
    end;
    update public.video_narrations set content = '{"hook":"Prêt ?"}'::jsonb where race_id = race and mode = 'highlights';
    begin
      update public.video_narrations set content = '[]'::jsonb where race_id = race and mode = 'highlights';
      raise exception 'A non-object reel content must be rejected.';
    exception when check_violation then
      null;
    end;
  end if;
end;
$$;

rollback;
