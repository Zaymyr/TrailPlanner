create table if not exists public.race_event_edition_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.race_events(id) on delete cascade,
  source_year integer not null,
  requested_start_date date not null,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_notes text,
  constraint race_event_edition_requests_status_check check (status in ('pending', 'approved', 'rejected'))
);

create or replace function public.set_race_event_edition_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_race_event_edition_requests_updated_at on public.race_event_edition_requests;
create trigger set_race_event_edition_requests_updated_at
before update on public.race_event_edition_requests
for each row
execute function public.set_race_event_edition_requests_updated_at();

create index if not exists race_event_edition_requests_user_idx
  on public.race_event_edition_requests(user_id, created_at desc);

create index if not exists race_event_edition_requests_event_idx
  on public.race_event_edition_requests(event_id, status, requested_start_date desc);

create unique index if not exists race_event_edition_requests_open_event_date_idx
  on public.race_event_edition_requests(event_id, requested_start_date)
  where status in ('pending', 'approved');

alter table public.race_event_edition_requests enable row level security;

grant select, insert, update on public.race_event_edition_requests to authenticated;

drop policy if exists "Users can create own race event edition requests" on public.race_event_edition_requests;
create policy "Users can create own race event edition requests"
on public.race_event_edition_requests
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "Users can view own race event edition requests" on public.race_event_edition_requests;
create policy "Users can view own race event edition requests"
on public.race_event_edition_requests
for select
to authenticated
using (
  auth.uid() = user_id
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
);

drop policy if exists "Admins can update race event edition requests" on public.race_event_edition_requests;
create policy "Admins can update race event edition requests"
on public.race_event_edition_requests
for update
to authenticated
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

comment on table public.race_event_edition_requests is
  'Organizer requests to open a new yearly event edition after admin validation.';

comment on column public.race_event_edition_requests.source_year is
  'The currently selected event edition year that the organizer wants to renew.';

comment on column public.race_event_edition_requests.requested_start_date is
  'Requested start date for the new event edition, used for billing/review before any race rows are cloned.';
