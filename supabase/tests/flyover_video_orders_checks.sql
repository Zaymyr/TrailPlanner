-- Organizer flyover video order checks.
-- Run in a privileged SQL session after 20261122100000_add_flyover_video_orders.sql and
-- 20261122200000_flyover_presets_and_story_mode.sql.

begin;

do $$
begin
  if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'flyover_video_orders') then
    raise exception 'flyover_video_orders must have RLS enabled.';
  end if;
  if has_table_privilege('anon', 'public.flyover_video_orders', 'SELECT')
    or has_table_privilege('anon', 'public.flyover_video_orders', 'INSERT')
    or has_table_privilege('authenticated', 'public.flyover_video_orders', 'SELECT')
    or has_table_privilege('authenticated', 'public.flyover_video_orders', 'UPDATE') then
    raise exception 'Client roles must not access flyover_video_orders.';
  end if;
  if not has_table_privilege('service_role', 'public.flyover_video_orders', 'UPDATE') then
    raise exception 'The service role must manage flyover_video_orders.';
  end if;
  -- A flyover render has no catalog race; every render still has a race or an order.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'video_render_jobs' and column_name = 'race_id' and is_nullable = 'YES') then
    raise exception 'video_render_jobs.race_id must be nullable.';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.video_render_jobs'::regclass and conname = 'video_render_jobs_race_or_flyover') then
    raise exception 'video_render_jobs must require a race or a flyover order.';
  end if;
  -- 20261122200000: the chosen story mode (nullable for older orders).
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'flyover_video_orders' and column_name = 'story_mode' and is_nullable = 'YES') then
    raise exception 'flyover_video_orders.story_mode must be a nullable column.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'social_posts' and column_name = 'collaborators' and is_nullable = 'NO') then
    raise exception 'social_posts.collaborators must be a non-null array.';
  end if;
end;
$$;

-- The collab offer needs its Instagram account and slot.
do $$
begin
  begin
    insert into public.flyover_video_orders (offer, amount_cents, race_name, contact_email, map_preset, gpx_storage_path, distance_km)
    values ('collab', 2999, 'Trail test', 'orga@example.fr', 'signature', 'flyover/test.gpx', 12);
    raise exception 'A collab order without Instagram account must be rejected.';
  exception when check_violation then null;
  end;
end;
$$;

rollback;
