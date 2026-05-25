---
title: Mulebar Product Scraping
scope: integration
last_verified: 2026-05-25
ai_priority: medium
related_files:
  - scripts/scrape-mulebar-products.mjs
related_tables:
  - products
---

# Mulebar Product Scraping

## Purpose

`scripts/scrape-mulebar-products.mjs` builds a reviewable product JSON from the public Mulebar Shopify storefront after maintainer authorization. The JSON is designed for the existing admin product importer, not for direct database writes.

## Key Concepts

- The script reads the public Shopify `products.json` endpoint and then each product page.
- The nutrition table on the product page is the source of truth when available.
- JSON-LD nutrition is used only as a fallback because some storefront values are expressed per 100 g even when `servingSize` is present.
- Product output uses the app product unit model: calories, carbs, sodium, protein, and fat are per usable unit or serving.
- The scraper now emits both a harmonized display `name` and an `officialName` source label for official catalog imports.
- Sodium is stored as sodium in milligrams. If Mulebar exposes salt in grams, the script converts it with `sodium_mg = salt_g * 1000 / 2.54`.
- The script never inserts into Supabase. Paste the generated JSON into the admin import UI after review.

## Usage

Run a small sample first:

```bash
node scripts/scrape-mulebar-products.mjs --limit 5
```

Write the full review file:

```bash
node scripts/scrape-mulebar-products.mjs --output tmp/mulebar-products.json
```

`tmp/` is ignored by git; generated catalog snapshots are review artifacts, not source files.

Useful options:

- `--limit <number>` processes only the first N Shopify products.
- `--delay-ms <ms>` controls pacing between product page requests. The default is `350`.
- `--no-skipped` omits skipped diagnostics from the output JSON.

## Import Flow

1. Generate the JSON.
2. Review `_review` and `_skipped`.
3. Check a few products manually on Mulebar, especially sodium and serving size.
4. Paste the whole JSON object in the admin product importer. The importer accepts an object with `products`; extra `_meta`, `_review`, and `_skipped` keys are ignored by the UI schema.
5. Keep `archiveSharedCatalog` set to `false` unless the intent is to replace the whole shared catalog.

## Mapping

| Mulebar signal | Pace Yourself field |
| --- | --- |
| Harmonized Mulebar display name | `name` |
| Product title | `officialName` |
| `Mulebar` | `brand` |
| Shopify handle | `slug`, prefixed with `mulebar-` |
| First unit-like variant SKU | `sku`, prefixed with `MULEBAR-` |
| First Shopify image | `imageUrl` |
| Product page URL | `productUrl` |
| Nutrition table serving column | `caloriesKcal`, `carbsGrams`, `sodiumMg`, `proteinGrams`, `fatGrams` |
| Title, handle, and tags | `fuelType` |

## Gotchas

- Skip diagnostics are expected for bundles, discovery packs, bulk refills, accessories, recovery supplements, and products that are not race fuel.
- Shopify JSON alone does not contain reliable per-serving nutrition for all products; the product page must be fetched.
- Salt and sodium are different values. The database stores sodium, not salt.
- Energy cakes and drink powders can have package sizes larger than the serving. Verify that the serving column is the intended app unit before import.
- Keep `officialName` aligned with the exact storefront label. `name` is allowed to be shorter because Pace Yourself uses it as the harmonized in-app display label.
- Do not run the script in a tight loop. Keep a delay and use it only for authorized catalog refreshes.

## Related Docs

- [products Table](../02-database/tables/products.md)
- [Nutrition Algorithm](../03-business-rules/nutrition-algorithm.md)
