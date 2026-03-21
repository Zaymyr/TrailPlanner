-- Growth analytics RPCs for the admin dashboard
-- All functions use SECURITY DEFINER to access auth.users
-- Access restricted to service_role only

create or replace function public.get_admin_user_rows()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  plan_count bigint,
  has_profile boolean,
  subscription_status text,
  subscription_period_end timestamptz,
  grant_reason text,
  app_metadata jsonb
)
security definer
language sql
as $$
  select
    u.id as user_id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    count(rp.id) as plan_count,
    exists (
      select 1 from public.user_profiles up where up.user_id = u.id
    ) as has_profile,
    (
      select s.status
      from public.subscriptions s
      where s.user_id = u.id
      limit 1
    ) as subscription_status,
    (
      select s.current_period_end
      from public.subscriptions s
      where s.user_id = u.id
      limit 1
    ) as subscription_period_end,
    (
      select pg.reason
      from public.premium_grants pg
      where pg.user_id = u.id
        and pg.starts_at <= now()
        and coalesce(
          pg.ends_at,
          pg.starts_at + (pg.initial_duration_days || ' days')::interval
        ) >= now()
      order by pg.starts_at desc
      limit 1
    ) as grant_reason,
    u.raw_app_meta_data as app_metadata
  from auth.users u
  left join public.race_plans rp on rp.user_id = u.id
  group by
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.raw_app_meta_data
  order by u.created_at desc;
$$;

revoke execute on function public.get_admin_user_rows() from anon, authenticated;
grant execute on function public.get_admin_user_rows() to service_role;

create or replace function public.get_signups_by_month()
returns table (month text, count bigint)
security definer
language sql
as $$
  select
    to_char(created_at, 'YYYY-MM') as month,
    count(*) as count
  from auth.users
  group by month
  order by month;
$$;

revoke execute on function public.get_signups_by_month() from anon, authenticated;
grant execute on function public.get_signups_by_month() to service_role;

create or replace function public.get_signups_by_day()
returns table (day text, count bigint)
security definer
language sql
as $$
  select
    to_char(created_at, 'YYYY-MM-DD') as day,
    count(*) as count
  from auth.users
  where created_at >= now() - interval '90 days'
  group by day
  order by day;
$$;

revoke execute on function public.get_signups_by_day() from anon, authenticated;
grant execute on function public.get_signups_by_day() to service_role;
