-- Organizer demo requests sent from the public /organisateurs page.
-- Visitors are anonymous: rows are written and read only by server routes with
-- the service role (public form API, admin inbox). No client policy is granted.

begin;

create table if not exists public.organizer_demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  email text not null,
  race_url text not null,
  phone text,
  attribution jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  is_pending boolean generated always as (status = 'pending') stored,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_email_status text,
  confirmation_email_status text,
  constraint organizer_demo_requests_status_check check (status in ('pending', 'completed', 'rejected')),
  constraint organizer_demo_requests_email_check check (char_length(email) between 3 and 320 and email like '%_@_%'),
  constraint organizer_demo_requests_race_url_check check (char_length(race_url) <= 2048 and race_url ~* '^https?://'),
  constraint organizer_demo_requests_phone_check check (phone is null or char_length(phone) between 6 and 40),
  constraint organizer_demo_requests_attribution_check check (jsonb_typeof(attribution) = 'object'),
  constraint organizer_demo_requests_email_status_check check (
    (admin_email_status is null or admin_email_status in ('sent', 'skipped', 'failed'))
    and (confirmation_email_status is null or confirmation_email_status in ('sent', 'skipped', 'failed'))
  )
);

create index if not exists organizer_demo_requests_pending_created_idx
  on public.organizer_demo_requests(is_pending desc, created_at desc);

create index if not exists organizer_demo_requests_reviewed_by_idx
  on public.organizer_demo_requests(reviewed_by)
  where reviewed_by is not null;

drop trigger if exists set_organizer_demo_requests_updated_at on public.organizer_demo_requests;
create trigger set_organizer_demo_requests_updated_at
before update on public.organizer_demo_requests
for each row execute function public.set_admin_user_notification_updated_at();

alter table public.organizer_demo_requests enable row level security;

revoke all on table public.organizer_demo_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.organizer_demo_requests to service_role;

comment on table public.organizer_demo_requests is
  'Demo requests from the public organizer landing page. Service-role only; listed in the admin inbox under Demandes de course.';

commit;
