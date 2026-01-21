create table if not exists public.coach_comments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.user_profiles(user_id) on delete cascade,
  coachee_id uuid not null references public.user_profiles(user_id) on delete cascade,
  plan_id uuid not null references public.race_plans(id) on delete cascade,
  section_id text,
  aid_station_id text,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists coach_comments_plan_id_idx on public.coach_comments(plan_id);
create index if not exists coach_comments_coach_id_idx on public.coach_comments(coach_id);
create index if not exists coach_comments_coachee_id_idx on public.coach_comments(coachee_id);
create index if not exists coach_comments_section_id_idx on public.coach_comments(section_id);
create index if not exists coach_comments_aid_station_id_idx on public.coach_comments(aid_station_id);

create or replace function public.set_coach_comments_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_coach_comments_updated_at on public.coach_comments;
create trigger set_coach_comments_updated_at
before update on public.coach_comments
for each row
execute function public.set_coach_comments_updated_at();

alter table public.coach_comments enable row level security;

drop policy if exists "Coaches can manage coach comments" on public.coach_comments;
create policy "Coaches can manage coach comments" on public.coach_comments
for all
using (
  coach_id = auth.uid()
  and exists (
    select 1 from public.coach_coachees
    where coach_coachees.coach_id = auth.uid()
      and coach_coachees.coachee_id = coach_comments.coachee_id
  )
  and exists (
    select 1 from public.race_plans
    where race_plans.id = coach_comments.plan_id
      and race_plans.user_id = coach_comments.coachee_id
      and race_plans.coach_id = auth.uid()
  )
)
with check (
  coach_id = auth.uid()
  and exists (
    select 1 from public.coach_coachees
    where coach_coachees.coach_id = auth.uid()
      and coach_coachees.coachee_id = coach_comments.coachee_id
  )
  and exists (
    select 1 from public.race_plans
    where race_plans.id = coach_comments.plan_id
      and race_plans.user_id = coach_comments.coachee_id
      and race_plans.coach_id = auth.uid()
  )
);

drop policy if exists "Coachees can read coach comments" on public.coach_comments;
create policy "Coachees can read coach comments" on public.coach_comments
for select
using (
  coachee_id = auth.uid()
  and exists (
    select 1 from public.race_plans
    where race_plans.id = coach_comments.plan_id
      and race_plans.user_id = auth.uid()
  )
);
