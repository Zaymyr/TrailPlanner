import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_EDGE_PX = 1024;
const CACHE_CONTROL = "max-age=31536000";
const PUBLIC_MARKER = "/storage/v1/object/public/product-images/";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const serviceHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const productsResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/products?select=id,image_url&image_url=not.is.null&order=id.asc`,
  { headers: serviceHeaders }
);

if (!productsResponse.ok) {
  throw new Error(`Unable to load product image references (${productsResponse.status}).`);
}

const products = await productsResponse.json();
const candidates = products.filter(
  (product) => typeof product.image_url === "string" && product.image_url.includes(PUBLIC_MARKER)
);

const results = [];

for (const product of candidates) {
  if (product.image_url.endsWith("-optimized.webp")) {
    results.push({ id: product.id, status: "already-migrated" });
    continue;
  }

  const sourceResponse = await fetch(product.image_url);
  if (!sourceResponse.ok) {
    results.push({ id: product.id, status: "download-failed", httpStatus: sourceResponse.status });
    continue;
  }

  const source = Buffer.from(await sourceResponse.arrayBuffer());
  let optimized;
  try {
    optimized = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78, alphaQuality: 80, effort: 5, smartSubsample: true })
      .toBuffer();
  } catch {
    results.push({ id: product.id, status: "invalid-image" });
    continue;
  }

  const oldPath = product.image_url.slice(product.image_url.indexOf(PUBLIC_MARKER) + PUBLIC_MARKER.length);
  const extensionIndex = oldPath.lastIndexOf(".");
  const basePath = extensionIndex > oldPath.lastIndexOf("/") ? oldPath.slice(0, extensionIndex) : oldPath;
  const optimizedPath = `${basePath}-optimized.webp`;
  const optimizedUrl = `${SUPABASE_URL}${PUBLIC_MARKER}${optimizedPath}`;

  if (!APPLY) {
    results.push({
      id: product.id,
      status: "would-optimize",
      sourceBytes: source.byteLength,
      optimizedBytes: optimized.byteLength,
    });
    continue;
  }

  const uploadResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/product-images/${optimizedPath}`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders,
        "Content-Type": "image/webp",
        "cache-control": CACHE_CONTROL,
        "x-upsert": "true",
      },
      body: optimized,
    }
  );

  if (!uploadResponse.ok) {
    results.push({ id: product.id, status: "upload-failed", httpStatus: uploadResponse.status });
    continue;
  }

  const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${product.id}`, {
    method: "PATCH",
    headers: {
      ...serviceHeaders,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ image_url: optimizedUrl }),
  });

  if (!updateResponse.ok) {
    results.push({ id: product.id, status: "database-update-failed", httpStatus: updateResponse.status });
    continue;
  }

  results.push({
    id: product.id,
    status: "optimized",
    sourceBytes: source.byteLength,
    optimizedBytes: optimized.byteLength,
  });
}

const totals = results.reduce(
  (summary, result) => {
    summary[result.status] = (summary[result.status] ?? 0) + 1;
    summary.sourceBytes += result.sourceBytes ?? 0;
    summary.optimizedBytes += result.optimizedBytes ?? 0;
    return summary;
  },
  { sourceBytes: 0, optimizedBytes: 0 }
);

console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", candidates: candidates.length, totals }, null, 2));

if (results.some((result) => result.status.endsWith("failed"))) {
  process.exitCode = 1;
}
