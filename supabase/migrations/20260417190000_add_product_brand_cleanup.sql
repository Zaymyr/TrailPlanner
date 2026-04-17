alter table public.products
  add column if not exists brand text;

comment on column public.products.brand is
  'Canonical brand label used to group nutrition products consistently across imports and clients.';

create index if not exists products_brand_idx
  on public.products (lower(brand))
  where brand is not null and brand <> '';

create or replace function public.normalize_product_brand(raw_brand text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  if raw_brand is null then
    return null;
  end if;

  cleaned := lower(trim(raw_brand));
  cleaned := replace(cleaned, chr(8217), '''');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '(^[^[:alnum:]]+|[^[:alnum:]]+$)', '', 'g');

  if cleaned = '' then
    return null;
  end if;

  case
    when cleaned in ('maurten') or cleaned like 'maurten %' then return 'Maurten';
    when cleaned in ('gu', 'gu energy', 'gu energy labs') or cleaned like 'gu %' then return 'GU';
    when cleaned in ('sis', 'science in sport', 'science-in-sport') or cleaned like 'sis %' or cleaned like 'science in sport %' then return 'SiS';
    when cleaned in ('naak') or cleaned like 'naak %' then return 'NAAK';
    when cleaned in ('precision fuel & hydration', 'precision fuel and hydration', 'precision fuel', 'precision hydration', 'pf&h', 'pfh')
      or cleaned like 'precision fuel & hydration %'
      or cleaned like 'precision fuel and hydration %'
      or cleaned like 'precision fuel %'
      or cleaned like 'precision hydration %'
      then return 'Precision Fuel & Hydration';
    when cleaned in ('tailwind', 'tailwind nutrition') or cleaned like 'tailwind %' then return 'Tailwind';
    when cleaned in ('neversecond') or cleaned like 'neversecond %' then return 'Neversecond';
    when cleaned in ('overstims', 'overstim.s') or cleaned like 'overstims %' or cleaned like 'overstim.s %' then return 'Overstims';
    when cleaned in ('powerbar') or cleaned like 'powerbar %' then return 'Powerbar';
    when cleaned in ('clif', 'clif bar') or cleaned like 'clif %' then return 'Clif';
    when cleaned in ('high5') or cleaned like 'high5 %' then return 'HIGH5';
    when cleaned in ('aptonia') or cleaned like 'aptonia %' then return 'Aptonia';
    when cleaned in ('huma', 'huma chia') or cleaned like 'huma %' then return 'Huma';
    when cleaned in ('226ers') or cleaned like '226ers %' then return '226ERS';
    when cleaned in ('skratch', 'skratch labs') or cleaned like 'skratch %' then return 'Skratch Labs';
    when cleaned in ('saltstick') or cleaned like 'saltstick %' then return 'SaltStick';
    else null;
  end case;

  if cleaned = any (
    array[
      'gel',
      'gels',
      'energy gel',
      'bar',
      'bars',
      'drink',
      'drink mix',
      'drink mixes',
      'mix',
      'mixes',
      'boisson',
      'boissons',
      'electrolyte',
      'electrolytes',
      'electrolytes mix',
      'capsule',
      'capsules',
      'chew',
      'chews',
      'food',
      'decathlon',
      'nutrition',
      'sport nutrition',
      'sports nutrition',
      'energy',
      'fuel',
      'hydration',
      'product',
      'products',
      'autre',
      'other',
      'unknown',
      'sample',
      'samples',
      'test',
      'tests',
      'demo',
      'example'
    ]
  ) then
    return null;
  end if;

  return initcap(cleaned);
end;
$$;

create or replace function public.infer_product_brand(raw_name text, raw_slug text default null)
returns text
language plpgsql
immutable
as $$
declare
  source_name text;
  cleaned_slug text;
  first_token text;
begin
  source_name := trim(coalesce(nullif(split_part(coalesce(raw_name, ''), ' - ', 1), ''), raw_name, ''));
  source_name := regexp_replace(source_name, '\s+', ' ', 'g');

  if source_name <> '' then
    first_token := public.normalize_product_brand(source_name);
    if first_token is not null then
      return first_token;
    end if;
  end if;

  cleaned_slug := lower(trim(coalesce(raw_slug, '')));

  case
    when cleaned_slug like 'maurten-%' then return 'Maurten';
    when cleaned_slug like 'gu-%' then return 'GU';
    when cleaned_slug like 'sis-%' or cleaned_slug like 'science-in-sport-%' then return 'SiS';
    when cleaned_slug like 'naak-%' then return 'NAAK';
    when cleaned_slug like 'precision-fuel-%' or cleaned_slug like 'precision-hydration-%' then return 'Precision Fuel & Hydration';
    when cleaned_slug like 'tailwind-%' then return 'Tailwind';
    when cleaned_slug like 'neversecond-%' then return 'Neversecond';
    when cleaned_slug like 'overstims-%' or cleaned_slug like 'overstim-s-%' then return 'Overstims';
    when cleaned_slug like 'powerbar-%' then return 'Powerbar';
    when cleaned_slug like 'clif-%' then return 'Clif';
    when cleaned_slug like 'high5-%' then return 'HIGH5';
    when cleaned_slug like 'aptonia-%' then return 'Aptonia';
    when cleaned_slug like 'huma-%' then return 'Huma';
    when cleaned_slug like '226ers-%' then return '226ERS';
    when cleaned_slug like 'skratch-%' then return 'Skratch Labs';
    when cleaned_slug like 'saltstick-%' then return 'SaltStick';
    else null;
  end case;

  first_token := split_part(source_name, ' ', 1);
  return public.normalize_product_brand(first_token);
end;
$$;

create or replace function public.set_product_brand()
returns trigger
language plpgsql
as $$
begin
  new.brand := public.normalize_product_brand(
    coalesce(
      nullif(new.brand, ''),
      public.infer_product_brand(new.name, new.slug)
    )
  );
  return new;
end;
$$;

drop trigger if exists set_product_brand on public.products;
create trigger set_product_brand
before insert or update of brand, name, slug on public.products
for each row
execute function public.set_product_brand();

update public.products
set brand = public.normalize_product_brand(
  coalesce(
    nullif(brand, ''),
    public.infer_product_brand(name, slug)
  )
)
where brand is distinct from public.normalize_product_brand(
  coalesce(
    nullif(brand, ''),
    public.infer_product_brand(name, slug)
  )
);

update public.products
set
  is_live = false,
  is_archived = true,
  brand = null
where created_by is null
  and (
    slug ~* '^(test|sample|demo|example)(-|$)'
    or name ~* '^(test|sample|demo|example)( |$)'
  );

drop view if exists public.product_brand_review;
create view public.product_brand_review as
select
  id,
  slug,
  sku,
  name,
  brand,
  fuel_type,
  created_by,
  is_live,
  is_archived,
  updated_at
from public.products
where created_by is null
  and is_archived = false
  and brand is null
order by updated_at desc, name asc;
