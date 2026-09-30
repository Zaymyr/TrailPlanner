-- Retire runner-created standalone races. Organizer and admin format creation
-- stays server-mediated; trusted administrators retain their existing direct
-- catalog insert path.

drop policy if exists "races_insert" on public.races;
create policy "races_insert"
on public.races for insert to authenticated
with check ((select public.is_admin()));
