-- Instagram carousel checks.
-- Run in a privileged SQL session after 20261120180000_add_instagram_carousels.sql and
-- 20261120180100_schedule_carousel_automation_cron.sql.

begin;

do $$
declare
  v_table text;
  v_job uuid;
begin
  foreach v_table in array array['carousel_render_jobs', 'carousel_automation_items'] loop
    if not (select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = v_table) then
      raise exception '% must have RLS enabled.', v_table;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_table) then
      raise exception '% must have no client policy.', v_table;
    end if;
    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'Client roles must not access %.', v_table;
    end if;
    if not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'The service role must manage %.', v_table;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.configure_carousel_automation_cron()', 'execute')
    or has_function_privilege('authenticated', 'public.configure_carousel_automation_cron()', 'execute') then
    raise exception 'Client roles must not configure the carousel automation cron.';
  end if;
  if not exists (select 1 from cron.job where jobname = 'carousel-automation' and schedule = '47 * * * *') then
    raise exception 'The carousel-automation cron job must run hourly at :47.';
  end if;

  -- Series switches exist and are off by default.
  if (select plan_carousel_enabled or brief_carousel_enabled or week_carousel_enabled from public.reel_automation_settings) then
    raise exception 'Carousel series switches must be off by default.';
  end if;

  -- Existing posts are reels.
  if exists (select 1 from public.social_posts where media_type <> 'reel') and not exists (select 1 from public.carousel_render_jobs) then
    raise exception 'Existing posts must default to media_type reel.';
  end if;

  insert into public.carousel_render_jobs (series, title, snapshot, slide_count)
  values ('week', 'La semaine qui vient', '{}'::jsonb, 2)
  returning id into v_job;

  begin
    update public.carousel_render_jobs set status = 'done' where id = v_job;
    raise exception 'A done carousel render must have all its images.';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.social_posts (media_type, carousel_series, image_paths, video_url)
    values ('carousel', 'week', array['carousels/a/slide-1.jpg', 'carousels/a/slide-2.jpg'], 'jobs/x/reel.mp4');
    raise exception 'A carousel post must not carry a video.';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.social_posts (media_type, carousel_series) values ('carousel', 'week');
    raise exception 'A carousel post must carry its images.';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.social_posts (media_type, image_paths) values ('reel', array['a.jpg', 'b.jpg']);
    raise exception 'A reel must not carry carousel images.';
  exception when check_violation then
    null;
  end;

  insert into public.carousel_automation_items (series, planned_publish_date) values ('plan', date '2099-01-06');
  begin
    insert into public.carousel_automation_items (series, planned_publish_date) values ('plan', date '2099-01-06');
    raise exception 'Two slots of one series on one day must be rejected.';
  exception when unique_violation then
    null;
  end;
end $$;

rollback;
