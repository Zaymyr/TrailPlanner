create index if not exists race_plans_created_at_user_id_idx
  on public.race_plans (created_at, user_id);

create index if not exists race_plans_updated_at_user_id_idx
  on public.race_plans (updated_at, user_id);

create index if not exists affiliate_events_created_at_product_id_idx
  on public.affiliate_events (created_at desc, product_id);

create index if not exists organizer_edition_payments_created_at_idx
  on public.organizer_edition_payments (created_at desc);

create index if not exists organizer_edition_payments_paid_at_idx
  on public.organizer_edition_payments (paid_at desc)
  where paid_at is not null;

create index if not exists organizer_edition_payments_invalidated_at_idx
  on public.organizer_edition_payments (invalidated_at desc)
  where invalidated_at is not null;

create or replace function public.get_admin_growth_metrics(
  p_start_date date,
  p_end_date date,
  p_timezone text default 'Europe/Paris'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_now timestamptz := now();
  v_result jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'Invalid reporting range';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'Reporting range cannot exceed 366 days';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown reporting timezone';
  end if;

  v_start := p_start_date::timestamp at time zone p_timezone;
  v_end := p_end_date::timestamp at time zone p_timezone;

  with
  non_admin_users as (
    select u.id, u.email, u.created_at, u.last_sign_in_at
    from auth.users u
    where not (
      coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
      or coalesce(u.raw_app_meta_data -> 'roles', '[]'::jsonb) ? 'admin'
    )
  ),
  mature_account_cohort as (
    select u.id, u.created_at
    from non_admin_users u
    where u.email is not null
      and u.created_at >= v_start
      and u.created_at < v_end
      and u.created_at <= v_now - interval '24 hours'
  ),
  activated_accounts as (
    select cohort.id, cohort.created_at
    from mature_account_cohort cohort
    where exists (
      select 1
      from public.race_plans plan
      where plan.user_id = cohort.id
        and plan.created_at >= cohort.created_at
        and plan.created_at <= cohort.created_at + interval '24 hours'
    )
  ),
  active_subscriptions as (
    select subscription.user_id, subscription.provider
    from public.subscriptions subscription
    join non_admin_users u on u.id = subscription.user_id
    where lower(coalesce(subscription.status, '')) in ('active', 'trialing')
      and (subscription.current_period_end is null or subscription.current_period_end > v_now)
  ),
  paid_subscriptions as (
    select user_id, provider
    from active_subscriptions subscription
    where exists (
      select 1 from public.subscriptions source
      where source.user_id = subscription.user_id
        and lower(coalesce(source.status, '')) = 'active'
    )
  ),
  active_trials as (
    select profile.user_id
    from public.user_profiles profile
    join non_admin_users u on u.id = profile.user_id
    where profile.trial_started_at <= v_now and profile.trial_ends_at > v_now
  ),
  active_grants as (
    select distinct grant_row.user_id
    from public.premium_grants grant_row
    join non_admin_users u on u.id = grant_row.user_id
    where grant_row.starts_at <= v_now
      and coalesce(grant_row.ends_at, grant_row.starts_at + make_interval(days => grant_row.initial_duration_days)) > v_now
  ),
  effective_premium as (
    select user_id from active_subscriptions
    union select user_id from active_trials
    union select user_id from active_grants
  ),
  memberships as (
    select membership.*
    from public.race_event_organizers membership
    join non_admin_users u on u.id = membership.user_id
    where membership.revoked_at is null
  ),
  event_cohort as (
    select distinct membership.event_id
    from memberships membership
    where membership.role = 'owner'
      and membership.created_by = membership.user_id
      and membership.created_at >= v_start
      and membership.created_at < v_end
  ),
  cohort_progress as (
    select
      cohort.event_id,
      exists (select 1 from public.race_event_editions edition where edition.event_id = cohort.event_id) as has_edition,
      exists (
        select 1 from public.races race
        where race.event_id = cohort.event_id
          and (race.data_status = 'complete' or (coalesce(race.data_status, '') <> 'draft' and cardinality(coalesce(race.missing_required_fields, '{}'::text[])) = 0))
      ) as has_complete_format,
      exists (select 1 from public.races race where race.event_id = cohort.event_id and race.racebook_is_live) as has_published_racebook
    from event_cohort cohort
  ),
  organizer_counts as (
    select
      count(distinct membership.user_id) filter (
        where membership.created_by = membership.user_id
          and membership.created_at >= v_start and membership.created_at < v_end
      )::integer as new_organizers,
      count(distinct membership.user_id) filter (
        where u.last_sign_in_at >= v_start and u.last_sign_in_at < v_end
      )::integer as active_organizers,
      count(distinct membership.user_id) filter (
        where u.last_sign_in_at >= v_start and u.last_sign_in_at < v_end
          and u.last_sign_in_at >= membership.created_at + interval '7 days'
      )::integer as returning_organizers
    from memberships membership
    join non_admin_users u on u.id = membership.user_id
  ),
  entitled_editions as (
    select entitlement.edition_id, entitlement.source
    from public.organizer_edition_entitlements entitlement
    join public.race_event_editions edition on edition.id = entitlement.edition_id
    where entitlement.status = 'active'
      and entitlement.tier in ('racebook', 'pro')
      and exists (select 1 from memberships membership where membership.event_id = edition.event_id)
  ),
  commercial_activity as (
    select
      count(*) filter (
        where payment.created_at >= v_start and payment.created_at < v_end
      )::integer as checkouts_started,
      count(*) filter (
        where payment.created_at >= v_start and payment.created_at < v_end
          and payment.paid_at is not null
      )::integer as checkout_cohort_paid,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
      )::integer as paid_transactions,
      coalesce(sum(payment.amount_total) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
      ), 0)::bigint as gross_revenue_minor,
      count(*) filter (
        where payment.invalidated_at >= v_start and payment.invalidated_at < v_end
          and payment.status in ('refunded', 'disputed')
      )::integer as invalidated_transactions,
      coalesce(sum(payment.amount_total) filter (
        where payment.invalidated_at >= v_start and payment.invalidated_at < v_end
          and payment.status in ('refunded', 'disputed')
      ), 0)::bigint as invalidated_revenue_minor,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
          and payment.purchase_kind = 'racebook'
      )::integer as racebook_sales,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
          and payment.purchase_kind = 'pro_direct'
      )::integer as pro_direct_sales,
      count(*) filter (
        where payment.paid_at >= v_start and payment.paid_at < v_end
          and payment.purchase_kind = 'pro_upgrade'
      )::integer as pro_upgrade_sales
    from public.organizer_edition_payments payment
    where payment.purchaser_user_id is null
      or exists (select 1 from non_admin_users u where u.id = payment.purchaser_user_id)
  ),
  trend_days as (
    select day::date as day
    from generate_series(p_start_date, p_end_date - 1, interval '1 day') day
  ),
  trend as (
    select jsonb_agg(jsonb_build_object(
      'date', to_char(days.day, 'YYYY-MM-DD'),
      'newAccounts', (select count(*) from non_admin_users u where u.email is not null and (u.created_at at time zone p_timezone)::date = days.day),
      'activationEligibleAccounts', (select count(*) from mature_account_cohort u where (u.created_at at time zone p_timezone)::date = days.day),
      'activatedUsers', (select count(*) from activated_accounts u where (u.created_at at time zone p_timezone)::date = days.day),
      'activePlanUsers', (select count(distinct plan.user_id) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where (plan.updated_at at time zone p_timezone)::date = days.day),
      'newPlans', (select count(*) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where (plan.created_at at time zone p_timezone)::date = days.day)
    ) order by days.day) as value
    from trend_days days
  ),
  follow_ups as (
    select coalesce(jsonb_agg(item.value order by item.days_inactive desc), '[]'::jsonb) as value
    from (
      select jsonb_build_object(
        'eventId', event.id,
        'eventName', event.name,
        'organizerEmail', coalesce(u.email, membership.user_id::text),
        'lastActivityAt', coalesce(u.last_sign_in_at, membership.created_at),
        'status', case
          when exists (select 1 from public.races race where race.event_id = event.id and race.racebook_is_live) then 'published'
          when not exists (select 1 from public.races race where race.event_id = event.id) then 'no_format'
          when not exists (
            select 1 from public.races race where race.event_id = event.id
              and (race.data_status = 'complete' or (coalesce(race.data_status, '') <> 'draft' and cardinality(coalesce(race.missing_required_fields, '{}'::text[])) = 0))
          ) then 'incomplete'
          else 'ready_to_publish'
        end,
        'daysInactive', greatest(0, floor(extract(epoch from (v_now - coalesce(u.last_sign_in_at, membership.created_at))) / 86400)::integer)
      ) as value,
      greatest(0, floor(extract(epoch from (v_now - coalesce(u.last_sign_in_at, membership.created_at))) / 86400)::integer) as days_inactive
      from memberships membership
      join auth.users u on u.id = membership.user_id
      join public.race_events event on event.id = membership.event_id
      where membership.role = 'owner'
        and not exists (select 1 from public.races race where race.event_id = event.id and race.racebook_is_live)
        and v_now - coalesce(u.last_sign_in_at, membership.created_at) >= interval '3 days'
      order by days_inactive desc
      limit 20
    ) item
  )
  select jsonb_build_object(
    'overview', jsonb_build_object(
      'newAccounts', (select count(*) from non_admin_users u where u.email is not null and u.created_at >= v_start and u.created_at < v_end),
      'activationEligibleAccounts', (select count(*) from mature_account_cohort),
      'activatedUsers', (select count(*) from activated_accounts),
      'activePlanUsers', (select count(distinct plan.user_id) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where plan.updated_at >= v_start and plan.updated_at < v_end),
      'newPlans', (select count(*) from public.race_plans plan join non_admin_users u on u.id = plan.user_id where plan.created_at >= v_start and plan.created_at < v_end),
      'activePremiumUsers', (select count(*) from effective_premium),
      'premium', jsonb_build_object(
        'paidSubscriptions', (select count(*) from paid_subscriptions),
        'appTrials', (select count(*) from active_trials),
        'grants', (select count(*) from active_grants),
        'effectiveUsers', (select count(*) from effective_premium),
        'providers', jsonb_build_object(
          'web', (select count(*) from paid_subscriptions where provider = 'web'),
          'apple', (select count(*) from paid_subscriptions where provider = 'apple'),
          'google', (select count(*) from paid_subscriptions where provider = 'google')
        )
      )
    ),
    'trend', (select value from trend),
    'organizers', jsonb_build_object(
      'newOrganizers', (select new_organizers from organizer_counts),
      'activeOrganizers', (select active_organizers from organizer_counts),
      'returningOrganizers', (select returning_organizers from organizer_counts),
      'eventsCreated', (select count(*) from event_cohort),
      'editionsCreated', (select count(*) from public.race_event_editions edition where edition.created_at >= v_start and edition.created_at < v_end and exists (select 1 from memberships membership where membership.event_id = edition.event_id)),
      'formatsCreated', (select count(*) from public.races race where race.created_at >= v_start and race.created_at < v_end and exists (select 1 from memberships membership where membership.event_id = race.event_id)),
      'publishedRacebooks', (select count(*) from public.races race where race.racebook_publication_approved_at >= v_start and race.racebook_publication_approved_at < v_end and exists (select 1 from memberships membership where membership.event_id = race.event_id)),
      'activatedRacebooks', (select count(*) from entitled_editions),
      'giftedRacebooks', (select count(*) from entitled_editions where source in ('admin', 'legacy_admin')),
      'paidRacebooks', (select count(*) from entitled_editions where source = 'stripe'),
      'commercial', jsonb_build_object(
        'checkoutsStarted', (select checkouts_started from commercial_activity),
        'checkoutCohortPaid', (select checkout_cohort_paid from commercial_activity),
        'checkoutConversion', case
          when (select checkouts_started from commercial_activity) = 0 then null
          else round(100.0 * (select checkout_cohort_paid from commercial_activity) / (select checkouts_started from commercial_activity), 1)
        end,
        'paidTransactions', (select paid_transactions from commercial_activity),
        'grossRevenueMinor', (select gross_revenue_minor from commercial_activity),
        'invalidatedTransactions', (select invalidated_transactions from commercial_activity),
        'invalidatedRevenueMinor', (select invalidated_revenue_minor from commercial_activity),
        'netRevenueMinor', (select gross_revenue_minor - invalidated_revenue_minor from commercial_activity),
        'currency', 'eur',
        'racebookSales', (select racebook_sales from commercial_activity),
        'proDirectSales', (select pro_direct_sales from commercial_activity),
        'proUpgradeSales', (select pro_upgrade_sales from commercial_activity)
      ),
      'funnel', jsonb_build_array(
        jsonb_build_object('step', 'Événements de la cohorte', 'count', (select count(*) from cohort_progress), 'conversionFromPrevious', null),
        jsonb_build_object('step', 'Avec une édition', 'count', (select count(*) from cohort_progress where has_edition), 'conversionFromPrevious', case when (select count(*) from cohort_progress) = 0 then null else round(100.0 * (select count(*) from cohort_progress where has_edition) / (select count(*) from cohort_progress), 1) end),
        jsonb_build_object('step', 'Avec un format complet', 'count', (select count(*) from cohort_progress where has_edition and has_complete_format), 'conversionFromPrevious', case when (select count(*) from cohort_progress where has_edition) = 0 then null else round(100.0 * (select count(*) from cohort_progress where has_edition and has_complete_format) / (select count(*) from cohort_progress where has_edition), 1) end),
        jsonb_build_object('step', 'Avec un RaceBook publié', 'count', (select count(*) from cohort_progress where has_edition and has_complete_format and has_published_racebook), 'conversionFromPrevious', case when (select count(*) from cohort_progress where has_edition and has_complete_format) = 0 then null else round(100.0 * (select count(*) from cohort_progress where has_edition and has_complete_format and has_published_racebook) / (select count(*) from cohort_progress where has_edition and has_complete_format), 1) end)
      ),
      'followUps', (select value from follow_ups)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_growth_metrics(date, date, text) from public, anon, authenticated;
grant execute on function public.get_admin_growth_metrics(date, date, text) to service_role;

create or replace function public.get_admin_affiliate_metrics(
  p_start_date date,
  p_end_date date,
  p_timezone text default 'Europe/Paris'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'Invalid reporting range';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'Reporting range cannot exceed 366 days';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown reporting timezone';
  end if;

  v_start := p_start_date::timestamp at time zone p_timezone;
  v_end := p_end_date::timestamp at time zone p_timezone;

  with scoped as (
    select event.*
    from public.affiliate_events event
    where event.created_at >= v_start and event.created_at < v_end
  ),
  totals as (
    select
      count(*) filter (where event_type = 'popup_open')::integer as popup_opens,
      count(*) filter (where event_type = 'click')::integer as clicks,
      count(distinct session_id) filter (where event_type = 'popup_open')::integer as unique_popup_sessions,
      count(distinct session_id) filter (where event_type = 'click')::integer as unique_click_sessions
    from scoped
  ),
  product_stats as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'productId', stats.product_id,
      'productName', product.name,
      'popupOpens', stats.popup_opens,
      'clicks', stats.clicks,
      'ctr', case when stats.popup_opens = 0 then null else round(100.0 * stats.clicks / stats.popup_opens, 1) end
    )) order by stats.popup_opens + stats.clicks desc, product.name), '[]'::jsonb) as value
    from (
      select product_id,
        count(*) filter (where event_type = 'popup_open')::integer as popup_opens,
        count(*) filter (where event_type = 'click')::integer as clicks
      from scoped group by product_id
    ) stats
    left join public.products product on product.id = stats.product_id
  ),
  recent_events as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', recent.id,
      'productId', recent.product_id,
      'productName', product.name,
      'eventType', recent.event_type,
      'countryCode', recent.country_code,
      'merchant', recent.merchant,
      'occurredAt', recent.created_at
    )) order by recent.created_at desc), '[]'::jsonb) as value
    from (select * from scoped order by created_at desc limit 100) recent
    left join public.products product on product.id = recent.product_id
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'popupOpens', totals.popup_opens,
      'clicks', totals.clicks,
      'uniquePopupSessions', totals.unique_popup_sessions,
      'uniqueClickSessions', totals.unique_click_sessions,
      'ctr', case when totals.popup_opens = 0 then null else round(100.0 * totals.clicks / totals.popup_opens, 1) end
    ),
    'productStats', (select value from product_stats),
    'recentEvents', (select value from recent_events)
  ) into v_result
  from totals;

  return v_result;
end;
$$;

revoke all on function public.get_admin_affiliate_metrics(date, date, text) from public, anon, authenticated;
grant execute on function public.get_admin_affiliate_metrics(date, date, text) to service_role;

comment on function public.get_admin_growth_metrics(date, date, text) is
  'Service-only aggregate KPI snapshot. Date bounds are interpreted in the supplied business timezone and activation uses only fully matured 24-hour cohorts.';

comment on function public.get_admin_affiliate_metrics(date, date, text) is
  'Service-only affiliate KPI aggregate for a bounded business-date range; recentEvents is capped independently from complete aggregate totals.';
