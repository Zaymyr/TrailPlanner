alter table if exists public.race_plans
  add column if not exists coach_id uuid references public.user_profiles(user_id);

create index if not exists race_plans_coach_id_idx on public.race_plans(coach_id);

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
    )
  );

create policy "Coaches can insert coachee race plans" on public.race_plans
  for insert with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
    )
  );

create policy "Coaches can update coachee race plans" on public.race_plans
  for update using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
    )
  )
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
    )
  );

create policy "Coaches can delete coachee race plans" on public.race_plans
  for delete using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
    )
  );
