alter table public.races
  add column if not exists web_catalog_is_live boolean not null default false;

comment on column public.races.web_catalog_is_live is
  'Whether this public course remains discoverable on the web catalog and SEO routes, independently from mobile catalog and RaceBook visibility.';

-- Preserve every currently public course and every format that has already
-- completed an Organizer publication. Later mobile/private transitions must
-- not remove those factual course pages from the web index.
update public.races
set web_catalog_is_live = true
where is_public = true
  and (
    is_live = true
    or racebook_publication_approved_at is not null
  );

create or replace function public.sync_race_web_catalog_visibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.is_public then
    new.web_catalog_is_live := false;
  elsif new.is_live then
    new.web_catalog_is_live := true;
  elsif tg_op = 'UPDATE' then
    new.web_catalog_is_live := old.web_catalog_is_live;
  end if;

  return new;
end;
$$;

comment on function public.sync_race_web_catalog_visibility() is
  'Promotes public mobile courses to the durable web catalog without letting later mobile hiding remove their web pages.';

drop trigger if exists sync_race_web_catalog_visibility on public.races;
create trigger sync_race_web_catalog_visibility
before insert or update of is_public, is_live, web_catalog_is_live on public.races
for each row
execute function public.sync_race_web_catalog_visibility();

revoke all on function public.sync_race_web_catalog_visibility()
from public, anon, authenticated;

create index if not exists races_web_catalog_date_name_idx
  on public.races (race_date, name)
  where is_public = true
    and web_catalog_is_live = true;
