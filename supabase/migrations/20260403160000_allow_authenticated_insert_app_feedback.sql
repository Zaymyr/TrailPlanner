drop policy if exists "Authenticated users can insert app feedback" on public.app_feedback;

create policy "Authenticated users can insert app feedback" on public.app_feedback
  for insert
  to authenticated
  with check (true);
