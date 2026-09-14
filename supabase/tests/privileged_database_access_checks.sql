-- Trusted admin authorization and privileged RPC access checks.
-- Run after 20260914055319_harden_privileged_database_access.sql in a privileged SQL session.

begin;

do $$
declare
  privileged_function regprocedure;
  policy_expression text;
begin
  if (select prosecdef from pg_proc where oid = 'public.is_admin()'::regprocedure) then
    raise exception 'is_admin must remain SECURITY INVOKER.';
  end if;

  if lower(pg_get_functiondef('public.is_admin()'::regprocedure)) like '%user_profiles%'
    or lower(pg_get_functiondef('public.is_admin()'::regprocedure)) like '%user_metadata%' then
    raise exception 'is_admin must use only trusted Auth app metadata.';
  end if;

  if has_function_privilege('anon', 'public.is_admin()', 'execute') then
    raise exception 'anon must not execute the administrator helper.';
  end if;

  for privileged_function in
    select procedure_row.oid::regprocedure
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = any (array[
        'get_admin_user_rows',
        'get_admin_growth_metrics',
        'get_signups_by_day',
        'get_signups_by_month',
        'get_trial_users_enriched',
        'get_trial_users_for_reminder',
        'check_and_increment_rate_limit',
        'configure_push_reminders_cron',
        'handle_new_user_profile',
        'increment_user_sign_in',
        'purge_expired_rate_limit_entries',
        'sync_race_has_aid_stations'
      ])
  loop
    if has_function_privilege('anon', privileged_function, 'execute')
      or has_function_privilege('authenticated', privileged_function, 'execute') then
      raise exception 'Client role can still execute privileged function %.', privileged_function;
    end if;
    if not has_function_privilege('service_role', privileged_function, 'execute') then
      raise exception 'service_role cannot execute privileged function %.', privileged_function;
    end if;
  end loop;

  select string_agg(coalesce(policy_row.qual, '') || coalesce(policy_row.with_check, ''), ' ')
  into policy_expression
  from pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename in ('premium_grants', 'races', 'race_aid_stations')
    and policy_row.policyname in (
      'Service role or admins can manage premium grants',
      'races_update',
      'races_delete',
      'race_aid_stations_insert',
      'race_aid_stations_update',
      'race_aid_stations_delete'
    );

  if lower(coalesce(policy_expression, '')) like '%user_profiles%role%'
    or lower(coalesce(policy_expression, '')) like '%user_metadata%' then
    raise exception 'A privileged mutation policy still trusts client-controlled role data.';
  end if;

  select coalesce(policy_row.with_check, '')
  into policy_expression
  from pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'races'
    and policy_row.policyname = 'races_insert';

  if lower(policy_expression) not like '%created_by%'
    or lower(policy_expression) not like '%auth.uid%'
    or lower(policy_expression) not like '%is_public = false%'
    or lower(policy_expression) not like '%is_live = false%'
    or lower(policy_expression) not like '%is_published = false%'
    or lower(policy_expression) not like '%event_id is null%'
    or lower(policy_expression) not like '%edition_id is null%'
    or lower(policy_expression) not like '%racebook_is_live = false%' then
    raise exception 'races_insert does not enforce the private standalone owner boundary: %', policy_expression;
  end if;

  if not exists (
    select 1
    from pg_class relation_row
    join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname = 'product_brand_review'
      and 'security_invoker=true' = any (coalesce(relation_row.reloptions, array[]::text[]))
  ) then
    raise exception 'product_brand_review must enforce invoker security.';
  end if;
end;
$$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000098',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'privileged-access-check@example.test',
  '',
  now(),
  '{}'::jsonb,
  '{"role":"admin"}'::jsonb,
  now(),
  now()
)
on conflict (id) do update
set raw_app_meta_data = '{}'::jsonb,
    raw_user_meta_data = '{"role":"admin"}'::jsonb,
    updated_at = now();

do $$
begin
  if not exists (
    select 1
    from public.user_profiles profile_row
    where profile_row.user_id = '10000000-0000-0000-0000-000000000098'
      and profile_row.trial_started_at is not null
      and profile_row.trial_ends_at is not null
      and profile_row.sign_in_count = 0
  ) then
    raise exception 'The privileged Auth trigger must initialize server-managed trial fields.';
  end if;
end;
$$;

delete from public.user_profiles
where user_id = '10000000-0000-0000-0000-000000000098';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000098', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000098","role":"authenticated","app_metadata":{},"user_metadata":{"role":"admin"}}',
  true
);

do $$
begin
  begin
    insert into public.user_profiles (user_id, trial_ends_at)
    values (
      '10000000-0000-0000-0000-000000000098',
      timezone('utc', now()) + interval '1 year'
    );
    raise exception 'Expected authenticated server-field insert to be rejected.';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

insert into public.user_profiles (user_id, role)
values ('10000000-0000-0000-0000-000000000098', 'admin')
on conflict (user_id) do update set role = excluded.role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000098', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000098","role":"authenticated","app_metadata":{},"user_metadata":{"role":"admin"}}',
  true
);

do $$
begin
  if public.is_admin() then
    raise exception 'Profile role or user metadata still grants administrator access.';
  end if;

  begin
    update public.user_profiles
    set role = 'owner'
    where user_id = '10000000-0000-0000-0000-000000000098';
    raise exception 'Expected authenticated profile role mutation to be rejected.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.user_profiles
    set trial_ends_at = timezone('utc', now()) + interval '1 year'
    where user_id = '10000000-0000-0000-0000-000000000098';
    raise exception 'Expected authenticated trial extension to be rejected.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.user_profiles
    set sign_in_count = sign_in_count + 100
    where user_id = '10000000-0000-0000-0000-000000000098';
    raise exception 'Expected authenticated sign-in metric mutation to be rejected.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.races (
      id, slug, name, distance_km, elevation_gain_m, created_by,
      is_public, is_live, is_published, event_id, edition_id,
      edition_group_id, series_name, racebook_preview_is_visible,
      racebook_is_live, racebook_publication_approved_at,
      racebook_publication_approved_by
    ) values (
      '20000000-0000-4000-8000-000000000098',
      'privileged-access-public-race-check',
      'Forbidden public race',
      21,
      500,
      '10000000-0000-0000-0000-000000000098',
      true, true, true, null, null,
      '20000000-0000-4000-8000-000000000098',
      'Forbidden public race',
      true, false, null, null
    );
    raise exception 'Expected normal user public race insert to be rejected.';
  exception
    when insufficient_privilege then
      null;
  end;

  insert into public.races (
    id, slug, name, distance_km, elevation_gain_m, created_by,
    is_public, is_live, is_published, event_id, edition_id,
    edition_group_id, series_name, racebook_preview_is_visible,
    racebook_is_live, racebook_publication_approved_at,
    racebook_publication_approved_by
  ) values (
    '20000000-0000-4000-8000-000000000098',
    'privileged-access-private-race-check',
    'Allowed private race',
    21,
    500,
    '10000000-0000-0000-0000-000000000098',
    false, false, false, null, null,
    '20000000-0000-4000-8000-000000000098',
    'Allowed private race',
    false, false, null, null
  );

  update public.races
  set distance_km = 22
  where id = '20000000-0000-4000-8000-000000000098';

  begin
    update public.races
    set is_public = true, is_live = true, is_published = true
    where id = '20000000-0000-4000-8000-000000000098';
    raise exception 'Expected normal user race publication to be rejected.';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000098', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000098","role":"authenticated","app_metadata":{"role":"admin"},"user_metadata":{}}',
  true
);

do $$
begin
  if not public.is_admin() then
    raise exception 'Trusted app metadata must grant administrator access.';
  end if;

  insert into public.races (
    id, slug, name, location, location_text, distance_km,
    elevation_gain_m, source_url, race_date, created_by,
    is_public, is_live, is_published, event_id, edition_id,
    edition_group_id, series_name, racebook_preview_is_visible,
    racebook_is_live, racebook_publication_approved_at,
    racebook_publication_approved_by
  ) values (
    '20000000-0000-4000-8000-000000000097',
    'privileged-access-admin-race-check',
    'Allowed admin catalog race',
    'SQL Test',
    'SQL Test',
    42,
    1200,
    'https://example.test/admin-race',
    current_date + 30,
    '10000000-0000-0000-0000-000000000098',
    true, true, true, null, null,
    '20000000-0000-4000-8000-000000000097',
    'Allowed admin catalog race',
    true, false, null, null
  );
end;
$$;

reset role;

do $$
begin
  if (
    select profile_row.role
    from public.user_profiles profile_row
    where profile_row.user_id = '10000000-0000-0000-0000-000000000098'
  ) is distinct from 'admin' then
    raise exception 'Rejected client role mutation changed the stored profile role.';
  end if;
end;
$$;

rollback;
