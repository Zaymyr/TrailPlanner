-- Feedback survey schema, privilege, trigger and RPC checks.
-- Run after 20261116180000_add_feedback_surveys.sql in a privileged test database.

begin;

do $$
declare
  insert_column text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.feedback_survey_campaigns'::regclass) then
    raise exception 'feedback_survey_campaigns must have RLS enabled.';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.feedback_survey_responses'::regclass) then
    raise exception 'feedback_survey_responses must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.feedback_survey_campaigns', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'public.feedback_survey_campaigns', 'select,insert,update,delete') then
    raise exception 'Survey campaigns are service-role only.';
  end if;

  if has_table_privilege('anon', 'public.feedback_survey_responses', 'select,insert,update,delete') then
    raise exception 'Anonymous clients must not access survey responses.';
  end if;

  if has_table_privilege('authenticated', 'public.feedback_survey_responses', 'update,delete') then
    raise exception 'Runners must not change or delete a sent answer.';
  end if;

  foreach insert_column in array array['notification_id', 'user_id', 'found_useful', 'useful_text', 'missing_text', 'app_version', 'platform'] loop
    if not has_column_privilege('authenticated', 'public.feedback_survey_responses', insert_column, 'insert') then
      raise exception 'Authenticated clients need INSERT on feedback_survey_responses.%', insert_column;
    end if;
  end loop;

  if has_column_privilege('authenticated', 'public.feedback_survey_responses', 'campaign_id', 'insert')
    or has_column_privilege('authenticated', 'public.feedback_survey_responses', 'created_at', 'insert') then
    raise exception 'campaign_id and created_at are resolved by the trigger, not the client.';
  end if;

  if has_column_privilege('authenticated', 'public.feedback_survey_responses', 'useful_text', 'select') then
    raise exception 'Runners only read whether a survey is answered, not the stored text.';
  end if;

  if not has_table_privilege('service_role', 'public.feedback_survey_responses', 'select,insert,update,delete')
    or not has_table_privilege('service_role', 'public.feedback_survey_campaigns', 'select,insert,update,delete') then
    raise exception 'service_role needs full access to survey tables.';
  end if;

  if has_function_privilege('authenticated', 'public.resolve_feedback_survey_recipients(uuid[])', 'execute')
    or has_function_privilege('anon', 'public.resolve_feedback_survey_recipients(uuid[])', 'execute')
    or has_function_privilege('authenticated', 'public.feedback_survey_campaign_stats(uuid[])', 'execute')
    or has_function_privilege('anon', 'public.feedback_survey_campaign_stats(uuid[])', 'execute') then
    raise exception 'Survey RPCs must stay service-role only.';
  end if;

  if not has_function_privilege('service_role', 'public.resolve_feedback_survey_recipients(uuid[])', 'execute')
    or not has_function_privilege('service_role', 'public.feedback_survey_campaign_stats(uuid[])', 'execute') then
    raise exception 'service_role needs EXECUTE on survey RPCs.';
  end if;
end;
$$;

-- Trigger behaviour: a runner answers their own survey once; other notifications are refused.
do $$
declare
  runner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  campaign_id uuid := gen_random_uuid();
  survey_id uuid := gen_random_uuid();
  message_id uuid := gen_random_uuid();
  stored public.feedback_survey_responses%rowtype;
begin
  insert into auth.users (id, email, raw_app_meta_data) values
    (runner_id, 'runner-survey@example.com', '{}'::jsonb),
    (other_id, 'other-survey@example.com', '{"role":"admin"}'::jsonb);

  insert into public.feedback_survey_campaigns (id, title, body, audience_kind, audience_event_id)
  values (campaign_id, 'Ton avis', 'Message', 'racebook_readers', 'evt-1');

  insert into public.user_notifications (id, user_id, kind, title, body, survey_campaign_id)
  values (survey_id, runner_id, 'feedback_survey', 'Ton avis', 'Message', campaign_id);

  insert into public.user_notifications (id, user_id, kind, title, body)
  values (message_id, runner_id, 'admin_message', 'Bonjour', 'Message');

  begin
    insert into public.user_notifications (user_id, kind, title, body, survey_campaign_id)
    values (runner_id, 'feedback_survey', 'Doublon', 'Message', campaign_id);
    raise exception 'A campaign must reach each runner only once.';
  exception when unique_violation then null;
  end;

  insert into public.feedback_survey_responses (notification_id, user_id, found_useful, useful_text, missing_text)
  values (survey_id, runner_id, true, '  Le profil  ', '   ')
  returning * into stored;

  if stored.campaign_id is distinct from campaign_id
    or stored.useful_text is distinct from 'Le profil'
    or stored.missing_text is not null then
    raise exception 'The trigger must attach the campaign and normalize free text.';
  end if;

  begin
    insert into public.feedback_survey_responses (notification_id, user_id, found_useful)
    values (survey_id, runner_id, false);
    raise exception 'A survey must be answered only once.';
  exception when unique_violation then null;
  end;

  begin
    insert into public.feedback_survey_responses (notification_id, user_id, found_useful)
    values (message_id, runner_id, true);
    raise exception 'A plain message must not accept a survey answer.';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.feedback_survey_responses (notification_id, user_id, found_useful)
    values (survey_id, other_id, true);
    raise exception 'A runner must not answer someone else''s survey.';
  exception when insufficient_privilege then null;
  end;

  if exists (
    select 1 from public.resolve_feedback_survey_recipients(array[runner_id, other_id]) recipient
    where recipient.user_id = other_id
  ) then
    raise exception 'Admins (app_metadata role) must never be survey recipients.';
  end if;

  if not exists (
    select 1 from public.feedback_survey_campaign_stats(array[campaign_id]) stats
    where stats.recipients = 1 and stats.responses = 1 and stats.useful = 1
  ) then
    raise exception 'Campaign stats must count recipients and answers.';
  end if;
end;
$$;

rollback;
