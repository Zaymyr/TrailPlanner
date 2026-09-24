create table if not exists public.racebook_gear_checks (
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  race_id uuid not null references public.races(id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 320),
  checked_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, race_id, item_key)
);

create index if not exists racebook_gear_checks_race_idx
  on public.racebook_gear_checks(race_id);

alter table public.racebook_gear_checks enable row level security;

revoke all on table public.racebook_gear_checks from anon, authenticated;
grant select, insert, delete on table public.racebook_gear_checks to authenticated;
grant all on table public.racebook_gear_checks to service_role;

drop policy if exists "Users can view own RaceBook gear checks" on public.racebook_gear_checks;
create policy "Users can view own RaceBook gear checks"
on public.racebook_gear_checks
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own RaceBook gear checks" on public.racebook_gear_checks;
create policy "Users can add own RaceBook gear checks"
on public.racebook_gear_checks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove own RaceBook gear checks" on public.racebook_gear_checks;
create policy "Users can remove own RaceBook gear checks"
on public.racebook_gear_checks
for delete
to authenticated
using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
