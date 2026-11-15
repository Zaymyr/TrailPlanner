-- Edition-scoped Supporter Guide. It reuses immutable RaceBook publications
-- and never grants access to a source module on its own.

alter table public.organizer_racebook_module_settings
  drop constraint if exists organizer_racebook_module_settings_scope_check;

alter table public.organizer_racebook_module_settings
  add constraint organizer_racebook_module_settings_scope_check check (
    (race_id is null and module_key in ('equipment', 'bib_pickup', 'access', 'services', 'branding', 'sponsors', 'supporter_guide'))
    or
    (race_id is not null and module_key in ('aid_stations', 'supporter_points', 'start_waves', 'awards', 'relay', 'official_products'))
  );

create or replace function public.initialize_organizer_edition_modules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
  values
    (new.id, 'equipment', true),
    (new.id, 'bib_pickup', true),
    (new.id, 'access', true),
    (new.id, 'supporter_guide', true)
  on conflict do nothing;
  return new;
end;
$$;

insert into public.organizer_racebook_module_settings (edition_id, module_key, is_enabled)
select id, 'supporter_guide', true
from public.race_event_editions
on conflict do nothing;

revoke all on function public.initialize_organizer_edition_modules() from public, anon, authenticated;
grant execute on function public.initialize_organizer_edition_modules() to service_role;

comment on constraint organizer_racebook_module_settings_scope_check on public.organizer_racebook_module_settings is
  'Edition and format module keys; supporter_guide is edition-scoped and does not widen its source modules.';
