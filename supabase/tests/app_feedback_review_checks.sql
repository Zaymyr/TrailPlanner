-- Bug and feedback review schema, privilege and RPC checks.
-- Run after 20261105180000_add_app_feedback_review.sql in a privileged test database.

begin;

do $$
declare
  insert_column text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.app_feedback'::regclass) then
    raise exception 'app_feedback must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.app_feedback', 'select,insert,update,delete') then
    raise exception 'Anonymous clients must not access app_feedback.';
  end if;

  if has_table_privilege('authenticated', 'public.app_feedback', 'select,update,delete') then
    raise exception 'Authenticated clients must not read or change submitted feedback.';
  end if;

  foreach insert_column in array array['user_id', 'kind', 'source', 'screen', 'app_version', 'subject', 'detail'] loop
    if not has_column_privilege('authenticated', 'public.app_feedback', insert_column, 'insert') then
      raise exception 'Authenticated clients need INSERT on app_feedback.%', insert_column;
    end if;
  end loop;

  if has_column_privilege('authenticated', 'public.app_feedback', 'status', 'insert')
    or has_column_privilege('authenticated', 'public.app_feedback', 'reviewed_by', 'insert') then
    raise exception 'Review columns must stay server-managed.';
  end if;

  if not has_table_privilege('service_role', 'public.app_feedback', 'select,insert,update,delete') then
    raise exception 'service_role needs full access to app_feedback.';
  end if;

  if not has_column_privilege('authenticated', 'public.user_notifications', 'feedback_id', 'select') then
    raise exception 'Authenticated clients need SELECT on user_notifications.feedback_id.';
  end if;

  if not has_column_privilege('authenticated', 'public.user_notifications', 'deleted_at', 'update') then
    raise exception 'Runners need UPDATE on user_notifications.deleted_at to hide a message.';
  end if;

  if has_table_privilege('authenticated', 'public.user_notifications', 'delete') then
    raise exception 'Runners hide notifications; they must not delete the admin record.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.review_app_feedback_with_notification(bigint, uuid, text, uuid, text, text, boolean, boolean)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.review_app_feedback_with_notification(bigint, uuid, text, uuid, text, text, boolean, boolean)',
    'execute'
  ) then
    raise exception 'The feedback review RPC must stay service-role only.';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.review_app_feedback_with_notification(bigint, uuid, text, uuid, text, text, boolean, boolean)',
    'execute'
  ) then
    raise exception 'service_role needs EXECUTE on the feedback review RPC.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_notifications'::regclass
      and contype = 'f'
      and confrelid = 'public.app_feedback'::regclass
      and confdeltype = 'n'
  ) then
    raise exception 'A notification must outlive its feedback (on delete set null).';
  end if;
end;
$$;

rollback;
