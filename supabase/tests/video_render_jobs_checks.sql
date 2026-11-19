-- Background reel render job checks.
-- Run in a privileged SQL session after 20261104140000_add_video_render_jobs.sql and
-- 20261119160000_add_reel_content.sql and 20261119170000_add_render_job_auto_draft.sql.

begin;

do $$
begin
  if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'video_render_jobs') then
    raise exception 'video_render_jobs must have RLS enabled.';
  end if;
  if has_table_privilege('anon', 'public.video_render_jobs', 'SELECT')
    or has_table_privilege('authenticated', 'public.video_render_jobs', 'SELECT')
    or has_table_privilege('authenticated', 'public.video_render_jobs', 'UPDATE') then
    raise exception 'Client roles must not access video_render_jobs.';
  end if;
  if not has_table_privilege('service_role', 'public.video_render_jobs', 'UPDATE') then
    raise exception 'The service role must manage video_render_jobs.';
  end if;
  -- Reel content snapshot: a nullable jsonb object, readable and writable only through the service role.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'video_render_jobs' and column_name = 'content' and data_type = 'jsonb' and is_nullable = 'YES') then
    raise exception 'video_render_jobs.content must be a nullable jsonb column.';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.video_render_jobs'::regclass and conname = 'video_render_jobs_content_object') then
    raise exception 'video_render_jobs.content must be constrained to a JSON object.';
  end if;
  -- One-click reel: the auto-draft flag is a non-null boolean defaulting to false.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'video_render_jobs' and column_name = 'auto_draft' and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false') then
    raise exception 'video_render_jobs.auto_draft must be a non-null boolean defaulting to false.';
  end if;
end;
$$;

rollback;
