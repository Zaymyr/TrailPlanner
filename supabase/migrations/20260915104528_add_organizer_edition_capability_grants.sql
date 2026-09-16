create table public.organizer_edition_capability_grants (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  capability_key text not null,
  status text not null default 'active',
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizer_edition_capability_grants_edition_capability_key
    unique (edition_id, capability_key),
  constraint organizer_edition_capability_grants_capability_key_check
    check (capability_key in ('racebook_analytics.view')),
  constraint organizer_edition_capability_grants_status_check
    check (status in ('active', 'revoked')),
  constraint organizer_edition_capability_grants_lifecycle_check
    check (
      (status = 'active' and granted_at is not null and revoked_by is null and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    )
);

create index organizer_edition_capability_grants_granted_by_idx
  on public.organizer_edition_capability_grants(granted_by)
  where granted_by is not null;

create index organizer_edition_capability_grants_revoked_by_idx
  on public.organizer_edition_capability_grants(revoked_by)
  where revoked_by is not null;

alter table public.organizer_edition_capability_grants enable row level security;

revoke all on table public.organizer_edition_capability_grants
  from public, anon, authenticated;
grant select, insert, update, delete on table public.organizer_edition_capability_grants
  to service_role;

create or replace function public.set_admin_organizer_edition_capability_grant(
  p_edition_id uuid,
  p_admin_id uuid,
  p_capability_key text,
  p_enabled boolean
)
returns public.organizer_edition_capability_grants
language plpgsql
security invoker
set search_path = ''
as $$
declare
  grant_row public.organizer_edition_capability_grants;
  changed_at timestamptz := timezone('utc', now());
begin
  if p_capability_key is distinct from 'racebook_analytics.view' then
    raise exception 'Invalid organizer edition capability.' using errcode = '22023';
  end if;

  if p_enabled is null then
    raise exception 'Capability enabled state is required.' using errcode = '22023';
  end if;

  if p_admin_id is null then
    raise exception 'Administrator attribution is required.' using errcode = '22023';
  end if;

  select *
  into grant_row
  from public.organizer_edition_capability_grants
  where edition_id = p_edition_id
    and capability_key = p_capability_key
  for update;

  -- Repeated requests must not rewrite the administrator or timestamp that
  -- actually performed the transition. Revoking a capability that has never
  -- been granted is likewise a no-op, rather than a fabricated audit event.
  if found and grant_row.status = (case when p_enabled then 'active' else 'revoked' end) then
    return grant_row;
  end if;

  if not found and not p_enabled then
    return null;
  end if;

  insert into public.organizer_edition_capability_grants (
    edition_id,
    capability_key,
    status,
    granted_by,
    granted_at,
    revoked_by,
    revoked_at,
    updated_at
  ) values (
    p_edition_id,
    p_capability_key,
    case when p_enabled then 'active' else 'revoked' end,
    case when p_enabled then p_admin_id else null end,
    case when p_enabled then changed_at else null end,
    case when p_enabled then null else p_admin_id end,
    case when p_enabled then null else changed_at end,
    changed_at
  )
  on conflict (edition_id, capability_key) do update set
    status = excluded.status,
    granted_by = case
      when excluded.status = 'active' then excluded.granted_by
      else public.organizer_edition_capability_grants.granted_by
    end,
    granted_at = case
      when excluded.status = 'active' then excluded.granted_at
      else public.organizer_edition_capability_grants.granted_at
    end,
    revoked_by = excluded.revoked_by,
    revoked_at = excluded.revoked_at,
    updated_at = excluded.updated_at
  where public.organizer_edition_capability_grants.status is distinct from excluded.status
  returning * into grant_row;

  return grant_row;
end;
$$;

revoke all on function public.set_admin_organizer_edition_capability_grant(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.set_admin_organizer_edition_capability_grant(uuid, uuid, text, boolean)
  to service_role;

comment on table public.organizer_edition_capability_grants is
  'Service-only edition-scoped complimentary module grants that supplement, but never replace, the commercial tier.';
comment on column public.organizer_edition_capability_grants.capability_key is
  'Stable application capability identifier. Only explicitly supported complimentary modules are accepted.';
comment on function public.set_admin_organizer_edition_capability_grant(uuid, uuid, text, boolean) is
  'Activates or revokes a supported complimentary edition capability while retaining grant/revoke attribution.';
