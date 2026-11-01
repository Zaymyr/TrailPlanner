-- Run only against a migrated disposable database. All fixtures roll back.
begin;

do $$
declare
  existing_user uuid := gen_random_uuid();
  anonymous_user uuid := gen_random_uuid();
  converted_user uuid := gen_random_uuid();
  existing_plan uuid := gen_random_uuid();
  guest_plan uuid := gen_random_uuid();
  new_plan uuid := gen_random_uuid();
  session_id uuid := gen_random_uuid();
  launched timestamptz;
  changed integer;
begin
  if has_table_privilege('authenticated', 'public.runner_launch_grandfathered_plans', 'SELECT')
    or has_table_privilege('authenticated', 'public.runner_launch_cohorts', 'SELECT')
    or has_table_privilege('anon', 'public.runner_launch_cohorts', 'SELECT') then
    raise exception 'Launch snapshots must remain service-only';
  end if;
  if has_function_privilege('authenticated', 'public.activate_runner_launch()', 'EXECUTE')
    or has_function_privilege('anon', 'public.activate_runner_launch()', 'EXECUTE') then
    raise exception 'Only service role may activate the launch';
  end if;
  if not has_function_privilege('service_role', 'public.activate_runner_launch()', 'EXECUTE') then
    raise exception 'Service role cannot activate the launch';
  end if;

  update public.runner_monetization_config
    set monetization_enabled = false, launched_at = null, launch_popup_ends_at = null
    where id = true;

  insert into auth.users(
    id, instance_id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at
  ) values
    (existing_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', existing_user || '@test.invalid', 'x', '{}', '{}', false, now(), now()),
    (anonymous_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, 'x', '{"provider":"anonymous"}', '{}', true, now(), now()),
    (converted_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', converted_user || '@test.invalid', 'x', '{}', '{}', false, now(), now());

  insert into public.race_plans(id, user_id, name, planner_values) values
    (existing_plan, existing_user, 'before launch', '{}'),
    (guest_plan, anonymous_user, 'guest before launch', '{}');

  launched := public.activate_runner_launch();
  if launched is null then raise exception 'Launch timestamp was not created'; end if;
  if public.activate_runner_launch() <> launched then raise exception 'Launch activation is not idempotent'; end if;
  if not (select monetization_enabled from public.runner_monetization_config where id = true) then
    raise exception 'Launch did not enable runner monetization';
  end if;
  if (select launch_popup_ends_at - launched_at from public.runner_monetization_config where id = true) <> interval '7 days' then
    raise exception 'Launch announcement window is not seven days';
  end if;
  if not exists (
    select 1 from public.runner_launch_grandfathered_plans
    where plan_id = existing_plan and user_id = existing_user
  ) or not exists (
    select 1 from public.runner_launch_grandfathered_plans
    where plan_id = guest_plan and user_id = anonymous_user
  ) then raise exception 'Existing plan snapshot is incomplete'; end if;
  if not exists (
    select 1 from public.runner_launch_cohorts
    where user_id = existing_user and early_supporter
  ) or exists (
    select 1 from public.runner_launch_cohorts where user_id = anonymous_user
  ) then raise exception 'Identified launch cohort is incorrect'; end if;

  insert into public.race_plans(id, user_id, name, planner_values)
    values (new_plan, existing_user, 'after launch', '{}');
  if exists (select 1 from public.runner_launch_grandfathered_plans where plan_id = new_plan) then
    raise exception 'Post-launch plan was grandfathered';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', existing_user, 'role', 'authenticated', 'is_anonymous', false, 'session_id', session_id
  )::text, true);
  execute 'set local role authenticated';
  if not public.runner_plan_is_unlocked(existing_plan, existing_user) then
    raise exception 'Grandfathered plan is not editable';
  end if;
  if public.runner_plan_is_unlocked(new_plan, existing_user) then
    raise exception 'Post-launch free plan is unexpectedly editable';
  end if;
  update public.race_plans set name = 'still editable' where id = existing_plan;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Grandfathered plan update policy failed'; end if;
  update public.race_plans set name = 'must stay locked' where id = new_plan;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Post-launch plan bypassed update policy'; end if;
  execute 'reset role';

  update auth.users set raw_app_meta_data = '{"role":"admin"}' where id = existing_user;
  insert into public.runner_admin_access_modes(session_id, user_id, mode)
    values (session_id, existing_user, 'free');
  execute 'set local role authenticated';
  if public.runner_plan_is_unlocked(existing_plan, existing_user) then
    raise exception 'Free admin simulation did not override grandfathering';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', converted_user, 'role', 'service_role'
  )::text, true);
  update public.race_plans set user_id = converted_user where id = guest_plan;
  if not exists (
    select 1 from public.runner_launch_grandfathered_plans
    where plan_id = guest_plan and user_id = converted_user
  ) then raise exception 'Guest conversion lost grandfathered ownership'; end if;
end;
$$;

rollback;
