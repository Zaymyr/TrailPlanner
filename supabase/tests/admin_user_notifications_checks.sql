-- Admin-to-runner notification schema, privilege and RPC checks.
-- Run after 20261105115106_admin_user_notifications.sql in a privileged test database.

begin;

do $$
declare
  safe_column text;
  required_privilege text;
begin
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.user_notifications'::regclass
  ) then
    raise exception 'user_notifications must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.user_notifications', 'select,insert,update,delete') then
    raise exception 'Anonymous clients must not access user_notifications.';
  end if;

  if has_table_privilege('authenticated', 'public.user_notifications', 'insert,delete')
    or has_table_privilege('authenticated', 'public.user_notifications', 'update') then
    raise exception 'Authenticated clients must not receive table-wide notification writes.';
  end if;

  foreach safe_column in array array[
    'id', 'user_id', 'race_request_id', 'kind', 'title', 'body', 'read_at', 'created_at'
  ] loop
    if not has_column_privilege(
      'authenticated',
      'public.user_notifications',
      safe_column,
      'select'
    ) then
      raise exception 'Authenticated clients need SELECT on user_notifications.%', safe_column;
    end if;
  end loop;

  if not has_column_privilege('authenticated', 'public.user_notifications', 'read_at', 'update') then
    raise exception 'Authenticated clients need UPDATE on user_notifications.read_at.';
  end if;

  if has_column_privilege('authenticated', 'public.user_notifications', 'body', 'update')
    or has_column_privilege('authenticated', 'public.user_notifications', 'email_error', 'select')
    or has_column_privilege('authenticated', 'public.user_notifications', 'push_error', 'select')
    or has_column_privilege('authenticated', 'public.user_notifications', 'created_by', 'select') then
    raise exception 'Owner clients must not mutate content or read administrative delivery metadata.';
  end if;

  foreach required_privilege in array array['select', 'insert', 'update', 'delete'] loop
    if not has_table_privilege('service_role', 'public.user_notifications', required_privilege) then
      raise exception 'service_role needs % on user_notifications.', upper(required_privilege);
    end if;
  end loop;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_notifications'
      and roles = array['authenticated']::name[]
      and cmd in ('SELECT', 'UPDATE')
  ) <> 2 then
    raise exception 'Expected separate owner-scoped notification SELECT and UPDATE policies.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_notifications'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ) then
    raise exception 'Notifications must cascade with their recipient Auth user.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_notifications'::regclass
      and contype = 'f'
      and confrelid = 'public.race_requests'::regclass
      and confdeltype = 'n'
  ) then
    raise exception 'Notification race-request references must use ON DELETE SET NULL.';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.user_notifications'::regclass
      and conname::text = any (array[
        'user_notifications_kind_check',
        'user_notifications_title_check',
        'user_notifications_body_check',
        'user_notifications_email_status_check',
        'user_notifications_push_status_check',
        'user_notifications_email_request_consistency_check',
        'user_notifications_push_request_consistency_check',
        'user_notifications_push_sent_count_check'
      ])
  ) <> 8 then
    raise exception 'Expected notification kind, content and delivery-state constraints.';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'user_notifications'
      and indexname = 'user_notifications_user_unread_idx'
      and indexdef ilike '%where (read_at is null)%'
  ) then
    raise exception 'Unread notification lookups need the partial owner index.';
  end if;

  if has_function_privilege(
    'anon',
    'public.review_race_request_with_notification(bigint,uuid,text,uuid,text,text,boolean,boolean)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.review_race_request_with_notification(bigint,uuid,text,uuid,text,text,boolean,boolean)',
    'execute'
  ) then
    raise exception 'Client roles must not execute the race-request review RPC.';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.review_race_request_with_notification(bigint,uuid,text,uuid,text,text,boolean,boolean)',
    'execute'
  ) then
    raise exception 'service_role must execute the race-request review RPC.';
  end if;

  if (
    select prosecdef
    from pg_proc
    where oid = 'public.review_race_request_with_notification(bigint,uuid,text,uuid,text,text,boolean,boolean)'::regprocedure
  ) then
    raise exception 'The review RPC must remain SECURITY INVOKER.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.race_requests'::regclass
      and conname = 'race_requests_status_check'
      and pg_get_constraintdef(oid) like '%pending%completed%rejected%'
      and pg_get_constraintdef(oid) not like '%approved%'
  ) then
    raise exception 'race_requests must expose only pending/completed/rejected statuses.';
  end if;

  foreach required_privilege in array array['select', 'insert'] loop
    if not has_table_privilege('authenticated', 'public.race_requests', required_privilege) then
      raise exception 'Race-request clients need % on race_requests.', upper(required_privilege);
    end if;
  end loop;

  if has_table_privilege('anon', 'public.race_requests', 'select,insert,update,delete') then
    raise exception 'Anonymous clients must not access race_requests.';
  end if;

  foreach required_privilege in array array['update', 'delete'] loop
    if has_table_privilege('authenticated', 'public.race_requests', required_privilege) then
      raise exception 'Race-request clients must not receive % on race_requests.', upper(required_privilege);
    end if;
  end loop;
end;
$$;

rollback;
