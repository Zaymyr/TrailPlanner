-- Add public product images for the focused Meltonic effort catalog.

with meltonic_product_images (slug, image_url) as (
  values
    (
      'meltonic-barre-pistaches-fleur-de-sel-22g',
      'https://www.meltonic.com/14513-large_default/barre-salee.jpg'
    ),
    (
      'meltonic-boisson-energetique-bio-citron-35g',
      'https://www.meltonic.com/2419-large_default/boisson-energetique-antioxydante.jpg'
    ),
    (
      'meltonic-boisson-energetique-bio-fruits-rouges-35g',
      'https://www.meltonic.com/2417-large_default/boisson-energetique-antioxydante.jpg'
    ),
    (
      'meltonic-boisson-energetique-bio-menthe-35g',
      'https://www.meltonic.com/15807-large_default/sachet-boisson-energetique-bio-menthe.jpg'
    ),
    (
      'meltonic-electrolytes-citron-pastille',
      'https://www.meltonic.com/17208-large_default/electrolytes-citron.jpg'
    ),
    (
      'meltonic-gel-antioxydant-miel-acerola-spiruline-20g',
      'https://www.meltonic.com/19149-large_default/gel-energetique-antioxydant.jpg'
    ),
    (
      'meltonic-gel-cafeine-200mg-miel-magnesium-guarana-40g',
      'https://www.meltonic.com/18221-large_default/gel-energetique-cafe-miel-gelee-royale.jpg'
    ),
    (
      'meltonic-gel-coup-de-boost-miel-magnesium-guarana-20g',
      'https://www.meltonic.com/19143-large_default/gel-energetique-coup-de-boost.jpg'
    ),
    (
      'meltonic-gel-coup-de-frais-miel-menthe-20g',
      'https://www.meltonic.com/19145-large_default/gel-energetique-coup-de-frais.jpg'
    ),
    (
      'meltonic-gel-endurance-miel-ginseng-20g',
      'https://www.meltonic.com/19135-large_default/gel-energetique-endurance.jpg'
    ),
    (
      'meltonic-gel-sale-miel-fleur-de-sel-20g',
      'https://www.meltonic.com/19155-large_default/gel-energetique-sale.jpg'
    ),
    (
      'meltonic-gel-ultra-endurance-miel-curcuma-20g',
      'https://www.meltonic.com/19138-large_default/gel-energetique-ultra-endurance.jpg'
    ),
    (
      'meltonic-puree-salee-amande-20g',
      'https://www.meltonic.com/15177-large_default/puree-salee-amande.jpg'
    ),
    (
      'meltonic-puree-salee-cacahuetes-20g',
      'https://www.meltonic.com/15191-large_default/stick-puree-salee-cacahuetes.jpg'
    ),
    (
      'meltonic-puree-salee-cajou-20g',
      'https://www.meltonic.com/15192-large_default/stick-puree-salee-cajou.jpg'
    )
)
update public.products
set image_url = meltonic_product_images.image_url
from meltonic_product_images
where public.products.slug = meltonic_product_images.slug
  and public.products.created_by is null
  and public.products.image_url is distinct from meltonic_product_images.image_url;
