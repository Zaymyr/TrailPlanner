-- Coach/coachee RLS checks
-- Run manually in a Supabase SQL editor or psql session.
-- This script uses RLS-authenticated contexts and rolls back at the end.

begin;

-- Seed users
set local role authenticated;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.user_profiles (user_id, full_name)
values ('00000000-0000-0000-0000-000000000001', 'Coach');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into public.user_profiles (user_id, full_name)
values ('00000000-0000-0000-0000-000000000002', 'Coachee A');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
insert into public.user_profiles (user_id, full_name)
values ('00000000-0000-0000-0000-000000000003', 'Coachee B');

-- Coach establishes relationships and intake targets.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.coach_coachees (coach_id, coachee_id, status)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'active'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'active');

insert into public.coach_intake_targets (coach_id, coachee_id, carbs_per_hour)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 60);

-- Coachee A should only see their relationship and intake targets.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

do $$
begin
  if (select count(*) from public.coach_coachees) <> 1 then
    raise exception 'Expected coachee to see exactly one coach relationship.';
  end if;

  if (select count(*) from public.coach_intake_targets) <> 1 then
    raise exception 'Expected coachee to see exactly one intake target.';
  end if;
end $$;

-- Coachee B should see their relationship but no intake target.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

do $$
begin
  if (select count(*) from public.coach_coachees) <> 1 then
    raise exception 'Expected coachee to see exactly one coach relationship.';
  end if;

  if (select count(*) from public.coach_intake_targets) <> 0 then
    raise exception 'Expected coachee to see zero intake targets.';
  end if;
end $$;

-- Coach should see all relationships and intake targets.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

do $$
begin
  if (select count(*) from public.coach_coachees) <> 2 then
    raise exception 'Expected coach to see two coachee relationships.';
  end if;

  if (select count(*) from public.coach_intake_targets) <> 1 then
    raise exception 'Expected coach to see one intake target.';
  end if;
end $$;

-- TODO: mirror coachee-select checks for coach comments and coach plans once added.

rollback;
