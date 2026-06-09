-- Public crew recap links for saved race plans.
-- The public token is never stored: only its SHA-256 hex hash is persisted.

create table if not exists public.plan_share_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  plan_id uuid not null references public.race_plans(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token_hash text not null unique,
  snapshot jsonb not null,
  snapshot_schema_version integer not null default 1,
  departure_time text,
  locale text not null default 'fr',
  plan_updated_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint plan_share_links_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint plan_share_links_departure_time_check check (
    departure_time is null or departure_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  constraint plan_share_links_locale_check check (locale in ('fr', 'en')),
  constraint plan_share_links_snapshot_schema_version_check check (snapshot_schema_version = 1),
  constraint plan_share_links_snapshot_size_check check (octet_length(snapshot::text) <= 120000)
);

create index if not exists plan_share_links_plan_idx
  on public.plan_share_links(plan_id, created_at desc);

create index if not exists plan_share_links_user_idx
  on public.plan_share_links(user_id, created_at desc);

create index if not exists plan_share_links_active_token_idx
  on public.plan_share_links(token_hash)
  where revoked_at is null;

create or replace function public.set_plan_share_links_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_plan_share_links_updated_at on public.plan_share_links;
create trigger set_plan_share_links_updated_at
before update on public.plan_share_links
for each row
execute function public.set_plan_share_links_updated_at();

alter table public.plan_share_links enable row level security;

grant select, insert, update, delete on public.plan_share_links to authenticated;

drop policy if exists "Users can view own plan share links" on public.plan_share_links;
create policy "Users can view own plan share links"
on public.plan_share_links
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own plan share links" on public.plan_share_links;
create policy "Users can create own plan share links"
on public.plan_share_links
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.race_plans
    where race_plans.id = plan_share_links.plan_id
      and race_plans.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own plan share links" on public.plan_share_links;
create policy "Users can update own plan share links"
on public.plan_share_links
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.race_plans
    where race_plans.id = plan_share_links.plan_id
      and race_plans.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own plan share links" on public.plan_share_links;
create policy "Users can delete own plan share links"
on public.plan_share_links
for delete
to authenticated
using ((select auth.uid()) = user_id);
