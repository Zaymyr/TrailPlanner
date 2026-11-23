-- Unpublish the two legacy Marathon du Mont-Blanc formats (founder decision, 2026-11-23).
--
-- "Marathon du Mont Blanc 90K" (marathon-du-mont-blanc-90k-lunr) and "42K"
-- (marathon-du-mont-blanc-qonc) come from the March 2026 catalogue import: no date, no
-- edition, duplicating the dated 2027 formats marathon-mont-blanc-90km-2027 and
-- marathon-mont-blanc-42km-2027. They stay in the table (one runner plan references the 42K,
-- and plan access also goes through the live parent event), but leave the public catalogue:
-- is_public = false makes sync_race_web_catalog_visibility clear web_catalog_is_live, and
-- enforce_race_catalog_completeness keeps them in draft because race_date is null.
-- Their public URLs redirect permanently to the 2027 formats (catalogSlugRedirects in
-- apps/web/next.config.mjs).

update public.races
set is_public = false,
    is_live = false
where id in (
  '5ee23eae-daa8-404a-a75d-3a9adc1788bd', -- marathon-du-mont-blanc-90k-lunr
  '0037b73c-b638-4fd9-80a9-34fdb3a4e97d'  -- marathon-du-mont-blanc-qonc
)
  and (is_public or is_live or web_catalog_is_live);
