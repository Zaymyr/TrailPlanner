create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  locale text not null default 'en',
  app_version text,
  notifications_enabled boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  constraint push_devices_platform_check check (platform in ('ios', 'android')),
  constraint push_devices_locale_check check (locale in ('fr', 'en'))
);

create unique index if not exists push_devices_expo_push_token_uidx on public.push_devices(expo_push_token);
create index if not exists push_devices_user_id_idx on public.push_devices(user_id);
create index if not exists push_devices_last_seen_at_idx
  on public.push_devices(last_seen_at)
  where notifications_enabled = true;

create or replace function public.set_push_devices_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_push_devices_updated_at on public.push_devices;
create trigger set_push_devices_updated_at
before update on public.push_devices
for each row
execute function public.set_push_devices_updated_at();

create table if not exists public.push_notification_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references auth.users(id) on delete cascade,
  push_device_id uuid not null references public.push_devices(id) on delete cascade,
  plan_id uuid references public.race_plans(id) on delete cascade,
  notification_kind text not null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  expo_ticket_id text
);

create unique index if not exists push_notification_events_device_dedupe_uidx
  on public.push_notification_events(push_device_id, dedupe_key);
create index if not exists push_notification_events_user_id_idx on public.push_notification_events(user_id);
create index if not exists push_notification_events_kind_idx on public.push_notification_events(notification_kind);
create index if not exists push_notification_events_created_at_idx on public.push_notification_events(created_at desc);

alter table public.push_devices enable row level security;
alter table public.push_notification_events enable row level security;

create policy "Service role can manage push devices" on public.push_devices
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Users can view their push devices" on public.push_devices
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their push devices" on public.push_devices
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their push devices" on public.push_devices
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their push devices" on public.push_devices
  for delete
  using (auth.uid() = user_id);

create policy "Service role can manage push notification events" on public.push_notification_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Users can view their push notification events" on public.push_notification_events
  for select
  using (auth.uid() = user_id);
