#!/usr/bin/env node
// Calls POST /api/admin/race-catalog/betrail-import for every enriched row in a
// BeTrail scraper CSV, turning official_website/formats_raw into draft catalog
// rows for manual review. Requires an already-running Pace Yourself web app
// and an admin Supabase access token; performs no scraping itself.
import { readFile } from "node:fs/promises";

import { csvToRecords } from "./scrape-betrail-organizer-emails.mjs";

const parseArgs = (argv) => {
  const args = { input: null, baseUrl: process.env.ADMIN_API_BASE_URL || null, token: process.env.ADMIN_ACCESS_TOKEN || null, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--input") { args.input = next; index += 1; continue; }
    if (arg === "--base-url") { args.baseUrl = next; index += 1; continue; }
    if (arg === "--token") { args.token = next; index += 1; continue; }
    if (arg === "--dry-run") { args.dryRun = true; continue; }
    throw new Error(`Option inconnue : ${arg}`);
  }
  if (!args.input) throw new Error("--input est requis (CSV produit par scrape-betrail-organizer-emails.mjs).");
  if (!args.dryRun && (!args.baseUrl || !args.token)) {
    throw new Error("--base-url et --token sont requis (ou ADMIN_API_BASE_URL / ADMIN_ACCESS_TOKEN), sauf en --dry-run.");
  }
  return args;
};

export const buildImportRequestBody = (record) => ({
  raceUrl: record.raceUrl,
  raceName: record.raceName,
  date: record.date || null,
  officialWebsite: record.officialWebsite || null,
  formats: (record.formats || []).filter((format) => format.distance && format.elevation),
  action: "import",
});

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const csv = await readFile(args.input, "utf8");
  const records = csvToRecords(csv).filter(
    (record) => record.officialWebsite && record.formats.length > 0,
  );

  console.error(`${records.length} course(s) avec site officiel et au moins un format.`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of records) {
    const body = buildImportRequestBody(record);
    if (args.dryRun) {
      console.error(`[dry-run] ${record.raceName} -> ${body.formats.length} format(s)`);
      continue;
    }

    try {
      const response = await fetch(`${args.baseUrl}/api/admin/race-catalog/betrail-import`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${args.token}` },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error(`  Echec ${record.raceName} : ${result.message || response.status}`);
        failed += 1;
        continue;
      }
      console.error(
        `  ${record.raceName} : ${result.createdRaces?.length || 0} format(s) cree(s), ${result.skippedFormats?.length || 0} deja present(s).`,
      );
      imported += result.createdRaces?.length || 0;
      skipped += result.skippedFormats?.length || 0;
    } catch (error) {
      console.error(`  Erreur reseau ${record.raceName} : ${error instanceof Error ? error.message : error}`);
      failed += 1;
    }
  }

  console.error(`Termine : ${imported} format(s) importe(s), ${skipped} deja present(s), ${failed} echec(s).`);
};

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
if (invokedPath === import.meta.url || process.argv[1]?.endsWith("import-betrail-catalog-drafts.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
