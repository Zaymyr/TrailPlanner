alter table if exists public.coach_coachees enable row level security;

drop policy if exists "Coaches and coachees can read their relationships" on public.coach_coachees;
drop policy if exists "Coaches can read their coachees" on public.coach_coachees;
create policy "Coaches and coachees can read their relationships" on public.coach_coachees
  for select using (coach_id = auth.uid() or coachee_id = auth.uid());
