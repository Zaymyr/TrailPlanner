create table public.race_event_edition_branding (
  edition_id uuid primary key references public.race_event_editions(id) on delete cascade,
  draft_logo_url text,
  draft_primary_color text not null default '#2D5016',
  draft_accent_color text not null default '#B45309',
  published_logo_url text,
  published_primary_color text,
  published_accent_color text,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint race_event_edition_branding_draft_logo_check
    check (draft_logo_url is null or draft_logo_url ~ '^https://'),
  constraint race_event_edition_branding_published_logo_check
    check (published_logo_url is null or published_logo_url ~ '^https://'),
  constraint race_event_edition_branding_draft_primary_check
    check (draft_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint race_event_edition_branding_draft_accent_check
    check (draft_accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint race_event_edition_branding_published_primary_check
    check (published_primary_color is null or published_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint race_event_edition_branding_published_accent_check
    check (published_accent_color is null or published_accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint race_event_edition_branding_published_state_check
    check (
      (published_at is null and published_logo_url is null and published_primary_color is null and published_accent_color is null)
      or
      (published_at is not null and published_primary_color is not null and published_accent_color is not null)
    )
);

create or replace function public.set_race_event_edition_branding_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_race_event_edition_branding_updated_at
before update on public.race_event_edition_branding
for each row execute function public.set_race_event_edition_branding_updated_at();

create or replace function public.publish_racebook_edition_branding(p_edition_id uuid)
returns public.race_event_edition_branding
language plpgsql
security invoker
set search_path = ''
as $$
declare
  published public.race_event_edition_branding;
begin
  update public.race_event_edition_branding
  set published_logo_url = draft_logo_url,
      published_primary_color = draft_primary_color,
      published_accent_color = draft_accent_color,
      published_at = timezone('utc', now())
  where edition_id = p_edition_id
  returning * into published;

  if published.edition_id is null then
    raise exception 'RaceBook edition branding not found.';
  end if;

  return published;
end;
$$;

alter table public.race_event_edition_branding enable row level security;

revoke all on table public.race_event_edition_branding from public, anon, authenticated;
grant select, insert, update, delete on table public.race_event_edition_branding to service_role;

revoke all on function public.publish_racebook_edition_branding(uuid) from public, anon, authenticated;
grant execute on function public.publish_racebook_edition_branding(uuid) to service_role;

comment on table public.race_event_edition_branding is
  'Service-managed draft and published RaceBook branding for one canonical event edition.';
comment on column public.race_event_edition_branding.published_at is
  'Null until the organizer explicitly publishes the current branding draft.';
