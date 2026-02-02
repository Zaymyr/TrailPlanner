create extension if not exists "pgcrypto";

create table if not exists public.premium_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  initial_duration_days integer not null,
  reason text not null,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists premium_grants_user_id_idx on public.premium_grants(user_id);
create index if not exists premium_grants_starts_at_idx on public.premium_grants(starts_at);

create or replace function public.set_premium_grants_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_premium_grants_updated_at on public.premium_grants;
create trigger set_premium_grants_updated_at
before update on public.premium_grants
for each row
execute function public.set_premium_grants_updated_at();

alter table public.premium_grants enable row level security;

drop policy if exists "Service role or admins can manage premium grants" on public.premium_grants;
create policy "Service role or admins can manage premium grants" on public.premium_grants
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'role') = 'admin'
  );

drop policy if exists "Users can read their active premium grants" on public.premium_grants;
create policy "Users can read their active premium grants" on public.premium_grants
  for select using (
    auth.uid() = user_id
    and starts_at <= now()
    and coalesce(
      ends_at,
      starts_at + (initial_duration_days || ' days')::interval
    ) >= now()
  );
