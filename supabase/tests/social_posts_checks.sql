-- Instagram social post checks.
-- Run in a privileged SQL session after 20261119130000_add_social_posts.sql and
-- 20261119130100_schedule_social_posts_cron.sql and 20261119170000_add_render_job_auto_draft.sql.

begin;

do $$
declare
  v_post_id uuid;
begin
  if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = 'social_posts') then
    raise exception 'social_posts must have RLS enabled.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'social_posts') then
    raise exception 'social_posts must have no client policy.';
  end if;
  if has_table_privilege('anon', 'public.social_posts', 'SELECT')
    or has_table_privilege('authenticated', 'public.social_posts', 'SELECT')
    or has_table_privilege('authenticated', 'public.social_posts', 'INSERT')
    or has_table_privilege('authenticated', 'public.social_posts', 'UPDATE') then
    raise exception 'Client roles must not access social_posts.';
  end if;
  if not has_table_privilege('service_role', 'public.social_posts', 'UPDATE') then
    raise exception 'The service role must manage social_posts.';
  end if;

  insert into public.social_posts (caption) values ('Brouillon de test') returning id into v_post_id;
  if (select status from public.social_posts where id = v_post_id) <> 'draft'
    or not (select dry_run from public.social_posts where id = v_post_id) then
    raise exception 'A new post must default to a dry-run draft.';
  end if;

  -- One-click reel: a manual draft is not auto-generated; at most one automatic draft per render.
  if (select auto_generated from public.social_posts where id = v_post_id) then
    raise exception 'A new post must default to auto_generated = false.';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'social_posts'
      and indexname = 'social_posts_auto_generated_video_job_uidx'
      and indexdef like 'CREATE UNIQUE INDEX%' and indexdef like '%auto_generated%'
  ) then
    raise exception 'social_posts needs the partial unique index of automatic drafts per render job.';
  end if;

  begin
    update public.social_posts set status = 'scheduled', scheduled_at = null where id = v_post_id;
    raise exception 'A scheduled post without scheduled_at was accepted.';
  exception when check_violation then null;
  end;

  begin
    update public.social_posts set status = 'live' where id = v_post_id;
    raise exception 'An unknown status was accepted.';
  exception when check_violation then null;
  end;

  begin
    update public.social_posts set caption = repeat('a', 2201) where id = v_post_id;
    raise exception 'A caption over 2200 characters was accepted.';
  exception when check_violation then null;
  end;

  if has_function_privilege('anon', 'public.configure_social_publishing_cron()', 'execute')
    or has_function_privilege('authenticated', 'public.configure_social_publishing_cron()', 'execute') then
    raise exception 'Client roles must not configure the publishing cron.';
  end if;

  if not exists (select 1 from cron.job where jobname = 'social-posts-publish') then
    raise exception 'The social publishing cron job must be scheduled.';
  end if;
  if exists (select 1 from cron.job where jobname = 'instagram-token-refresh') then
    raise exception 'No token refresh job: the System User token does not expire.';
  end if;
  if exists (select 1 from cron.job where jobname = 'social-posts-publish' and command not like '%vault.decrypted_secrets%') then
    raise exception 'The cron job must read its secrets from Vault at run time.';
  end if;
  if to_regclass('public.social_accounts') is not null then
    raise exception 'social_accounts must not exist: credentials live in server env vars.';
  end if;
end;
$$;

rollback;
