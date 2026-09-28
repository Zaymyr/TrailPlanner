alter table public.race_event_edition_branding
  alter column draft_accent_color set default '#3F6F8F';

update public.race_event_edition_branding
set draft_accent_color = '#3F6F8F'
where draft_primary_color = '#2D5016'
  and draft_accent_color = '#B45309';

update public.race_event_edition_branding
set published_accent_color = '#3F6F8F'
where published_primary_color = '#2D5016'
  and published_accent_color = '#B45309';

comment on column public.race_event_edition_branding.draft_accent_color is
  'Organizer working graphic accent; defaults to the Pace Yourself alpine blue.';
