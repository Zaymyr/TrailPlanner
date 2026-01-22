alter table if exists public.race_plans enable row level security;

drop policy if exists "Coaches can view their coachee race plans" on public.race_plans;
drop policy if exists "Coaches can insert coachee race plans" on public.race_plans;
drop policy if exists "Coaches can update coachee race plans" on public.race_plans;
drop policy if exists "Coaches can delete coachee race plans" on public.race_plans;

create policy "Coaches can view their coachee race plans" on public.race_plans
  for select using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
        and coach_coachees.status = 'active'
    )
  );

create policy "Coaches can insert coachee race plans" on public.race_plans
  for insert with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
        and coach_coachees.status = 'active'
    )
  );

create policy "Coaches can update coachee race plans" on public.race_plans
  for update using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
        and coach_coachees.status = 'active'
    )
  )
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
        and coach_coachees.status = 'active'
    )
  );

create policy "Coaches can delete coachee race plans" on public.race_plans
  for delete using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
        and coach_coachees.status = 'active'
    )
  );
