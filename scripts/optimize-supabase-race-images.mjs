import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const LIMIT = limitArgument ? Number(limitArgument.slice("--limit=".length)) : Number.POSITIVE_INFINITY;
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_EDGE_PX = 1024;
const CACHE_CONTROL = "max-age=31536000";
const PUBLIC_MARKER = "/storage/v1/object/public/race-images/";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

if (!(LIMIT > 0)) {
  throw new Error("--limit must be a positive number.");
}

const serviceHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

async function loadReferences(table) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id,thumbnail_url&thumbnail_url=not.is.null&order=id.asc`,
    { headers: serviceHeaders }
  );
  if (!response.ok) throw new Error(`Unable to load ${table} image references (${response.status}).`);
  return (await response.json()).map((row) => ({ table, id: row.id, url: row.thumbnail_url }));
}

const references = (await Promise.all([loadReferences("race_events"), loadReferences("races")]))
  .flat()
  .filter((reference) => typeof reference.url === "string" && reference.url.includes(PUBLIC_MARKER));

const referencesByUrl = new Map();
for (const reference of references) {
  const grouped = referencesByUrl.get(reference.url) ?? [];
  grouped.push(reference);
  referencesByUrl.set(reference.url, grouped);
}

const candidates = Array.from(referencesByUrl.entries())
  .filter(([url]) => !url.endsWith("-optimized.webp"))
  .slice(0, LIMIT);
const results = [];

for (const [sourceUrl, matchingReferences] of candidates) {
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) {
    results.push({ status: "download-failed", references: matchingReferences.length });
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
    results.push({ status: "invalid-image", references: matchingReferences.length });
    continue;
  }

  const oldPath = sourceUrl.slice(sourceUrl.indexOf(PUBLIC_MARKER) + PUBLIC_MARKER.length);
  const extensionIndex = oldPath.lastIndexOf(".");
  const basePath = extensionIndex > oldPath.lastIndexOf("/") ? oldPath.slice(0, extensionIndex) : oldPath;
  const optimizedPath = `${basePath}-optimized.webp`;
  const optimizedUrl = `${SUPABASE_URL}${PUBLIC_MARKER}${optimizedPath}`;

  if (!APPLY) {
    results.push({
      status: "would-optimize",
      references: matchingReferences.length,
      sourceBytes: source.byteLength,
      optimizedBytes: optimized.byteLength,
    });
    continue;
  }

  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/race-images/${optimizedPath}`, {
    method: "POST",
    headers: {
      ...serviceHeaders,
      "Content-Type": "image/webp",
      "cache-control": CACHE_CONTROL,
      "x-upsert": "true",
    },
    body: optimized,
  });
  if (!uploadResponse.ok) {
    results.push({ status: "upload-failed", references: matchingReferences.length });
    continue;
  }

  let updatedReferences = 0;
  let updateFailed = false;
  for (const reference of matchingReferences) {
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/${reference.table}?id=eq.${reference.id}&thumbnail_url=eq.${encodeURIComponent(sourceUrl)}`,
      {
        method: "PATCH",
        headers: {
          ...serviceHeaders,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ thumbnail_url: optimizedUrl }),
      }
    );
    if (!updateResponse.ok) {
      updateFailed = true;
      break;
    }
    updatedReferences += 1;
  }

  results.push({
    status: updateFailed ? "database-update-failed" : "optimized",
    references: matchingReferences.length,
    updatedReferences,
    sourceBytes: source.byteLength,
    optimizedBytes: optimized.byteLength,
  });
}

const totals = results.reduce(
  (summary, result) => {
    summary[result.status] = (summary[result.status] ?? 0) + 1;
    summary.references += result.references ?? 0;
    summary.updatedReferences += result.updatedReferences ?? 0;
    summary.sourceBytes += result.sourceBytes ?? 0;
    summary.optimizedBytes += result.optimizedBytes ?? 0;
    return summary;
  },
  { references: 0, updatedReferences: 0, sourceBytes: 0, optimizedBytes: 0 }
);

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  referencedUrls: referencesByUrl.size,
  candidates: candidates.length,
  totals,
}, null, 2));

if (results.some((result) => result.status.endsWith("failed"))) process.exitCode = 1;
