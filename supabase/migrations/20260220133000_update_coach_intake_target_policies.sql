alter table if exists public.coach_intake_targets enable row level security;

drop policy if exists "Coaches can insert intake targets" on public.coach_intake_targets;
create policy "Coaches can insert intake targets" on public.coach_intake_targets
  for insert with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = coach_intake_targets.coachee_id
    )
  );

drop policy if exists "Coaches can update intake targets" on public.coach_intake_targets;
create policy "Coaches can update intake targets" on public.coach_intake_targets
  for update using (coach_id = auth.uid())
  with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = coach_intake_targets.coachee_id
    )
  );
