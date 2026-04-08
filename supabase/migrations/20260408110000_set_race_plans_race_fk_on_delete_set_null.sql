alter table public.race_plans
  drop constraint if exists race_plans_race_id_fkey;

alter table public.race_plans
  add constraint race_plans_race_id_fkey
  foreign key (race_id) references public.races(id) on delete set null;
