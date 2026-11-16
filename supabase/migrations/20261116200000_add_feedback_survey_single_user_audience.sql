begin;

-- Feedback surveys can target one chosen account (audience_kind = 'single_user'), so an admin can
-- test a survey on themselves, or a trusted tester, before sending it to a whole audience.

alter table public.feedback_survey_campaigns
  add column if not exists audience_user_id uuid references auth.users(id) on delete set null;

alter table public.feedback_survey_campaigns
  drop constraint if exists feedback_survey_campaigns_audience_kind_check;

alter table public.feedback_survey_campaigns
  add constraint feedback_survey_campaigns_audience_kind_check
    check (audience_kind in ('racebook_readers', 'single_user'));

alter table public.feedback_survey_campaigns
  drop constraint if exists feedback_survey_campaigns_audience_user_check;

-- Only a single-user campaign names a user. The id becomes null if that account is deleted.
alter table public.feedback_survey_campaigns
  add constraint feedback_survey_campaigns_audience_user_check
    check (audience_kind = 'single_user' or audience_user_id is null);

-- Unlike resolve_feedback_survey_recipients, the admin explicitly picks this account, so admins are
-- allowed (testing on oneself is the main use). Live Auth accounts only. Service role only.
create or replace function public.resolve_feedback_survey_single_recipient(p_user_id uuid)
returns table (user_id uuid, has_email boolean, has_push boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth_user.id as user_id,
    coalesce(btrim(auth_user.email), '') <> '' as has_email,
    exists (
      select 1
      from public.push_devices device
      where device.user_id = auth_user.id
        and device.notifications_enabled
    ) as has_push
  from auth.users auth_user
  where auth_user.id = p_user_id
    and auth_user.deleted_at is null;
$$;

revoke all on function public.resolve_feedback_survey_single_recipient(uuid) from public, anon, authenticated;
grant execute on function public.resolve_feedback_survey_single_recipient(uuid) to service_role;

commit;
