create table if not exists public.coach_coachees (
  coach_id uuid not null references public.user_profiles(user_id) on delete cascade,
  coachee_id uuid not null references public.user_profiles(user_id) on delete cascade,
  status text not null,
  invited_email text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (coach_id, coachee_id)
);

create index if not exists coach_coachees_coach_id_idx on public.coach_coachees(coach_id);
create index if not exists coach_coachees_coachee_id_idx on public.coach_coachees(coachee_id);

create table if not exists public.coach_intake_targets (
  coachee_id uuid not null references public.user_profiles(user_id) on delete cascade,
  coach_id uuid not null references public.user_profiles(user_id) on delete cascade,
  carbs_per_hour numeric,
  water_ml_per_hour numeric,
  sodium_mg_per_hour numeric,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists coach_intake_targets_coach_coachee_uidx
  on public.coach_intake_targets(coach_id, coachee_id);

create index if not exists coach_intake_targets_coach_id_idx on public.coach_intake_targets(coach_id);
create index if not exists coach_intake_targets_coachee_id_idx on public.coach_intake_targets(coachee_id);

create or replace function public.set_coach_intake_targets_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_coach_intake_targets_updated_at on public.coach_intake_targets;
create trigger set_coach_intake_targets_updated_at
before update on public.coach_intake_targets
for each row
execute function public.set_coach_intake_targets_updated_at();

alter table public.coach_coachees enable row level security;
alter table public.coach_intake_targets enable row level security;

drop policy if exists "Coaches can read their coachees" on public.coach_coachees;
create policy "Coaches can read their coachees" on public.coach_coachees
  for select using (coach_id = auth.uid());

drop policy if exists "Coaches can insert their coachees" on public.coach_coachees;
create policy "Coaches can insert their coachees" on public.coach_coachees
  for insert with check (coach_id = auth.uid());

drop policy if exists "Coaches can update their coachees" on public.coach_coachees;
create policy "Coaches can update their coachees" on public.coach_coachees
  for update using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Coaches can delete their coachees" on public.coach_coachees;
create policy "Coaches can delete their coachees" on public.coach_coachees
  for delete using (coach_id = auth.uid());

drop policy if exists "Coaches can read their intake targets" on public.coach_intake_targets;
create policy "Coaches can read their intake targets" on public.coach_intake_targets
  for select using (coach_id = auth.uid() or coachee_id = auth.uid());

drop policy if exists "Coaches can insert intake targets" on public.coach_intake_targets;
create policy "Coaches can insert intake targets" on public.coach_intake_targets
  for insert with check (coach_id = auth.uid());

drop policy if exists "Coaches can update intake targets" on public.coach_intake_targets;
create policy "Coaches can update intake targets" on public.coach_intake_targets
  for update using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Coaches can delete intake targets" on public.coach_intake_targets;
create policy "Coaches can delete intake targets" on public.coach_intake_targets
  for delete using (coach_id = auth.uid());
