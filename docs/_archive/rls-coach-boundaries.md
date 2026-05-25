# Coach/coachee RLS boundary checks

Use these manual SQL checks in the Supabase SQL editor to validate coach/coachee row-level security policies. Replace the placeholder UUIDs/emails with real values from your project.

> **Note:** Run these inside a transaction and **rollback** to avoid data changes. The SQL editor runs as an admin role by default, so we explicitly switch to the `authenticated` role and inject JWT claims.

```sql
begin;

-- Switch to authenticated role so RLS policies apply.
set local role authenticated;

-- Coach context
select
  set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '<coach_id>',
      'email', 'coach@example.com'
    )::text,
    true
  );

-- Coach can read their relationships
select *
from public.coach_coachees
where coach_id = '<coach_id>'
  and coachee_id = '<coachee_id>';

-- Coach can insert their relationships
insert into public.coach_coachees (coach_id, coachee_id, status, invited_email)
values ('<coach_id>', '<coachee_id>', 'active', 'coachee@example.com');

-- Invite creation/read as coach
insert into public.coach_invites (coach_id, invite_email, status)
values ('<coach_id>', 'coachee@example.com', 'pending');

select *
from public.coach_invites
where coach_id = '<coach_id>'
  and invite_email = 'coachee@example.com';

-- Coachee context
select
  set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '<coachee_id>',
      'email', 'coachee@example.com'
    )::text,
    true
  );

-- Coachee can read their relationship
select *
from public.coach_coachees
where coachee_id = '<coachee_id>';

-- Coachee cannot insert relationships (should fail)
insert into public.coach_coachees (coach_id, coachee_id, status)
values ('<coach_id>', '<other_user_id>', 'active');

-- Invitee can read their own invite by email
select *
from public.coach_invites
where invite_email = 'coachee@example.com';

rollback;
```
