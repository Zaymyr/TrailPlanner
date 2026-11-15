-- Schema, privilege and RLS checks for authenticated plan-share followers.
-- Run after 20261115122801_add_plan_share_follows.sql.

begin;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.plan_share_follows'::regclass) then
    raise exception 'plan_share_follows must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.plan_share_follows', 'select') then
    raise exception 'Anonymous users must not access plan_share_follows.';
  end if;

  if not has_table_privilege('authenticated', 'public.plan_share_follows', 'select') then
    raise exception 'Authenticated users need RLS-scoped select access.';
  end if;

  if has_table_privilege('authenticated', 'public.plan_share_follows', 'insert')
    or has_table_privilege('authenticated', 'public.plan_share_follows', 'update')
    or has_table_privilege('authenticated', 'public.plan_share_follows', 'delete') then
    raise exception 'All plan-share follow writes must remain service-role only.';
  end if;

  if not has_table_privilege('service_role', 'public.plan_share_follows', 'select,insert,update,delete') then
    raise exception 'service_role needs full plan-share follow access.';
  end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'plan_share_follows') <> 2 then
    raise exception 'Expected follower and share-owner select policies.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plan_share_follows'::regclass
      and confrelid = 'public.plan_share_links'::regclass
      and contype = 'f' and confdeltype = 'c'
  ) then
    raise exception 'Share-link deletion must cascade to follows.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plan_share_follows'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f' and confdeltype = 'c'
  ) then
    raise exception 'Follower deletion must cascade to follows.';
  end if;
end;
$$;

rollback;
