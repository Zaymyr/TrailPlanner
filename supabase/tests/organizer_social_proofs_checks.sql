-- Organizer social-proof storage checks.
-- Run manually after migrations; all mutations are rolled back.

begin;

do $$
begin
  if not (
    select c.relrowsecurity
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'organizer_social_proofs'
  ) then
    raise exception 'organizer_social_proofs must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.organizer_social_proofs', 'SELECT')
    or has_table_privilege('authenticated', 'public.organizer_social_proofs', 'SELECT')
    or has_table_privilege('anon', 'public.organizer_social_proofs', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.organizer_social_proofs', 'INSERT,UPDATE,DELETE') then
    raise exception 'Client roles must not access organizer_social_proofs.';
  end if;

  if not has_table_privilege('service_role', 'public.organizer_social_proofs', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'service_role must manage organizer_social_proofs.';
  end if;
end $$;

set local role service_role;

insert into public.organizer_social_proofs (
  edition_id,
  status,
  display_order
)
select id, 'draft', 0
from public.race_event_editions
order by created_at asc
limit 1
on conflict (edition_id) do update
set status = 'draft',
    consent_confirmed_at = null,
    published_at = null,
    updated_at = timezone('utc', now());

do $$
declare
  target_edition_id uuid;
begin
  select edition_id
  into target_edition_id
  from public.organizer_social_proofs
  order by updated_at desc
  limit 1;

  if target_edition_id is null then
    raise exception 'At least one event edition is required for the social-proof check.';
  end if;

  begin
    update public.organizer_social_proofs
    set status = 'published',
        published_at = timezone('utc', now())
    where edition_id = target_edition_id;
    raise exception 'Publishing without consent and an analytics snapshot must fail.';
  exception
    when check_violation then
      null;
  end;

  update public.organizer_social_proofs
  set status = 'published',
      consent_confirmed_at = timezone('utc', now()),
      unique_readers = 42,
      total_opens = 110,
      analytics_from = date '2026-09-01',
      analytics_to = date '2026-09-30',
      analytics_captured_at = timezone('utc', now()),
      published_at = timezone('utc', now())
  where edition_id = target_edition_id;

  if not exists (
    select 1
    from public.organizer_social_proofs
    where edition_id = target_edition_id
      and status = 'published'
      and unique_readers = 42
      and total_opens = 110
  ) then
    raise exception 'A complete service-managed social proof must be publishable.';
  end if;
end $$;

rollback;

