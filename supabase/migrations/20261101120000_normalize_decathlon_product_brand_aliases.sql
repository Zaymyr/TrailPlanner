create or replace function public.normalize_product_brand(raw_brand text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text;
begin
  if raw_brand is null then return null; end if;

  cleaned := lower(trim(raw_brand));
  cleaned := replace(cleaned, chr(8217), '''');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '(^[^[:alnum:]]+|[^[:alnum:]]+$)', '', 'g');
  if cleaned = '' then return null; end if;

  case
    when cleaned in ('décat', 'decat', 'decath', 'decathlon') or cleaned like 'decathlon %' then return 'Decathlon';
    when cleaned = 'maurten' or cleaned like 'maurten %' then return 'Maurten';
    when cleaned in ('gu', 'gu energy', 'gu energy labs') or cleaned like 'gu %' then return 'GU';
    when cleaned in ('sis', 'science in sport', 'science-in-sport') or cleaned like 'sis %' or cleaned like 'science in sport %' then return 'SiS';
    when cleaned = 'naak' or cleaned like 'naak %' then return 'NAAK';
    when cleaned in ('precision fuel & hydration', 'precision fuel and hydration', 'precision fuel', 'precision hydration', 'pf&h', 'pfh')
      or cleaned like 'precision fuel & hydration %' or cleaned like 'precision fuel and hydration %'
      or cleaned like 'precision fuel %' or cleaned like 'precision hydration %'
      then return 'Precision Fuel & Hydration';
    when cleaned in ('tailwind', 'tailwind nutrition') or cleaned like 'tailwind %' then return 'Tailwind';
    when cleaned = 'neversecond' or cleaned like 'neversecond %' then return 'Neversecond';
    when cleaned in ('overstims', 'overstim.s') or cleaned like 'overstims %' or cleaned like 'overstim.s %' then return 'Overstims';
    when cleaned = 'powerbar' or cleaned like 'powerbar %' then return 'Powerbar';
    when cleaned in ('clif', 'clif bar') or cleaned like 'clif %' then return 'Clif';
    when cleaned = 'high5' or cleaned like 'high5 %' then return 'HIGH5';
    when cleaned = 'aptonia' or cleaned like 'aptonia %' then return 'Aptonia';
    when cleaned in ('huma', 'huma chia') or cleaned like 'huma %' then return 'Huma';
    when cleaned = '226ers' or cleaned like '226ers %' then return '226ERS';
    when cleaned in ('skratch', 'skratch labs') or cleaned like 'skratch %' then return 'Skratch Labs';
    when cleaned = 'saltstick' or cleaned like 'saltstick %' then return 'SaltStick';
    else null;
  end case;

  if cleaned = any (array[
    'gel', 'gels', 'energy gel', 'bar', 'bars', 'drink', 'drink mix', 'drink mixes',
    'mix', 'mixes', 'boisson', 'boissons', 'electrolyte', 'electrolytes',
    'electrolytes mix', 'capsule', 'capsules', 'chew', 'chews', 'food',
    'nutrition', 'sport nutrition', 'sports nutrition', 'energy', 'fuel', 'hydration',
    'product', 'products', 'autre', 'other', 'unknown', 'sample', 'samples',
    'test', 'tests', 'demo', 'example'
  ]) then return null; end if;

  return initcap(cleaned);
end;
$$;

-- Curated catalog rows only. User products retain their original brand entry and
-- receive display-only capitalization safeguards in the mobile client.
update public.products
set brand = public.normalize_product_brand(brand)
where created_by is null
  and lower(trim(coalesce(brand, ''))) in ('décat', 'decat', 'decath', 'decathlon')
  and brand is distinct from 'Decathlon';
