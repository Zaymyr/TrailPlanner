-- Two RLS fixes for coach_coachees:
--
-- 1. SECURITY: Replace the over-permissive user INSERT policy with a service-role-only
--    policy. Previously any authenticated user could INSERT a row with themselves as
--    coach_id and any user_id as coachee_id, bypassing the invite system and potentially
--    gaining access to another user's race plans via the coach SELECT policy on race_plans.
--    All legitimate inserts go through the service role (see app/api/auth/session/route.ts).
--
-- 2. Allow coachees to SELECT their own coach relationships (e.g. to display "my coaches"
--    in the UI without going through the API).

-- Drop the insecure user-level INSERT policy.
drop policy if exists "Coaches can insert their coachees" on public.coach_coachees;

-- Replace with service-role-only INSERT + UPDATE writes.
-- (Coaches still handle their own coachee relationships via PATCH/DELETE below.)
create policy "Service role can insert coach coachees" on public.coach_coachees
  for insert with check (auth.role() = 'service_role');

-- Allow coachees to read their own coach relationships.
drop policy if exists "Coachees can view their own coach relationships" on public.coach_coachees;
create policy "Coachees can view their own coach relationships" on public.coach_coachees
  for select using (coachee_id = auth.uid());
