drop policy if exists "Coaches can view their coachee race plans" on public.race_plans;
create policy "Coaches can view their coachee race plans" on public.race_plans
  for select using (
    exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
        and coach_coachees.status = 'active'
    )
  );

drop policy if exists "Coaches can update coachee race plans" on public.race_plans;
create policy "Coaches can update coachee race plans" on public.race_plans
  for update using (
    exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
        and coach_coachees.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
        and coach_coachees.status = 'active'
    )
  );

drop policy if exists "Coaches can delete coachee race plans" on public.race_plans;
create policy "Coaches can delete coachee race plans" on public.race_plans
  for delete using (
    exists (
      select 1 from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = race_plans.user_id
        and coach_coachees.status = 'active'
    )
  );

drop policy if exists "Coaches can manage coach comments" on public.coach_comments;
create policy "Coaches can manage coach comments" on public.coach_comments
  for all
  using (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = coach_comments.coachee_id
    )
    and exists (
      select 1
      from public.race_plans
      where race_plans.id = coach_comments.plan_id
        and race_plans.user_id = coach_comments.coachee_id
    )
  )
  with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.coach_coachees
      where coach_coachees.coach_id = auth.uid()
        and coach_coachees.coachee_id = coach_comments.coachee_id
    )
    and exists (
      select 1
      from public.race_plans
      where race_plans.id = coach_comments.plan_id
        and race_plans.user_id = coach_comments.coachee_id
    )
  );
