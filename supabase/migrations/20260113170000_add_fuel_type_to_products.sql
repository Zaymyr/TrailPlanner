do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'fuel_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.fuel_type as enum (
      'gel',
      'drink_mix',
      'electrolyte',
      'capsule',
      'bar',
      'real_food',
      'other'
    );
  end if;
end $$;

alter table if exists public.products
  add column if not exists fuel_type public.fuel_type not null default 'other';

create index if not exists products_fuel_type_idx on public.products(fuel_type);
