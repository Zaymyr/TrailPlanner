alter table if exists public.coach_comments
  add column if not exists target_type text,
  add column if not exists target_id text;

update public.coach_comments
set target_type = case
  when aid_station_id is not null then 'aid-station'
  when section_id is not null then 'section'
  else 'plan'
end
where target_type is null;

update public.coach_comments
set target_id = case
  when aid_station_id is not null then aid_station_id
  when section_id is not null then section_id
  else 'plan'
end
where target_id is null;

alter table if exists public.coach_comments
  alter column target_type set default 'plan',
  alter column target_id set default 'plan';

alter table if exists public.coach_comments
  alter column target_type set not null,
  alter column target_id set not null;
