-- Background reel render job checks.
-- Run in a privileged SQL session after 20261104140000_add_video_render_jobs.sql.

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
end;
$$;

rollback;
