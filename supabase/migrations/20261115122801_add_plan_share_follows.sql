-- Authenticated crew members following a runner's secret plan-share link.
-- Snapshot and crew-state data remain on plan_share_links and are exposed only
-- by authenticated, narrowly scoped server routes.

create table public.plan_share_follows (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.plan_share_links(id) on delete cascade,
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  removed_at timestamptz,
  archived_at timestamptz,
  constraint plan_share_follows_link_follower_key unique (share_link_id, follower_user_id),
  constraint plan_share_follows_nickname_check check (
    nickname is null or (char_length(btrim(nickname)) between 1 and 60 and nickname = btrim(nickname))
  )
);

create index plan_share_follows_follower_idx
  on public.plan_share_follows(follower_user_id, archived_at, created_at desc);

create index plan_share_follows_link_idx
  on public.plan_share_follows(share_link_id, removed_at, created_at desc);

create or replace function public.set_plan_share_follows_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_plan_share_follows_updated_at
before update on public.plan_share_follows
for each row execute function public.set_plan_share_follows_updated_at();

create or replace function public.prevent_own_plan_share_follow()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.plan_share_links
    where id = new.share_link_id
      and user_id = new.follower_user_id
  ) then
    raise exception 'A runner cannot follow their own plan-share link.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger prevent_own_plan_share_follow
before insert or update of share_link_id, follower_user_id on public.plan_share_follows
for each row execute function public.prevent_own_plan_share_follow();

alter table public.plan_share_follows enable row level security;

revoke all on table public.plan_share_follows from anon, authenticated;
grant select on table public.plan_share_follows to authenticated;
grant select, insert, update, delete on table public.plan_share_follows to service_role;

create policy "Followers can view own plan follows"
on public.plan_share_follows
for select
to authenticated
using (
  follower_user_id = (select auth.uid())
  and removed_at is null
);

create policy "Share owners can view link followers"
on public.plan_share_follows
for select
to authenticated
using (
  exists (
    select 1
    from public.plan_share_links
    where plan_share_links.id = plan_share_follows.share_link_id
      and plan_share_links.user_id = (select auth.uid())
  )
);
