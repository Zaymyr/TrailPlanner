-- Partner slots ("emplacements partenaires") for the RaceBook.
--
-- Each slot (equipment = Matériel card, lodging = Services hébergement card)
-- shows the Pace Yourself affiliate link by default. With the Signature
-- sponsors module, the organizer can replace a slot with one of their own
-- edition sponsors or hide it. Partner presentation (name, logo, redirect)
-- reuses race_event_edition_sponsors; per-slot aggregate counters live here so
-- a sponsor shown elsewhere keeps separate reporting.

alter table public.race_event_edition_sponsors
  add constraint race_event_edition_sponsors_edition_id_id_key unique (edition_id, id);

create table public.race_event_edition_partner_slots (
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  slot_key text not null,
  mode text not null default 'affiliate',
  sponsor_id uuid,
  headline text,
  impression_count bigint not null default 0,
  click_count bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (edition_id, slot_key),
  constraint race_event_edition_partner_slots_slot_key_check
    check (slot_key in ('equipment', 'lodging')),
  constraint race_event_edition_partner_slots_mode_check
    check (mode in ('affiliate', 'partner', 'hidden')),
  constraint race_event_edition_partner_slots_partner_sponsor_check
    check ((mode = 'partner') = (sponsor_id is not null)),
  constraint race_event_edition_partner_slots_headline_check
    check (headline is null or (headline = btrim(headline) and char_length(headline) between 1 and 120)),
  constraint race_event_edition_partner_slots_counts_check
    check (impression_count >= 0 and click_count >= 0),
  -- A partner must belong to the same edition. Deleting the sponsor deletes the
  -- slot row, which returns the slot to its default affiliate presentation.
  constraint race_event_edition_partner_slots_sponsor_fk
    foreign key (edition_id, sponsor_id)
    references public.race_event_edition_sponsors(edition_id, id)
    on delete cascade
);

create index race_event_edition_partner_slots_sponsor_idx
  on public.race_event_edition_partner_slots(sponsor_id)
  where sponsor_id is not null;

create or replace function public.set_race_event_edition_partner_slots_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_race_event_edition_partner_slots_updated_at
before update on public.race_event_edition_partner_slots
for each row execute function public.set_race_event_edition_partner_slots_updated_at();

-- Slot configuration is draft content: reuse the sponsor revision bump, which
-- ignores updated_at and the aggregate counters.
create trigger bump_racebook_partner_slot_draft_revisions_trigger
after insert or update or delete on public.race_event_edition_partner_slots
for each row execute function public.bump_racebook_sponsor_draft_revisions();

create or replace function public.increment_racebook_partner_slot_metric(
  p_race_id uuid,
  p_slot_key text,
  p_metric text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_count bigint;
begin
  if p_slot_key not in ('equipment', 'lodging') or p_metric not in ('impression', 'click') then
    raise exception 'Invalid partner slot metric.' using errcode = '22023';
  end if;

  update public.race_event_edition_partner_slots as slot
  set impression_count = slot.impression_count + case when p_metric = 'impression' then 1 else 0 end,
      click_count = slot.click_count + case when p_metric = 'click' then 1 else 0 end
  from public.races as race,
       public.race_events as event_row
  where slot.slot_key = p_slot_key
    and slot.mode = 'partner'
    and race.id = p_race_id
    and race.edition_id = slot.edition_id
    and race.event_id = event_row.id
    and race.is_live
    and race.racebook_is_live
    and coalesce(race.racebook_preview_is_visible, true)
    and event_row.is_live
  returning case when p_metric = 'impression' then slot.impression_count else slot.click_count end
  into updated_count;

  if updated_count is null then
    raise exception 'Partner slot target not found.' using errcode = 'P0002';
  end if;

  return updated_count;
end;
$$;

alter table public.race_event_edition_partner_slots enable row level security;

revoke all on table public.race_event_edition_partner_slots from public, anon, authenticated;
grant select, insert, update, delete on table public.race_event_edition_partner_slots to service_role;

revoke all on function public.set_race_event_edition_partner_slots_updated_at() from public, anon, authenticated;
grant execute on function public.set_race_event_edition_partner_slots_updated_at() to service_role;
revoke all on function public.increment_racebook_partner_slot_metric(uuid, text, text) from public, anon, authenticated;
grant execute on function public.increment_racebook_partner_slot_metric(uuid, text, text) to service_role;

comment on table public.race_event_edition_partner_slots is
  'Edition RaceBook partner slots: default Pace Yourself affiliate, an organizer sponsor (Signature sponsors module) or hidden.';
comment on column public.race_event_edition_partner_slots.headline is
  'Optional short organizer text shown under the partner name.';
comment on function public.increment_racebook_partner_slot_metric(uuid, text, text) is
  'Atomically counts one impression or click of a published organizer partner slot; aggregate only.';
