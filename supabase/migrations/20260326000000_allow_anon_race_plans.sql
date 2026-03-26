-- Allow anonymous users (anonymous sign-in via Supabase) to access race_plans.
-- Anonymous users have a real auth.uid() and use the 'authenticated' JWT role,
-- so existing RLS policies (auth.uid() = user_id) already apply to them.
-- These grants ensure the anon PostgREST role can reach the table when the
-- JWT switches the effective role to 'authenticated'.
grant usage on schema public to anon;
grant select, insert, update, delete on public.race_plans to anon;
