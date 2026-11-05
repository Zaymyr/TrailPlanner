-- Saved reel narration checks.
-- Run in a privileged SQL session after 20261105160000_add_video_narrations.sql.

begin;

do $$
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
end;
$$;

rollback;
