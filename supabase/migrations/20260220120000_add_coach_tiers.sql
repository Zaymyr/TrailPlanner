create table if not exists public.coach_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_limit integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint coach_tiers_name_key unique (name)
);

insert into public.coach_tiers (name, invite_limit)
values
  ('starter', 1),
  ('pro', 5),
  ('elite', 20)
on conflict (name) do nothing;

alter table public.coach_tiers enable row level security;

drop policy if exists "Authenticated users can read coach tiers" on public.coach_tiers;
create policy "Authenticated users can read coach tiers" on public.coach_tiers
  for select
  using (auth.role() = 'authenticated');
