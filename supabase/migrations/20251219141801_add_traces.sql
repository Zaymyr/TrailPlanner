-- Add trace storage tables for user routes and aid stations
create table if not exists public.traces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists traces_owner_id_idx on public.traces(owner_id);

create table if not exists public.trace_points (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.traces(id) on delete cascade,
  idx int not null,
  lat double precision not null,
  lng double precision not null,
  elevation double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists trace_points_trace_idx on public.trace_points(trace_id, idx);

create table if not exists public.aid_stations (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.traces(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  type text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists aid_stations_trace_id_idx on public.aid_stations(trace_id);

-- updated_at triggers
create or replace function public.set_traces_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_traces_updated_at on public.traces;
create trigger set_traces_updated_at
before update on public.traces
for each row
execute function public.set_traces_updated_at();

create or replace function public.set_trace_points_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_trace_points_updated_at on public.trace_points;
create trigger set_trace_points_updated_at
before update on public.trace_points
for each row
execute function public.set_trace_points_updated_at();

create or replace function public.set_aid_stations_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_aid_stations_updated_at on public.aid_stations;
create trigger set_aid_stations_updated_at
before update on public.aid_stations
for each row
execute function public.set_aid_stations_updated_at();

-- RLS and policies
alter table public.traces enable row level security;
alter table public.trace_points enable row level security;
alter table public.aid_stations enable row level security;

drop policy if exists "Traces are readable when public or owned" on public.traces;
create policy "Traces are readable when public or owned" on public.traces
  for select using (
    auth.role() = 'service_role'
    or owner_id = auth.uid()
    or (is_public = true and auth.role() = 'authenticated')
  );

drop policy if exists "Trace owners can insert" on public.traces;
create policy "Trace owners can insert" on public.traces
  for insert with check (owner_id = auth.uid() or auth.role() = 'service_role');

drop policy if exists "Trace owners can update" on public.traces;
create policy "Trace owners can update" on public.traces
  for update using (owner_id = auth.uid() or auth.role() = 'service_role')
  with check (owner_id = auth.uid() or auth.role() = 'service_role');

drop policy if exists "Trace owners can delete" on public.traces;
create policy "Trace owners can delete" on public.traces
  for delete using (owner_id = auth.uid() or auth.role() = 'service_role');

drop policy if exists "Trace points visible with parent trace access" on public.trace_points;
create policy "Trace points visible with parent trace access" on public.trace_points
  for select using (
    exists (
      select 1 from public.traces t
      where t.id = trace_points.trace_id
        and (
          auth.role() = 'service_role'
          or t.owner_id = auth.uid()
          or (t.is_public = true and auth.role() = 'authenticated')
        )
    )
  );

drop policy if exists "Trace points require owner" on public.trace_points;
create policy "Trace points require owner" on public.trace_points
  for insert with check (
    exists (
      select 1 from public.traces t
      where t.id = trace_points.trace_id
        and (t.owner_id = auth.uid() or auth.role() = 'service_role')
    )
  );

drop policy if exists "Trace points update require owner" on public.trace_points;
create policy "Trace points update require owner" on public.trace_points
  for update using (
    exists (
      select 1 from public.traces t
      where t.id = trace_points.trace_id
        and (t.owner_id = auth.uid() or auth.role() = 'service_role')
    )
  ) with check (
    exists (
      select 1 from public.traces t
      where t.id = trace_points.trace_id
        and (t.owner_id = auth.uid() or auth.role() = 'service_role')
    )
  );

drop policy if exists "Trace points delete require owner" on public.trace_points;
create policy "Trace points delete require owner" on public.trace_points
  for delete using (
    exists (
      select 1 from public.traces t
      where t.id = trace_points.trace_id
        and (t.owner_id = auth.uid() or auth.role() = 'service_role')
    )
  );

drop policy if exists "Aid stations visible with parent trace access" on public.aid_stations;
create policy "Aid stations visible with parent trace access" on public.aid_stations
  for select using (
    exists (
      select 1 from public.traces t
      where t.id = aid_stations.trace_id
        and (
          auth.role() = 'service_role'
          or t.owner_id = auth.uid()
          or (t.is_public = true and auth.role() = 'authenticated')
        )
    )
  );

drop policy if exists "Aid stations require owner" on public.aid_stations;
create policy "Aid stations require owner" on public.aid_stations
  for insert with check (
    exists (
      select 1 from public.traces t
      where t.id = aid_stations.trace_id
        and (t.owner_id = auth.uid() or auth.role() = 'service_role')
    )
  );

drop policy if exists "Aid stations update require owner" on public.aid_stations;
create policy "Aid stations update require owner" on public.aid_stations
  for update using (
    exists (
      select 1 from public.traces t
      where t.id = aid_stations.trace_id
        and (t.owner_id = auth.uid() or auth.role() = 'service_role')
    )
  ) with check (
    exists (
      select 1 from public.traces t
      where t.id = aid_stations.trace_id
        and (t.owner_id = auth.uid() or auth.role() = 'service_role')
    )
  );

drop policy if exists "Aid stations delete require owner" on public.aid_stations;
create policy "Aid stations delete require owner" on public.aid_stations
  for delete using (
    exists (
      select 1 from public.traces t
      where t.id = aid_stations.trace_id
        and (t.owner_id = auth.uid() or auth.role() = 'service_role')
    )
  );
