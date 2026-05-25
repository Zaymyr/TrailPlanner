alter table public.products
  add column if not exists is_official boolean not null default false,
  add column if not exists official_name text;

comment on column public.products.is_official is
  'Explicit flag for Pace Yourself official/shared catalog products. Do not infer this from created_by being null.';

comment on column public.products.official_name is
  'Exact source label from the official brand site/import before Pace Yourself display-name harmonization.';

create index if not exists products_is_official_idx
  on public.products (is_official)
  where is_official = true;

update public.products
set is_official = true
where created_by is null
  and (
    lower(coalesce(brand, '')) in ('aptonia', 'baouw', 'maurten', 'mulebar', 'precision fuel & hydration')
    or slug like 'aptonia-%'
    or slug like 'baouw-%'
    or slug like 'maurten-%'
    or slug like 'mulebar-%'
    or slug like 'precision-fuel-%'
  )
  and is_official is distinct from true;

update public.products
set official_name = name
where is_official = true
  and (official_name is null or btrim(official_name) = '');

update public.products
set official_name = null
where is_official = false
  and official_name is not null;

update public.products
set name = case slug
  when 'aptonia-energy-gel-plus-32g' then 'Aptonia Energy Gel+ - 32 g'
  when 'baouw-gel-abricot-thym' then 'Gel Abricot / Thym'
  when 'baouw-gel-ananas-noix-de-coco' then 'Gel Ananas / Noix de Coco'
  when 'baouw-gel-banane-vanille' then 'Gel Banane / Vanille'
  when 'baouw-gel-citron-vert-menthe' then 'Gel Citron vert / Menthe'
  when 'baouw-gel-fruits-rouges-hibiscus' then 'Gel Fruits rouges / Hibiscus'
  when 'baouw-gel-peche-the-matcha' then 'Gel Pêche / Thé matcha'
  when 'baouw-drink_mix-citron-fleur-de-sureau-45g' then 'Boisson Citron / Fleur de sureau - 45 g'
  when 'baouw-drink_mix-menthe-melisse-45g' then 'Boisson Menthe / Mélisse - 45 g'
  when 'baouw-drink_mix-pasteque-grenade-45g' then 'Boisson Pastèque / Grenade - 45 g'
  when 'baouw-drink_mix-peche-romarin-45g' then 'Boisson Pêche / Romarin - 45 g'
  when 'baouw-electrolyte-citron-vert-menthe' then 'Pastilles Citron vert / Menthe'
  when 'baouw-electrolyte-mangue-ananas' then 'Pastilles Mangue / Ananas'
  when 'baouw-electrolyte-mure-cassis' then 'Pastilles Mûre / Cassis'
  when 'baouw-electrolyte-peche-passion' then 'Pastilles Pêche / Passion'
  when 'baouw-bar-banane-pecan' then 'Barre Banane / Pécan'
  when 'baouw-bar-chocolat-noisette' then 'Barre Chocolat / Noisette'
  when 'baouw-bar-crunchy-cacahuete' then 'Barre Crunchy / Cacahuète'
  when 'baouw-bar-framboise-pistache' then 'Barre Framboise / Pistache'
  when 'baouw-bar-mangue-cajou' then 'Barre Mangue / Cajou'
  when 'baouw-bar-vanille-macadamia' then 'Barre Vanille / Macadamia'
  when 'baouw-real_food-banane-kiwi-vanille' then 'Purée Banane / Kiwi / Vanille'
  when 'baouw-real_food-cari-de-legumes' then 'Purée Cari de légumes'
  when 'baouw-real_food-framboise-fraise-basilic' then 'Purée Framboise / Fraise / Basilic'
  when 'baouw-real_food-mangue-passion-gingembre' then 'Purée Mangue / Passion / Gingembre'
  when 'baouw-real_food-patate-douce-carotte-poivre-timut' then 'Purée Patate douce / Carotte / Poivre Timut'
  when 'baouw-real_food-poire-pomme-menthe' then 'Purée Poire / Pomme / Menthe'
  when 'maurten-gel-100' then 'Maurten Gel 100'
  when 'mulebar-gel-energetique-37g-sans-gluten-caramel-sale' then 'Gel Caramel salé'
  when 'mulebar-gel-energetique-vegan-et-sans-gluten-37g-cerise' then 'Gel Cerise'
  when 'mulebar-gel-energetique-vegan-et-sans-gluten-37g-citron' then 'Gel Citron gingembre guarana'
  when 'mulebar-gel-energetique-vegan-et-sans-gluten-37g-pomme' then 'Gel Pomme'
  when 'mulebar-gel-energetique-vegan-37g-cafe' then 'Gel Café'
  when 'mulebar-boisson-de-leffort-mulebar-agrumes-40g-dose-unitaire' then 'Boisson effort Agrumes'
  when 'mulebar-boisson-de-leffort-mulebar-fruits-rouges-40g-dose-unitaire' then 'Boisson effort Fruits rouges'
  when 'mulebar-boisson-d-hydratation-en-poudre-mulebar-agrumes-10g-dose-dessai' then 'Hydratation Agrumes'
  when 'mulebar-boisson-d-hydratation-en-poudre-mulebar-fruits-rouges-10g-dose-unitaire' then 'Hydratation Fruits rouges'
  when 'mulebar-barre-energetique-bio-vegan-40g-abricot-noix' then 'Barre Abricot Pécan'
  when 'mulebar-barre-energetique-vegan-40g-ananas-coco' then 'Barre Ananas Coco baies de Goji'
  when 'mulebar-barre-energetique-bio-vegan-40g-chocolat-orange' then 'Barre Chocolat Orange'
  when 'mulebar-barre-energetique-bio-vegan-40g-citron-gingembre' then 'Barre Citron Gingembre'
  when 'mulebar-barre-energetique-bio-vegan-40g-mangue-noix-de-cajou' then 'Barre Mangue Noix de cajou'
  when 'mulebar-barre-energetique-bio-vegan-40g-pomme-cannelle' then 'Barre Pomme Raisin Cannelle'
  when 'mulebar-barre-energetique-vegan-40g-cacahuete-framboise' then 'Barre Cacahuète Framboise'
  when 'mulebar-barre-energetique-vegan-40g-framboise-cassis-cranberry' then 'Barre Framboise Cassis Canneberge'
  when 'mulebar-barre-proteinee-vegan-40g-chocolat' then 'Barre Chocolat'
  when 'mulebar-compote-energetique-vegan-65g-ananas-coco' then 'Purée Ananas Coco'
  when 'mulebar-compote-energetique-bio-vegan-65g-abricot' then 'Purée Abricot'
  when 'mulebar-compote-energetique-vegan-65g-chataigne' then 'Purée Châtaigne'
  when 'mulebar-compote-energetique-vegan-65g-fraise-groseille-betterave' then 'Purée Fraise Groseille Betterave'
  when 'mulebar-puree-de-fruits-vegan-65g-orange-carotte-citron' then 'Purée Orange Carotte Citron'
  when 'mulebar-puree-de-fruits-vegan-65g-patate-douce-orange-carotte' then 'Purée Patate douce Orange Carotte'
  when 'mulebar-compote-energetique-bio-vegan-65g-banane' then 'Purée Banane'
  when 'precision-fuel-pf-30-gel' then 'PF 30 Gel'
  else name
end
where is_official = true
  and slug in (
    'aptonia-energy-gel-plus-32g',
    'baouw-gel-abricot-thym',
    'baouw-gel-ananas-noix-de-coco',
    'baouw-gel-banane-vanille',
    'baouw-gel-citron-vert-menthe',
    'baouw-gel-fruits-rouges-hibiscus',
    'baouw-gel-peche-the-matcha',
    'baouw-drink_mix-citron-fleur-de-sureau-45g',
    'baouw-drink_mix-menthe-melisse-45g',
    'baouw-drink_mix-pasteque-grenade-45g',
    'baouw-drink_mix-peche-romarin-45g',
    'baouw-electrolyte-citron-vert-menthe',
    'baouw-electrolyte-mangue-ananas',
    'baouw-electrolyte-mure-cassis',
    'baouw-electrolyte-peche-passion',
    'baouw-bar-banane-pecan',
    'baouw-bar-chocolat-noisette',
    'baouw-bar-crunchy-cacahuete',
    'baouw-bar-framboise-pistache',
    'baouw-bar-mangue-cajou',
    'baouw-bar-vanille-macadamia',
    'baouw-real_food-banane-kiwi-vanille',
    'baouw-real_food-cari-de-legumes',
    'baouw-real_food-framboise-fraise-basilic',
    'baouw-real_food-mangue-passion-gingembre',
    'baouw-real_food-patate-douce-carotte-poivre-timut',
    'baouw-real_food-poire-pomme-menthe',
    'maurten-gel-100',
    'mulebar-gel-energetique-37g-sans-gluten-caramel-sale',
    'mulebar-gel-energetique-vegan-et-sans-gluten-37g-cerise',
    'mulebar-gel-energetique-vegan-et-sans-gluten-37g-citron',
    'mulebar-gel-energetique-vegan-et-sans-gluten-37g-pomme',
    'mulebar-gel-energetique-vegan-37g-cafe',
    'mulebar-boisson-de-leffort-mulebar-agrumes-40g-dose-unitaire',
    'mulebar-boisson-de-leffort-mulebar-fruits-rouges-40g-dose-unitaire',
    'mulebar-boisson-d-hydratation-en-poudre-mulebar-agrumes-10g-dose-dessai',
    'mulebar-boisson-d-hydratation-en-poudre-mulebar-fruits-rouges-10g-dose-unitaire',
    'mulebar-barre-energetique-bio-vegan-40g-abricot-noix',
    'mulebar-barre-energetique-vegan-40g-ananas-coco',
    'mulebar-barre-energetique-bio-vegan-40g-chocolat-orange',
    'mulebar-barre-energetique-bio-vegan-40g-citron-gingembre',
    'mulebar-barre-energetique-bio-vegan-40g-mangue-noix-de-cajou',
    'mulebar-barre-energetique-bio-vegan-40g-pomme-cannelle',
    'mulebar-barre-energetique-vegan-40g-cacahuete-framboise',
    'mulebar-barre-energetique-vegan-40g-framboise-cassis-cranberry',
    'mulebar-barre-proteinee-vegan-40g-chocolat',
    'mulebar-compote-energetique-vegan-65g-ananas-coco',
    'mulebar-compote-energetique-bio-vegan-65g-abricot',
    'mulebar-compote-energetique-vegan-65g-chataigne',
    'mulebar-compote-energetique-vegan-65g-fraise-groseille-betterave',
    'mulebar-puree-de-fruits-vegan-65g-orange-carotte-citron',
    'mulebar-puree-de-fruits-vegan-65g-patate-douce-orange-carotte',
    'mulebar-compote-energetique-bio-vegan-65g-banane',
    'precision-fuel-pf-30-gel'
  );

drop view if exists public.product_brand_review;
create view public.product_brand_review as
select
  id,
  slug,
  sku,
  name,
  official_name,
  brand,
  fuel_type,
  created_by,
  is_official,
  is_live,
  is_archived,
  updated_at
from public.products
where is_official = true
  and is_archived = false
  and brand is null
order by updated_at desc, name asc;
