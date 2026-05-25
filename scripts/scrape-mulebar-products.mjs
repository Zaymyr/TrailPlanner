#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://mulebar.com";
const PRODUCTS_ENDPOINT = `${BASE_URL}/products.json`;
const USER_AGENT = "Pace Yourself Mulebar catalog scraper (maintainer-authorized; contact: hello@pace-yourself.com)";
const DEFAULT_DELAY_MS = 350;
const SHOPIFY_PAGE_SIZE = 250;
const SALT_TO_SODIUM_MG_PER_G = 1000 / 2.54;

const FUEL_TYPES = new Set(["gel", "drink_mix", "electrolyte", "capsule", "bar", "real_food", "other"]);

const parseArgs = (argv) => {
  const args = {
    delayMs: DEFAULT_DELAY_MS,
    limit: Number.POSITIVE_INFINITY,
    output: null,
    includeSkipped: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--output" || arg === "-o") {
      if (!next) throw new Error("--output requires a file path.");
      args.output = next;
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      if (!next) throw new Error("--limit requires a number.");
      args.limit = Number.parseInt(next, 10);
      if (!Number.isFinite(args.limit) || args.limit <= 0) throw new Error("--limit must be a positive number.");
      index += 1;
      continue;
    }

    if (arg === "--delay-ms") {
      if (!next) throw new Error("--delay-ms requires a number.");
      args.delayMs = Number.parseInt(next, 10);
      if (!Number.isFinite(args.delayMs) || args.delayMs < 0) throw new Error("--delay-ms must be zero or more.");
      index += 1;
      continue;
    }

    if (arg === "--no-skipped") {
      args.includeSkipped = false;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const printHelp = () => {
  console.log(`Usage:
  node scripts/scrape-mulebar-products.mjs [options]

Options:
  -o, --output <path>   Write JSON to a file instead of stdout.
      --limit <number>  Process only the first N Shopify products.
      --delay-ms <ms>   Delay between product page requests. Default: ${DEFAULT_DELAY_MS}.
      --no-skipped      Omit skipped product diagnostics from the JSON.
  -h, --help            Show this help.

Output:
  JSON object accepted by the admin product importer. Paste the whole object in the
  admin import textarea, or use its "products" array in API payloads.
`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithHeaders = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": USER_AGENT,
      accept: options.accept ?? "application/json,text/html;q=0.9,*/*;q=0.8",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response;
};

const fetchJson = async (url) => {
  const response = await fetchWithHeaders(url, { headers: { accept: "application/json" } });
  return response.json();
};

const fetchText = async (url) => {
  const response = await fetchWithHeaders(url, { headers: { accept: "text/html" } });
  return response.text();
};

const fetchShopifyProducts = async ({ limit, delayMs }) => {
  const products = [];
  let page = 1;

  while (products.length < limit) {
    const url = `${PRODUCTS_ENDPOINT}?limit=${SHOPIFY_PAGE_SIZE}&page=${page}`;
    const data = await fetchJson(url);
    const batch = Array.isArray(data.products) ? data.products : [];

    if (batch.length === 0) break;

    products.push(...batch);

    if (batch.length < SHOPIFY_PAGE_SIZE) break;

    page += 1;
    await sleep(delayMs);
  }

  return products.slice(0, limit);
};

const decodeHtml = (value) =>
  value.replace(/&(#(\d+)|#x([0-9a-f]+)|[a-z]+);/gi, (match, entity, decimal, hex) => {
    if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));

    const named = {
      amp: "&",
      apos: "'",
      agrave: "a",
      acirc: "a",
      ccedil: "c",
      egrave: "e",
      eacute: "e",
      ecirc: "e",
      euml: "e",
      euro: "EUR",
      gt: ">",
      icirc: "i",
      iuml: "i",
      laquo: '"',
      lt: "<",
      nbsp: " ",
      ndash: "-",
      ocirc: "o",
      ouml: "o",
      quot: '"',
      raquo: '"',
      rsquo: "'",
      ugrave: "u",
      ucirc: "u",
      uuml: "u",
    };

    return named[entity.toLowerCase()] ?? match;
  });

const stripTags = (value) =>
  decodeHtml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeWhitespace = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const ensureGramSpacing = (value) => normalizeWhitespace(value).replace(/(\d)\s*g\b/gi, "$1 g");

const capitalizeFirst = (value) => (value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : value);

const normalizeText = (value) =>
  stripTags(String(value ?? ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const slugify = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const parseNumber = (value) => {
  const match = String(value ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
};

const roundMetric = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) return undefined;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const roundInteger = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return undefined;
  return Math.round(value);
};

const extractMulebarFlavor = (title) => {
  const normalized = ensureGramSpacing(title);

  if (normalized.includes("/")) {
    return normalized.split("/").slice(1).join("/").trim();
  }

  const afterBrand = normalized.match(/Mulebar\s+(.*)$/i)?.[1]?.trim();
  return afterBrand ? capitalizeFirst(afterBrand) : normalized;
};

const harmonizeMulebarDisplayName = (title, fuelType) => {
  const flavor = extractMulebarFlavor(title);

  switch (fuelType) {
    case "gel":
      return `Gel ${flavor}`;
    case "bar":
      return `Barre ${flavor}`;
    case "real_food":
      return `Purée ${flavor}`;
    case "drink_mix":
      return `Boisson effort ${flavor}`;
    case "electrolyte":
      return `Hydratation ${flavor}`;
    default:
      return ensureGramSpacing(title);
  }
};

const inferFuelType = (product) => {
  const text = normalizeText(`${product.title} ${product.handle} ${(product.tags ?? []).join(" ")}`);

  if (/\bgel\b|gel_energetique|energetic-gel/.test(text)) return "gel";
  if (/hydratation|hydration|electrolyte/.test(text)) return "electrolyte";
  if (/boisson|drink|effort|poudre/.test(text)) return "drink_mix";
  if (/capsule|comprime|sel\b|salt\b/.test(text)) return "capsule";
  if (/compote|gateau|goteau|cake/.test(text)) return "real_food";
  if (/\bbarre\b|barre_energetique|energy bar/.test(text)) return "bar";

  return "other";
};

const shouldSkipProduct = (product, fuelType) => {
  const text = normalizeText(`${product.title} ${product.handle} ${(product.tags ?? []).join(" ")}`);

  if (/pack decouverte|\bboite\b|multi-parfums|accessoire|gourde|bidon|flask|fiole/.test(text)) {
    return "bundle_or_accessory";
  }

  if (/ecorecharge|ecorefill|recharge/.test(text)) {
    return "bulk_refill";
  }

  if (/boisson proteinee|whey|collagene|magnesium|acerola|complement alimentaire/.test(text)) {
    return "supplement_or_recovery";
  }

  if (!FUEL_TYPES.has(fuelType) || fuelType === "other") {
    return "not_a_race_fuel_type";
  }

  return null;
};

const chooseVariant = (product) => {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  return (
    variants.find((variant) => normalizeText(variant.title).match(/\b1\s*(barre|gel|compote|dose)/)) ??
    variants.find((variant) => normalizeText(variant.title) === "default title") ??
    variants[0] ??
    null
  );
};

const extractNutritionTable = (html) => {
  const table = html.match(/<table\b(?=[^>]*nutrition-table)[\s\S]*?<\/table>/i)?.[0];
  if (!table) return null;

  const nutrition = {};
  const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => stripTags(match[2]));
    if (cells.length < 2) continue;

    const label = normalizeText(cells[0]);
    const servingValue = parseNumber(cells[cells.length - 1]);
    if (servingValue === null) continue;

    if (label.includes("energie") && label.includes("kcal")) {
      nutrition.caloriesKcal = roundInteger(servingValue);
      continue;
    }

    if (label.includes("glucides")) {
      nutrition.carbsGrams = roundMetric(servingValue);
      continue;
    }

    if (label.includes("proteines") || label.includes("protein")) {
      nutrition.proteinGrams = roundMetric(servingValue);
      continue;
    }

    if ((label.includes("matieres grasses") || label === "lipides (g)" || label === "fat (g)") && !label.includes("dont")) {
      nutrition.fatGrams = roundMetric(servingValue);
      continue;
    }

    if (label.includes("sodium")) {
      nutrition.sodiumMg = roundInteger(servingValue);
      continue;
    }

    if (label === "sel (g)" || label === "salt (g)" || label.includes("sel ")) {
      nutrition.sodiumMg = roundInteger(servingValue * SALT_TO_SODIUM_MG_PER_G);
    }
  }

  return Object.keys(nutrition).length > 0 ? nutrition : null;
};

const extractJsonObjectsFromScripts = (html) => {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const objects = [];

  for (const script of scripts) {
    const content = decodeHtml(script[1]).trim();
    if (!content) continue;

    try {
      objects.push(JSON.parse(content));
    } catch {
      // Some storefront scripts are not strict JSON. The nutrition table remains the source of truth.
    }
  }

  return objects;
};

const findNutritionObject = (value) => {
  if (!value || typeof value !== "object") return null;

  if (String(value["@type"] ?? "").toLowerCase() === "nutritioninformation") return value;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNutritionObject(item);
      if (found) return found;
    }
    return null;
  }

  for (const item of Object.values(value)) {
    const found = findNutritionObject(item);
    if (found) return found;
  }

  return null;
};

const extractNutritionJsonLd = (html) => {
  const objects = extractJsonObjectsFromScripts(html);
  const nutritionInfo = findNutritionObject(objects);
  if (!nutritionInfo) return null;

  const servingSizeGrams = parseNumber(nutritionInfo.servingSize);
  const rawCalories = parseNumber(nutritionInfo.calories);
  const rawCarbs = parseNumber(nutritionInfo.carbohydrateContent);
  const rawProtein = parseNumber(nutritionInfo.proteinContent);
  const rawFat = parseNumber(nutritionInfo.fatContent);
  const rawSodium = parseNumber(nutritionInfo.sodiumContent);
  const looksPer100g = servingSizeGrams && servingSizeGrams < 100 && ((rawCalories ?? 0) > 250 || (rawCarbs ?? 0) > servingSizeGrams);
  const factor = looksPer100g ? servingSizeGrams / 100 : 1;

  return {
    caloriesKcal: roundInteger(rawCalories === null ? undefined : rawCalories * factor),
    carbsGrams: roundMetric(rawCarbs === null ? undefined : rawCarbs * factor),
    sodiumMg: roundInteger(rawSodium === null ? undefined : rawSodium * factor),
    proteinGrams: roundMetric(rawProtein === null ? undefined : rawProtein * factor),
    fatGrams: roundMetric(rawFat === null ? undefined : rawFat * factor),
    _note: looksPer100g ? "json_ld_scaled_from_100g" : "json_ld_used_as_serving",
  };
};

const buildProductRecord = ({ product, html }) => {
  const fuelType = inferFuelType(product);
  const skipReason = shouldSkipProduct(product, fuelType);
  if (skipReason) return { skipped: { title: product.title, handle: product.handle, reason: skipReason } };

  const tableNutrition = extractNutritionTable(html);
  const jsonLdNutrition = tableNutrition ? null : extractNutritionJsonLd(html);
  const nutrition = tableNutrition ?? jsonLdNutrition;

  if (!nutrition) {
    return { skipped: { title: product.title, handle: product.handle, reason: "nutrition_not_found" } };
  }

  const carbsGrams = nutrition.carbsGrams ?? 0;
  const sodiumMg = nutrition.sodiumMg ?? 0;
  if (carbsGrams <= 0 && sodiumMg <= 0) {
    return { skipped: { title: product.title, handle: product.handle, reason: "no_carbs_or_sodium" } };
  }

  const variant = chooseVariant(product);
  const imageUrl = Array.isArray(product.images) ? product.images[0]?.src : undefined;
  const productUrl = `${BASE_URL}/products/${product.handle}`;
  const skuSource = variant?.sku || product.handle || product.id;

  return {
    product: {
      name: harmonizeMulebarDisplayName(product.title, fuelType),
      officialName: ensureGramSpacing(product.title),
      brand: "Mulebar",
      slug: `mulebar-${slugify(product.handle || product.title)}`,
      sku: `MULEBAR-${slugify(skuSource).toUpperCase()}`,
      fuelType,
      caloriesKcal: nutrition.caloriesKcal ?? 0,
      carbsGrams,
      sodiumMg,
      proteinGrams: nutrition.proteinGrams ?? 0,
      fatGrams: nutrition.fatGrams ?? 0,
      productUrl,
      imageUrl,
      isLive: true,
    },
    review: {
      source: tableNutrition ? "nutrition_table" : jsonLdNutrition?._note ?? "json_ld",
      handle: product.handle,
      variant: variant?.title ?? null,
    },
  };
};

const scrape = async (args) => {
  const sourceProducts = await fetchShopifyProducts({ limit: args.limit, delayMs: args.delayMs });
  const products = [];
  const review = [];
  const skipped = [];

  for (const [index, product] of sourceProducts.entries()) {
    const productUrl = `${BASE_URL}/products/${product.handle}`;

    try {
      const html = await fetchText(productUrl);
      const result = buildProductRecord({ product, html });

      if (result.product) {
        products.push(result.product);
        review.push(result.review);
      } else if (result.skipped) {
        skipped.push(result.skipped);
      }
    } catch (error) {
      skipped.push({
        title: product.title,
        handle: product.handle,
        reason: "fetch_or_parse_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (index < sourceProducts.length - 1) await sleep(args.delayMs);
  }

  return {
    products,
    archiveSharedCatalog: false,
    _meta: {
      source: BASE_URL,
      sourceEndpoint: PRODUCTS_ENDPOINT,
      generatedAt: new Date().toISOString(),
      productCount: products.length,
      skippedCount: skipped.length,
      note: "Review values before import. Sodium is stored as sodium mg per unit; salt rows are converted with sodium = salt / 2.54.",
    },
    _review: review,
    ...(args.includeSkipped ? { _skipped: skipped } : {}),
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const payload = await scrape(args);
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  if (args.output) {
    const outputPath = path.resolve(process.cwd(), args.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json, "utf8");
    console.error(`Wrote ${payload.products.length} Mulebar products to ${outputPath}`);
    return;
  }

  process.stdout.write(json);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
