-- Retire the old coach/coachee feature set and its database objects.
-- The web app now resolves premium access from subscriptions, trials, and premium grants only.

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
set search_path = public, auth
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
        select s.status
        from public.subscriptions s
        where s.user_id = u.id
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

drop policy if exists "Coaches can view their coachee race plans" on public.race_plans;
drop policy if exists "Coaches can insert coachee race plans" on public.race_plans;
drop policy if exists "Coaches can update coachee race plans" on public.race_plans;
drop policy if exists "Coaches can delete coachee race plans" on public.race_plans;

drop table if exists public.coach_comments cascade;
drop table if exists public.coach_intake_targets cascade;
drop table if exists public.coach_invites cascade;
drop table if exists public.coach_coachees cascade;
drop table if exists public.coach_profiles cascade;

drop index if exists public.race_plans_coach_id_idx;
alter table if exists public.race_plans
  drop column if exists coach_id;

alter table if exists public.user_profiles
  drop column if exists coach_tier_id,
  drop column if exists is_coach,
  drop column if exists coach_plan_name;

drop table if exists public.coach_tiers cascade;

drop function if exists public.set_coach_comments_updated_at() cascade;
drop function if exists public.set_coach_intake_targets_updated_at() cascade;
drop function if exists public.set_coach_invites_updated_at() cascade;
drop function if exists public.set_coach_profiles_updated_at() cascade;
