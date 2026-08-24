alter table public.race_event_editions
  add column if not exists is_visible boolean not null default true;

comment on column public.race_event_editions.is_visible is
  'Whether formats in this edition may appear in the public catalog. Hiding an edition also hides all attached Racebooks.';

alter table public.races
  drop constraint if exists races_edition_id_fkey;

alter table public.races
  add constraint races_edition_id_fkey
  foreign key (edition_id)
  references public.race_event_editions(id)
  on delete cascade;

create or replace function public.enforce_race_event_edition_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  edition_is_visible boolean;
begin
  if new.edition_id is null then
    return new;
  end if;

  select ree.is_visible
  into edition_is_visible
  from public.race_event_editions ree
  where ree.id = new.edition_id;

  if edition_is_visible = false then
    new.is_live := false;
    new.racebook_is_live := false;
  end if;

  return new;
end;
$$;

create trigger enforce_race_event_edition_visibility
before insert or update of edition_id, is_live, racebook_is_live on public.races
for each row execute function public.enforce_race_event_edition_visibility();

revoke all on function public.enforce_race_event_edition_visibility() from public, anon, authenticated;

create or replace function public.sync_race_event_edition_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_visible is not distinct from old.is_visible then
    return new;
  end if;

  if new.is_visible then
    update public.races
    set is_live = true
    where edition_id = new.id
      and data_status = 'complete';
  else
    update public.races
    set is_live = false,
        racebook_is_live = false
    where edition_id = new.id;
  end if;

  return new;
end;
$$;

create trigger sync_race_event_edition_visibility
after update of is_visible on public.race_event_editions
for each row execute function public.sync_race_event_edition_visibility();

revoke all on function public.sync_race_event_edition_visibility() from public, anon, authenticated;

create or replace function public.delete_race_event_edition(p_edition_id uuid)
returns table (
  deleted_edition_id uuid,
  next_edition_id uuid,
  next_edition_year smallint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  edition_row public.race_event_editions;
  replacement_row public.race_event_editions;
begin
  select *
  into edition_row
  from public.race_event_editions
  where id = p_edition_id;

  if edition_row.id is null then
    raise exception 'Edition not found.';
  end if;

  perform 1
  from public.race_events
  where id = edition_row.event_id
  for update;

  select *
  into edition_row
  from public.race_event_editions
  where id = p_edition_id
  for update;

  if edition_row.id is null then
    raise exception 'Edition not found.';
  end if;

  if (
    select count(*)
    from public.race_event_editions
    where event_id = edition_row.event_id
  ) <= 1 then
    raise exception 'The only edition cannot be deleted.';
  end if;

  select *
  into replacement_row
  from public.race_event_editions
  where event_id = edition_row.event_id
    and id <> edition_row.id
  order by start_date desc, created_at desc
  limit 1;

  delete from public.race_event_editions
  where id = edition_row.id;

  if edition_row.is_current then
    update public.race_event_editions
    set is_current = true
    where id = replacement_row.id;
  end if;

  return query
  select edition_row.id, replacement_row.id, replacement_row.edition_year;
end;
$$;

revoke all on function public.delete_race_event_edition(uuid) from public, anon, authenticated;
grant execute on function public.delete_race_event_edition(uuid) to service_role;
