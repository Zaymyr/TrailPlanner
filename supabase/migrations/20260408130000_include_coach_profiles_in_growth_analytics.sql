-- Count Stripe subscriptions tracked through either subscriptions or coach_profiles.
-- Some checkout events can populate coach_profiles before subscriptions gets a full webhook update.

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
      select 1
      from public.user_profiles up
      where up.user_id = u.id
        and up.water_bag_liters is not null
    ) as has_profile,
    coalesce(
      (
        select s.status
        from public.subscriptions s
        where s.user_id = u.id
          and lower(coalesce(s.status, '')) in ('active', 'trialing')
          and (s.current_period_end is null or s.current_period_end > now())
        limit 1
      ),
      (
        select cp.subscription_status
        from public.coach_profiles cp
        where cp.user_id = u.id
          and lower(coalesce(cp.subscription_status, '')) in ('active', 'trialing')
        limit 1
      ),
      (
        select s.status
        from public.subscriptions s
        where s.user_id = u.id
        limit 1
      ),
      (
        select cp.subscription_status
        from public.coach_profiles cp
        where cp.user_id = u.id
        limit 1
      )
    ) as subscription_status,
    (
      select s.current_period_end
      from public.subscriptions s
      where s.user_id = u.id
        and lower(coalesce(s.status, '')) in ('active', 'trialing')
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
