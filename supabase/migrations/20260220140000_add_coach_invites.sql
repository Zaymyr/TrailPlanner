create table if not exists public.coach_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.user_profiles(user_id) on delete cascade,
  invite_email text not null,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  invitee_user_id uuid references auth.users(id)
);

create index if not exists coach_invites_coach_id_idx on public.coach_invites(coach_id);
create index if not exists coach_invites_invite_email_idx on public.coach_invites(invite_email);
create index if not exists coach_invites_invitee_user_id_idx on public.coach_invites(invitee_user_id);
create unique index if not exists coach_invites_coach_email_uidx on public.coach_invites(coach_id, invite_email);

alter table public.coach_invites enable row level security;

create policy "Coaches can read their invites" on public.coach_invites
  for select using (coach_id = auth.uid());

create policy "Invited users can read their invites" on public.coach_invites
  for select using (lower(invite_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Coaches can insert invites" on public.coach_invites
  for insert with check (coach_id = auth.uid());

create policy "Coaches can update their invites" on public.coach_invites
  for update using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "Coaches can delete their invites" on public.coach_invites
  for delete using (coach_id = auth.uid());
