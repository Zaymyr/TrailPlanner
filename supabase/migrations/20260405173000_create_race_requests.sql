create table if not exists public.race_requests (
  id bigint generated always as identity not null,
  created_at timestamp with time zone not null default now(),
  user_id uuid not null default auth.uid(),
  race_name text not null,
  location text not null,
  requested_date date not null,
  status text not null default 'pending',
  constraint race_requests_pkey primary key (id),
  constraint race_requests_status_check check (status in ('pending', 'approved', 'rejected'))
) tablespace pg_default;

create index if not exists race_requests_created_at_idx
  on public.race_requests using btree (created_at desc)
  tablespace pg_default;

create index if not exists race_requests_user_id_idx
  on public.race_requests using btree (user_id)
  tablespace pg_default;

alter table public.race_requests enable row level security;

drop policy if exists "Users can insert race requests" on public.race_requests;
create policy "Users can insert race requests" on public.race_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their race requests" on public.race_requests;
create policy "Users can view their race requests" on public.race_requests
  for select
  to authenticated
  using (auth.uid() = user_id);
