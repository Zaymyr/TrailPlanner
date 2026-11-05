begin;

alter table public.race_requests
  drop constraint if exists race_requests_status_check;

update public.race_requests
set status = 'completed'
where status = 'approved';

alter table public.race_requests
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add constraint race_requests_status_check
    check (status in ('pending', 'completed', 'rejected'));

create index if not exists race_requests_reviewed_by_idx
  on public.race_requests(reviewed_by)
  where reviewed_by is not null;

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  race_request_id bigint references public.race_requests(id) on delete set null,
  kind text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  email_requested boolean not null default false,
  email_status text not null default 'not_requested',
  email_provider_id text,
  email_error text,
  push_requested boolean not null default false,
  push_status text not null default 'not_requested',
  push_sent_count integer not null default 0,
  push_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_notifications_kind_check
    check (kind in ('admin_message', 'race_request_status')),
  constraint user_notifications_title_check
    check (char_length(btrim(title)) between 1 and 160),
  constraint user_notifications_body_check
    check (char_length(btrim(body)) between 1 and 4000),
  constraint user_notifications_email_status_check
    check (email_status in ('not_requested', 'pending', 'sent', 'failed', 'unavailable')),
  constraint user_notifications_push_status_check
    check (push_status in ('not_requested', 'pending', 'sent', 'failed', 'unavailable')),
  constraint user_notifications_email_request_consistency_check
    check (
      (email_requested and email_status <> 'not_requested')
      or (not email_requested and email_status = 'not_requested')
    ),
  constraint user_notifications_push_request_consistency_check
    check (
      (push_requested and push_status <> 'not_requested')
      or (not push_requested and push_status = 'not_requested')
    ),
  constraint user_notifications_push_sent_count_check
    check (push_sent_count >= 0)
);

create index user_notifications_user_created_idx
  on public.user_notifications(user_id, created_at desc);

create index user_notifications_user_unread_idx
  on public.user_notifications(user_id, created_at desc)
  where read_at is null;

create index user_notifications_race_request_idx
  on public.user_notifications(race_request_id)
  where race_request_id is not null;

create index user_notifications_created_by_idx
  on public.user_notifications(created_by)
  where created_by is not null;

create or replace function public.set_admin_user_notification_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_race_requests_updated_at
before update on public.race_requests
for each row execute function public.set_admin_user_notification_updated_at();

create trigger set_user_notifications_updated_at
before update on public.user_notifications
for each row execute function public.set_admin_user_notification_updated_at();

alter table public.user_notifications enable row level security;

revoke all on table public.user_notifications from public, anon, authenticated;
grant select (
  id,
  user_id,
  race_request_id,
  kind,
  title,
  body,
  read_at,
  created_at
) on table public.user_notifications to authenticated;
grant update (read_at) on table public.user_notifications to authenticated;
grant all on table public.user_notifications to service_role;

revoke all on table public.race_requests from public, anon, authenticated;
grant select, insert on table public.race_requests to authenticated;
grant all on table public.race_requests to service_role;
revoke all on sequence public.race_requests_id_seq from public, anon, authenticated;
grant usage, select on sequence public.race_requests_id_seq to authenticated, service_role;

drop policy if exists "Users can view own notifications" on public.user_notifications;
create policy "Users can view own notifications"
on public.user_notifications
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can mark own notifications as read" on public.user_notifications;
create policy "Users can mark own notifications as read"
on public.user_notifications
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.review_race_request_with_notification(
  p_request_id bigint,
  p_admin_id uuid,
  p_status text,
  p_notification_id uuid,
  p_title text,
  p_body text,
  p_email_requested boolean,
  p_push_requested boolean
)
returns public.user_notifications
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_row public.race_requests%rowtype;
  existing_notification public.user_notifications%rowtype;
  notification_row public.user_notifications%rowtype;
begin
  if p_status is null or p_status not in ('pending', 'completed', 'rejected') then
    raise exception 'Unsupported race request status: %', p_status
      using errcode = '22023';
  end if;

  if p_admin_id is null then
    raise exception 'Admin id is required.'
      using errcode = '22023';
  end if;

  if p_notification_id is null then
    raise exception 'Notification id is required.'
      using errcode = '22023';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Notification title must contain between 1 and 160 characters.'
      using errcode = '22023';
  end if;

  if p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'Notification body must contain between 1 and 4000 characters.'
      using errcode = '22023';
  end if;

  select request.*
  into request_row
  from public.race_requests request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'Race request % was not found.', p_request_id
      using errcode = 'P0002';
  end if;

  select notification.*
  into existing_notification
  from public.user_notifications notification
  where notification.id = p_notification_id;

  if found then
    if request_row.status <> p_status
      or existing_notification.user_id <> request_row.user_id
      or existing_notification.created_by is distinct from p_admin_id
      or existing_notification.race_request_id is distinct from p_request_id
      or existing_notification.kind <> 'race_request_status'
      or existing_notification.title <> btrim(p_title)
      or existing_notification.body <> btrim(p_body)
      or existing_notification.email_requested <> coalesce(p_email_requested, false)
      or existing_notification.push_requested <> coalesce(p_push_requested, false) then
      raise exception 'Notification id % is already used for another payload.', p_notification_id
        using errcode = '23505';
    end if;

    return existing_notification;
  end if;

  update public.race_requests
  set status = p_status,
      reviewed_at = timezone('utc', now()),
      reviewed_by = p_admin_id
  where id = p_request_id;

  insert into public.user_notifications (
    id,
    user_id,
    created_by,
    race_request_id,
    kind,
    title,
    body,
    email_requested,
    email_status,
    push_requested,
    push_status
  ) values (
    p_notification_id,
    request_row.user_id,
    p_admin_id,
    p_request_id,
    'race_request_status',
    btrim(p_title),
    btrim(p_body),
    coalesce(p_email_requested, false),
    case when coalesce(p_email_requested, false) then 'pending' else 'not_requested' end,
    coalesce(p_push_requested, false),
    case when coalesce(p_push_requested, false) then 'pending' else 'not_requested' end
  )
  returning * into notification_row;

  return notification_row;
end;
$$;

revoke execute on function public.set_admin_user_notification_updated_at() from public, anon, authenticated, service_role;
revoke execute on function public.review_race_request_with_notification(bigint, uuid, text, uuid, text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.review_race_request_with_notification(bigint, uuid, text, uuid, text, text, boolean, boolean)
  to service_role;

comment on table public.user_notifications is
  'Owner-readable in-app notifications created by trusted server-side administrative workflows.';
comment on function public.review_race_request_with_notification(bigint, uuid, text, uuid, text, text, boolean, boolean) is
  'Atomically reviews a runner race request and creates its mandatory in-app notification. Service role only.';

notify pgrst, 'reload schema';

commit;
