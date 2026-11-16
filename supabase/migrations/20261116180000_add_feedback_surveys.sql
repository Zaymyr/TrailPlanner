begin;

-- Feedback surveys: an admin sends a 3-question survey to a targeted audience (for example every
-- runner who opened one event's livret coureur). Each recipient gets a durable inbox message
-- (user_notifications.kind = 'feedback_survey') and answers it once in the app.

create table public.feedback_survey_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  audience_kind text not null,
  audience_event_id text,
  audience_label text,
  email_requested boolean not null default false,
  push_requested boolean not null default false,
  recipient_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint feedback_survey_campaigns_title_check
    check (char_length(btrim(title)) between 1 and 160),
  constraint feedback_survey_campaigns_body_check
    check (char_length(btrim(body)) between 1 and 4000),
  constraint feedback_survey_campaigns_audience_kind_check
    check (audience_kind in ('racebook_readers')),
  constraint feedback_survey_campaigns_audience_event_check
    check (audience_kind <> 'racebook_readers' or char_length(btrim(coalesce(audience_event_id, ''))) between 1 and 80),
  constraint feedback_survey_campaigns_audience_label_check
    check (audience_label is null or char_length(audience_label) <= 200),
  constraint feedback_survey_campaigns_recipient_count_check
    check (recipient_count >= 0)
);

create index feedback_survey_campaigns_created_idx
  on public.feedback_survey_campaigns(created_at desc);

create index feedback_survey_campaigns_created_by_idx
  on public.feedback_survey_campaigns(created_by)
  where created_by is not null;

create trigger set_feedback_survey_campaigns_updated_at
before update on public.feedback_survey_campaigns
for each row execute function public.set_admin_user_notification_updated_at();

alter table public.feedback_survey_campaigns enable row level security;
revoke all on table public.feedback_survey_campaigns from public, anon, authenticated;
grant all on table public.feedback_survey_campaigns to service_role;

-- Inbox messages: a survey message belongs to one campaign, and a campaign reaches each runner once.
alter table public.user_notifications
  add column if not exists survey_campaign_id uuid
    references public.feedback_survey_campaigns(id) on delete set null;

alter table public.user_notifications
  drop constraint if exists user_notifications_kind_check;

alter table public.user_notifications
  add constraint user_notifications_kind_check
    check (kind in ('admin_message', 'race_request_status', 'feedback_survey'));

alter table public.user_notifications
  add constraint user_notifications_survey_campaign_check
    check (survey_campaign_id is null or kind = 'feedback_survey');

create unique index user_notifications_survey_campaign_user_idx
  on public.user_notifications(survey_campaign_id, user_id)
  where survey_campaign_id is not null;

create table public.feedback_survey_responses (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.user_notifications(id) on delete set null,
  campaign_id uuid references public.feedback_survey_campaigns(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  found_useful boolean not null,
  useful_text text,
  missing_text text,
  app_version text,
  platform text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint feedback_survey_responses_useful_text_check
    check (useful_text is null or char_length(useful_text) <= 2000),
  constraint feedback_survey_responses_missing_text_check
    check (missing_text is null or char_length(missing_text) <= 2000),
  constraint feedback_survey_responses_app_version_check
    check (app_version is null or char_length(app_version) <= 40),
  constraint feedback_survey_responses_platform_check
    check (platform is null or platform in ('ios', 'android', 'web'))
);

create unique index feedback_survey_responses_notification_idx
  on public.feedback_survey_responses(notification_id)
  where notification_id is not null;

create index feedback_survey_responses_campaign_created_idx
  on public.feedback_survey_responses(campaign_id, created_at desc);

create index feedback_survey_responses_user_idx
  on public.feedback_survey_responses(user_id);

-- The runner only sends the notification id: ownership, kind and campaign are resolved here, so a
-- client cannot answer someone else's survey, a plain message, or attach a response to another campaign.
create or replace function public.prepare_feedback_survey_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_row public.user_notifications%rowtype;
begin
  select notification.*
  into notification_row
  from public.user_notifications notification
  where notification.id = new.notification_id;

  if not found
    or notification_row.user_id <> new.user_id
    or notification_row.kind <> 'feedback_survey' then
    raise exception 'This survey cannot be answered by this user.'
      using errcode = '42501';
  end if;

  new.campaign_id := notification_row.survey_campaign_id;
  new.useful_text := nullif(btrim(new.useful_text), '');
  new.missing_text := nullif(btrim(new.missing_text), '');
  new.created_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.prepare_feedback_survey_response() from public, anon, authenticated;

create trigger prepare_feedback_survey_response
before insert on public.feedback_survey_responses
for each row execute function public.prepare_feedback_survey_response();

alter table public.feedback_survey_responses enable row level security;
revoke all on table public.feedback_survey_responses from public, anon, authenticated;
grant select (id, notification_id, found_useful, created_at)
  on table public.feedback_survey_responses to authenticated;
grant insert (notification_id, user_id, found_useful, useful_text, missing_text, app_version, platform)
  on table public.feedback_survey_responses to authenticated;
grant all on table public.feedback_survey_responses to service_role;

drop policy if exists "Users can view own survey responses" on public.feedback_survey_responses;
create policy "Users can view own survey responses"
on public.feedback_survey_responses
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can answer own surveys" on public.feedback_survey_responses;
create policy "Users can answer own surveys"
on public.feedback_survey_responses
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- Audience candidates come from analytics ids. Keep only live Auth accounts, never admins (trusted
-- app_metadata role), and report which channels can reach each one. Service role only.
create or replace function public.resolve_feedback_survey_recipients(p_user_ids uuid[])
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
  where auth_user.id = any(coalesce(p_user_ids, array[]::uuid[]))
    and auth_user.deleted_at is null
    and coalesce(auth_user.raw_app_meta_data ->> 'role', '') <> 'admin';
$$;

revoke all on function public.resolve_feedback_survey_recipients(uuid[]) from public, anon, authenticated;
grant execute on function public.resolve_feedback_survey_recipients(uuid[]) to service_role;

-- Per-campaign delivery and answer counters for the admin results view. Service role only.
create or replace function public.feedback_survey_campaign_stats(p_campaign_ids uuid[])
returns table (
  campaign_id uuid,
  recipients bigint,
  read_count bigint,
  push_sent bigint,
  responses bigint,
  useful bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    campaign.id as campaign_id,
    (select count(*) from public.user_notifications notification
      where notification.survey_campaign_id = campaign.id) as recipients,
    (select count(*) from public.user_notifications notification
      where notification.survey_campaign_id = campaign.id and notification.read_at is not null) as read_count,
    (select count(*) from public.user_notifications notification
      where notification.survey_campaign_id = campaign.id and notification.push_status = 'sent') as push_sent,
    (select count(*) from public.feedback_survey_responses response
      where response.campaign_id = campaign.id) as responses,
    (select count(*) from public.feedback_survey_responses response
      where response.campaign_id = campaign.id and response.found_useful) as useful
  from public.feedback_survey_campaigns campaign
  where campaign.id = any(coalesce(p_campaign_ids, array[]::uuid[]));
$$;

revoke all on function public.feedback_survey_campaign_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.feedback_survey_campaign_stats(uuid[]) to service_role;

commit;
