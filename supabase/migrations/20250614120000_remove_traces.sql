-- Remove trace feature tables, triggers, and policies

-- Drop triggers
drop trigger if exists set_traces_updated_at on public.traces;
drop trigger if exists set_trace_points_updated_at on public.trace_points;
drop trigger if exists set_aid_stations_updated_at on public.aid_stations;

-- Drop trigger functions
drop function if exists public.set_traces_updated_at();
drop function if exists public.set_trace_points_updated_at();
drop function if exists public.set_aid_stations_updated_at();

-- Drop RLS policies
drop policy if exists "Traces are readable when public or owned" on public.traces;
drop policy if exists "Trace owners can insert" on public.traces;
drop policy if exists "Trace owners can update" on public.traces;
drop policy if exists "Trace owners can delete" on public.traces;
drop policy if exists "Trace points visible with parent trace access" on public.trace_points;
drop policy if exists "Trace points require owner" on public.trace_points;
drop policy if exists "Trace points update require owner" on public.trace_points;
drop policy if exists "Trace points delete require owner" on public.trace_points;
drop policy if exists "Aid stations visible with parent trace access" on public.aid_stations;
drop policy if exists "Aid stations require owner" on public.aid_stations;
drop policy if exists "Aid stations update require owner" on public.aid_stations;
drop policy if exists "Aid stations delete require owner" on public.aid_stations;

-- Disable RLS before dropping tables
alter table if exists public.traces disable row level security;
alter table if exists public.trace_points disable row level security;
alter table if exists public.aid_stations disable row level security;

-- Drop tables (order matters because of FKs)
drop table if exists public.aid_stations;
drop table if exists public.trace_points;
drop table if exists public.traces;
