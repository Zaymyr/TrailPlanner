begin;

-- Bugs and feedback get the same admin review lifecycle as race requests, and an admin reply
-- lands in the runner inbox (user_notifications.feedback_id) atomically with the status change.

alter table public.app_feedback
  add column if not exists status text not null default 'pending',
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add constraint app_feedback_status_check
    check (status in ('pending', 'completed', 'rejected'));

-- The admin inbox lists what is still to handle first, then the handled items (greyed) below.
alter table public.app_feedback
  add column if not exists is_pending boolean generated always as (status = 'pending') stored;

alter table public.race_requests
  add column if not exists is_pending boolean generated always as (status = 'pending') stored;

create index if not exists app_feedback_kind_pending_created_idx
  on public.app_feedback(kind, is_pending desc, created_at desc);

create index if not exists app_feedback_reviewed_by_idx
  on public.app_feedback(reviewed_by)
  where reviewed_by is not null;

create trigger set_app_feedback_updated_at
before update on public.app_feedback
for each row execute function public.set_admin_user_notification_updated_at();

-- Runners only submit: no read-back, and the review columns stay server-managed.
revoke all on table public.app_feedback from public, anon, authenticated;
grant insert (user_id, kind, source, screen, app_version, subject, detail)
  on table public.app_feedback to authenticated;
grant all on table public.app_feedback to service_role;
revoke all on sequence public.app_feedback_id_seq from public, anon, authenticated;
grant usage on sequence public.app_feedback_id_seq to authenticated, service_role;

alter table public.user_notifications
  add column if not exists feedback_id bigint references public.app_feedback(id) on delete set null;

create index if not exists user_notifications_feedback_idx
  on public.user_notifications(feedback_id)
  where feedback_id is not null;

-- A runner removes a message from their inbox by hiding it: the row stays, so the admin keeps
-- the reply, and sees it read and deleted.
alter table public.user_notifications
  add column if not exists deleted_at timestamptz;

grant select (feedback_id, deleted_at) on table public.user_notifications to authenticated;
grant update (deleted_at) on table public.user_notifications to authenticated;

create or replace function public.review_app_feedback_with_notification(
  p_feedback_id bigint,
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
  feedback_row public.app_feedback%rowtype;
  existing_notification public.user_notifications%rowtype;
  notification_row public.user_notifications%rowtype;
begin
  if p_status is null or p_status not in ('pending', 'completed', 'rejected') then
    raise exception 'Unsupported feedback status: %', p_status
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

  select feedback.*
  into feedback_row
  from public.app_feedback feedback
  where feedback.id = p_feedback_id
  for update;

  if not found then
    raise exception 'Feedback % was not found.', p_feedback_id
      using errcode = 'P0002';
  end if;

  if feedback_row.user_id is null then
    raise exception 'Feedback % has no account to reply to.', p_feedback_id
      using errcode = '22023';
  end if;

  select notification.*
  into existing_notification
  from public.user_notifications notification
  where notification.id = p_notification_id;

  if found then
    if feedback_row.status <> p_status
      or existing_notification.user_id <> feedback_row.user_id
      or existing_notification.created_by is distinct from p_admin_id
      or existing_notification.feedback_id is distinct from p_feedback_id
      or existing_notification.kind <> 'admin_message'
      or existing_notification.title <> btrim(p_title)
      or existing_notification.body <> btrim(p_body)
      or existing_notification.email_requested <> coalesce(p_email_requested, false)
      or existing_notification.push_requested <> coalesce(p_push_requested, false) then
      raise exception 'Notification id % is already used for another payload.', p_notification_id
        using errcode = '23505';
    end if;

    return existing_notification;
  end if;

  update public.app_feedback
  set status = p_status,
      reviewed_at = timezone('utc', now()),
      reviewed_by = p_admin_id
  where id = p_feedback_id;

  insert into public.user_notifications (
    id,
    user_id,
    created_by,
    feedback_id,
    kind,
    title,
    body,
    email_requested,
    email_status,
    push_requested,
    push_status
  ) values (
    p_notification_id,
    feedback_row.user_id,
    p_admin_id,
    p_feedback_id,
    'admin_message',
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

revoke execute on function public.review_app_feedback_with_notification(bigint, uuid, text, uuid, text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.review_app_feedback_with_notification(bigint, uuid, text, uuid, text, text, boolean, boolean)
  to service_role;

comment on function public.review_app_feedback_with_notification(bigint, uuid, text, uuid, text, text, boolean, boolean) is
  'Atomically sets a bug or feedback review status and creates the reply in the author inbox. Service role only.';

notify pgrst, 'reload schema';

commit;
