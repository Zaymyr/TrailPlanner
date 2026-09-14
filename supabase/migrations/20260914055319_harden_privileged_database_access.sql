-- Close legacy authorization paths that trusted the client-writable profile role,
-- and make privileged database helpers explicit service-role APIs.

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce((select auth.jwt()) -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin';
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

comment on function public.is_admin() is
  'Checks only trusted Auth app_metadata for an administrator role.';

-- Remove stale/self-assigned legacy admin labels unless Auth app metadata
-- independently confirms the administrator role.
update public.user_profiles profile_row
set role = null
where lower(coalesce(profile_row.role, '')) = 'admin'
  and not exists (
    select 1
    from auth.users user_row
    where user_row.id = profile_row.user_id
      and (
        coalesce(user_row.raw_app_meta_data ->> 'role', '') = 'admin'
        or coalesce(user_row.raw_app_meta_data -> 'roles', '[]'::jsonb) ? 'admin'
      )
  );

create or replace function public.protect_server_managed_profile_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;

  if (
    tg_op = 'INSERT'
    and (
      new.role is not null
      or new.trial_started_at is not null
      or new.trial_ends_at is not null
      or new.sign_in_count is distinct from 0
      or new.first_sign_in_at is not null
      or new.last_sign_in_at is not null
    )
  ) or (
    tg_op = 'UPDATE'
    and (
      new.role is distinct from old.role
      or new.trial_started_at is distinct from old.trial_started_at
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.sign_in_count is distinct from old.sign_in_count
      or new.first_sign_in_at is distinct from old.first_sign_in_at
      or new.last_sign_in_at is distinct from old.last_sign_in_at
    )
  ) then
    raise exception 'user_profiles server-managed fields cannot be changed by clients'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_server_managed_profile_fields() from public, anon, authenticated;
grant execute on function public.protect_server_managed_profile_fields() to service_role;

drop trigger if exists protect_server_managed_profile_fields_insert on public.user_profiles;
create trigger protect_server_managed_profile_fields_insert
before insert on public.user_profiles
for each row
execute function public.protect_server_managed_profile_fields();

drop trigger if exists protect_server_managed_profile_fields_update on public.user_profiles;
create trigger protect_server_managed_profile_fields_update
before update of role, trial_started_at, trial_ends_at, sign_in_count, first_sign_in_at, last_sign_in_at
on public.user_profiles
for each row
execute function public.protect_server_managed_profile_fields();

drop policy if exists "Users can view their profile" on public.user_profiles;
create policy "Users can view their profile"
on public.user_profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can upsert their profile" on public.user_profiles;
create policy "Users can upsert their profile"
on public.user_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their profile" on public.user_profiles;
create policy "Users can update their profile"
on public.user_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Service role or admins can manage premium grants" on public.premium_grants;
create policy "Service role or admins can manage premium grants"
on public.premium_grants for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Users can read their active premium grants" on public.premium_grants;
create policy "Users can read their active premium grants"
on public.premium_grants for select to authenticated
using (
  (select auth.uid()) = user_id
  and starts_at <= now()
  and coalesce(ends_at, starts_at + (initial_duration_days || ' days')::interval) >= now()
);

-- Preserve direct owner management while removing every legacy profile-role and
-- user_metadata administrator branch from catalog mutations.
update public.races race_row
set is_public = false,
    is_live = false,
    is_published = false,
    event_id = null,
    edition_id = null,
    edition_group_id = race_row.id,
    racebook_preview_is_visible = false,
    racebook_is_live = false,
    racebook_publication_approved_at = null,
    racebook_publication_approved_by = null
where race_row.created_by is not null
  and race_row.event_id is null
  and race_row.edition_id is null
  and not exists (
    select 1
    from auth.users user_row
    where user_row.id = race_row.created_by
      and (
        coalesce(user_row.raw_app_meta_data ->> 'role', '') = 'admin'
        or coalesce(user_row.raw_app_meta_data -> 'roles', '[]'::jsonb) ? 'admin'
      )
  );

drop policy if exists "races_insert" on public.races;
create policy "races_insert"
on public.races for insert to authenticated
with check (
  (select public.is_admin())
  or (
    created_by = (select auth.uid())
    and is_public = false
    and is_live = false
    and is_published = false
    and event_id is null
    and edition_id is null
    and edition_group_id = id
    and racebook_preview_is_visible = false
    and racebook_is_live = false
    and racebook_publication_approved_at is null
    and racebook_publication_approved_by is null
  )
);

drop policy if exists "races_update" on public.races;
create policy "races_update"
on public.races for update to authenticated
using (
  (select public.is_admin())
  or (
    created_by = (select auth.uid())
    and is_public = false
    and is_live = false
    and is_published = false
    and event_id is null
    and edition_id is null
    and edition_group_id = id
    and racebook_preview_is_visible = false
    and racebook_is_live = false
    and racebook_publication_approved_at is null
    and racebook_publication_approved_by is null
  )
)
with check (
  (select public.is_admin())
  or (
    created_by = (select auth.uid())
    and is_public = false
    and is_live = false
    and is_published = false
    and event_id is null
    and edition_id is null
    and edition_group_id = id
    and racebook_preview_is_visible = false
    and racebook_is_live = false
    and racebook_publication_approved_at is null
    and racebook_publication_approved_by is null
  )
);

drop policy if exists "races_delete" on public.races;
create policy "races_delete"
on public.races for delete to authenticated
using (
  (select public.is_admin())
  or (
    created_by = (select auth.uid())
    and is_public = false
    and is_live = false
    and is_published = false
    and event_id is null
    and edition_id is null
    and edition_group_id = id
    and racebook_preview_is_visible = false
    and racebook_is_live = false
    and racebook_publication_approved_at is null
    and racebook_publication_approved_by is null
  )
);

drop policy if exists "race_aid_stations_insert" on public.race_aid_stations;
create policy "race_aid_stations_insert"
on public.race_aid_stations for insert to authenticated
with check (
  exists (
    select 1
    from public.races race_row
    where race_row.id = race_aid_stations.race_id
      and (
        (
          race_row.created_by = (select auth.uid())
          and race_row.is_public = false
          and race_row.is_live = false
          and race_row.is_published = false
          and race_row.event_id is null
          and race_row.edition_id is null
          and race_row.edition_group_id = race_row.id
          and race_row.racebook_preview_is_visible = false
          and race_row.racebook_is_live = false
          and race_row.racebook_publication_approved_at is null
          and race_row.racebook_publication_approved_by is null
        )
        or (select public.is_admin())
      )
  )
);

drop policy if exists "race_aid_stations_update" on public.race_aid_stations;
create policy "race_aid_stations_update"
on public.race_aid_stations for update to authenticated
using (
  exists (
    select 1
    from public.races race_row
    where race_row.id = race_aid_stations.race_id
      and (
        (
          race_row.created_by = (select auth.uid())
          and race_row.is_public = false
          and race_row.is_live = false
          and race_row.is_published = false
          and race_row.event_id is null
          and race_row.edition_id is null
          and race_row.edition_group_id = race_row.id
          and race_row.racebook_preview_is_visible = false
          and race_row.racebook_is_live = false
          and race_row.racebook_publication_approved_at is null
          and race_row.racebook_publication_approved_by is null
        )
        or (select public.is_admin())
      )
  )
)
with check (
  exists (
    select 1
    from public.races race_row
    where race_row.id = race_aid_stations.race_id
      and (
        (
          race_row.created_by = (select auth.uid())
          and race_row.is_public = false
          and race_row.is_live = false
          and race_row.is_published = false
          and race_row.event_id is null
          and race_row.edition_id is null
          and race_row.edition_group_id = race_row.id
          and race_row.racebook_preview_is_visible = false
          and race_row.racebook_is_live = false
          and race_row.racebook_publication_approved_at is null
          and race_row.racebook_publication_approved_by is null
        )
        or (select public.is_admin())
      )
  )
);

drop policy if exists "race_aid_stations_delete" on public.race_aid_stations;
create policy "race_aid_stations_delete"
on public.race_aid_stations for delete to authenticated
using (
  exists (
    select 1
    from public.races race_row
    where race_row.id = race_aid_stations.race_id
      and (
        (
          race_row.created_by = (select auth.uid())
          and race_row.is_public = false
          and race_row.is_live = false
          and race_row.is_published = false
          and race_row.event_id is null
          and race_row.edition_id is null
          and race_row.edition_group_id = race_row.id
          and race_row.racebook_preview_is_visible = false
          and race_row.racebook_is_live = false
          and race_row.racebook_publication_approved_at is null
          and race_row.racebook_publication_approved_by is null
        )
        or (select public.is_admin())
      )
  )
);

-- SECURITY DEFINER functions are executable by PUBLIC by default. Revoke by
-- identity so the migration also secures live functions whose creation predates
-- the repository's visible migration history.
do $$
declare
  privileged_function regprocedure;
begin
  for privileged_function in
    select procedure_row.oid::regprocedure
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = any (array[
        'get_admin_user_rows',
        'get_admin_growth_metrics',
        'get_signups_by_day',
        'get_signups_by_month',
        'get_trial_users_enriched',
        'get_trial_users_for_reminder',
        'check_and_increment_rate_limit',
        'configure_push_reminders_cron',
        'handle_new_user_profile',
        'increment_user_sign_in',
        'purge_expired_rate_limit_entries',
        'sync_race_has_aid_stations'
      ])
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      privileged_function
    );
    execute format('grant execute on function %s to service_role', privileged_function);
  end loop;
end;
$$;

-- New functions must opt into Data API exposure explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- The review view now obeys the products table grants and RLS policies.
alter view public.product_brand_review set (security_invoker = true);

-- Pin the mutable function search paths reported by the database advisor. All
-- referenced non-pg_catalog objects in these functions are schema-qualified.
alter function public.set_push_devices_updated_at() set search_path = '';
alter function public.set_plan_share_links_updated_at() set search_path = '';
alter function public.normalize_product_brand(text) set search_path = '';
alter function public.infer_product_brand(text, text) set search_path = '';
alter function public.set_product_brand() set search_path = '';
alter function public.set_race_event_claims_updated_at() set search_path = '';
alter function public.set_race_aid_station_products_updated_at() set search_path = '';
alter function public.set_race_event_edition_requests_updated_at() set search_path = '';
alter function public.set_race_event_publication_requests_updated_at() set search_path = '';
alter function public.handle_new_user_profile() set search_path = '';

-- Index the remaining foreign-key columns that participate in owner lookups,
-- Auth-user deletion cleanup, admin payment analytics, or audit attribution.
create index if not exists nutrition_plans_user_id_idx
  on public.nutrition_plans (user_id);
create index if not exists organizer_edition_entitlements_granted_by_idx
  on public.organizer_edition_entitlements (granted_by)
  where granted_by is not null;
create index if not exists organizer_edition_payments_purchaser_user_id_idx
  on public.organizer_edition_payments (purchaser_user_id)
  where purchaser_user_id is not null;
create index if not exists organizer_edition_payments_recorded_by_idx
  on public.organizer_edition_payments (recorded_by)
  where recorded_by is not null;
create index if not exists organizer_edition_payments_invoice_uploaded_by_idx
  on public.organizer_edition_payments (invoice_uploaded_by)
  where invoice_uploaded_by is not null;
