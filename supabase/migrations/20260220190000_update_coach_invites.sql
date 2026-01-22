alter table if exists public.coach_invites
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create or replace function public.set_coach_invites_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_coach_invites_updated_at on public.coach_invites;
create trigger set_coach_invites_updated_at
before update on public.coach_invites
for each row
execute function public.set_coach_invites_updated_at();

drop index if exists coach_invites_coach_email_uidx;
create unique index if not exists coach_invites_coach_email_uidx
  on public.coach_invites(coach_id, invite_email)
  where status <> 'canceled';

drop policy if exists "Invited users can read their invites" on public.coach_invites;
create policy "Invited users can read their invites" on public.coach_invites
  for select using (
    lower(invite_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or invitee_user_id = auth.uid()
  );
