create table if not exists public.user_favorite_race_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  event_id uuid not null references public.race_events(id) on delete cascade,
  constraint user_favorite_race_events_user_event_key unique (user_id, event_id)
);

create table if not exists public.race_event_updates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  event_id uuid not null references public.race_events(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  message text not null,
  constraint race_event_updates_message_check check (char_length(btrim(message)) > 0 and char_length(message) <= 280)
);

create index if not exists user_favorite_race_events_user_idx
  on public.user_favorite_race_events(user_id, created_at desc);
create index if not exists user_favorite_race_events_event_idx
  on public.user_favorite_race_events(event_id, created_at desc);
create index if not exists race_event_updates_event_created_idx
  on public.race_event_updates(event_id, created_at desc);

alter table public.user_favorite_race_events enable row level security;
alter table public.race_event_updates enable row level security;

grant select, insert, delete on public.user_favorite_race_events to authenticated;
grant select on public.race_event_updates to anon, authenticated;
grant insert on public.race_event_updates to authenticated;

drop policy if exists "Users can view own favorite race events" on public.user_favorite_race_events;
create policy "Users can view own favorite race events"
on public.user_favorite_race_events
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own favorite race events" on public.user_favorite_race_events;
create policy "Users can add own favorite race events"
on public.user_favorite_race_events
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own favorite race events" on public.user_favorite_race_events;
create policy "Users can delete own favorite race events"
on public.user_favorite_race_events
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Live race event updates are viewable" on public.race_event_updates;
create policy "Live race event updates are viewable"
on public.race_event_updates
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.race_events re
    where re.id = race_event_updates.event_id
      and re.is_live = true
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
    exists (
      select 1
      from public.race_event_organizers reo
      where reo.event_id = race_event_updates.event_id
        and reo.user_id = (select auth.uid())
        and reo.revoked_at is null
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);
