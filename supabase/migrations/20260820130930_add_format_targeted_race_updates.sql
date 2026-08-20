alter table public.race_event_updates
  add column if not exists race_id uuid references public.races(id) on delete set null;

create index if not exists race_event_updates_race_created_idx
  on public.race_event_updates(race_id, created_at desc)
  where race_id is not null;

create table if not exists public.race_event_update_reads (
  update_id uuid not null references public.race_event_updates(id) on delete cascade,
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  read_at timestamptz not null default timezone('utc', now()),
  primary key (update_id, user_id)
);

create index if not exists race_event_update_reads_user_idx
  on public.race_event_update_reads(user_id, read_at desc);

alter table public.race_event_update_reads enable row level security;

grant select, insert on public.race_event_update_reads to authenticated;

drop policy if exists "Users can view own race event update reads" on public.race_event_update_reads;
create policy "Users can view own race event update reads"
on public.race_event_update_reads
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can mark own race event updates read" on public.race_event_update_reads;
create policy "Users can mark own race event updates read"
on public.race_event_update_reads
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.race_event_updates update_row
    join public.race_events event_row on event_row.id = update_row.event_id
    where update_row.id = race_event_update_reads.update_id
      and event_row.is_live = true
  )
);

drop policy if exists "Organizers can create race event updates" on public.race_event_updates;
create policy "Organizers can create race event updates"
on public.race_event_updates
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    race_id is null
    or exists (
      select 1
      from public.races race_row
      where race_row.id = race_event_updates.race_id
        and race_row.event_id = race_event_updates.event_id
        and race_row.is_live = true
    )
  )
  and (
    exists (
      select 1
      from public.race_event_organizers organizer_row
      where organizer_row.event_id = race_event_updates.event_id
        and organizer_row.user_id = (select auth.uid())
        and organizer_row.revoked_at is null
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);
