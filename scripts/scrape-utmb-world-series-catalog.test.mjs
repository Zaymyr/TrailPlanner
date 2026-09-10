import test from "node:test";
import assert from "node:assert/strict";

import { buildUtmbMigrationSql, extractNextData, normalizeUtmbCatalog, parseFrenchDate } from "./scrape-utmb-world-series-catalog.mjs";

const event = {
  tenant: "example",
  title: "Example by UTMB®",
  placeName: "Annecy",
  country: "France",
  url: "https://example.utmb.world",
};
const race = (overrides = {}) => ({
  id: 42,
  name: "Example by UTMB - Trail 50K",
  startDate: "12 septembre 2026",
  startLocation: "Annecy, France",
  slug: "https://example.utmb.world/races/50K",
  details: { statsUp: [{ name: "distance", value: 52 }, { name: "elevationGain", value: 2300 }] },
  ...overrides,
});

test("parses French official dates and embedded Next data", () => {
  assert.equal(parseFrenchDate("12 septembre 2026"), "2026-09-12");
  assert.deepEqual(extractNextData('<script id="__NEXT_DATA__" type="application/json">{"ok":true}</script>'), { ok: true });
});

test("deduplicates identical API races and repairs only unusable official URLs/locations", () => {
  const catalog = normalizeUtmbCatalog({
    events: [event],
    races: [race(), race({ id: 43, name: "EXAMPLE BY UTMB - TRAIL 50K" }), race({ id: 44, name: "Example Relay", startLocation: "undefined", slug: "https://example.utmb.world/races/undefined", details: { statsUp: [{ name: "distance", value: 80 }, { name: "elevationGain", value: 3000 }] } })],
    dateFrom: "2026-09-10",
    dateTo: "2027-12-31",
  });

  assert.equal(catalog.races.length, 2);
  const relay = catalog.races.find((item) => item.utmbRaceId === 44);
  assert.equal(relay.sourceUrl, "https://example.utmb.world/races");
  assert.equal(relay.location, "Annecy, France");
  assert.equal(relay.participationMode, "relay");
  assert.deepEqual(catalog.events[0], {
    tenant: "example", name: "Example by UTMB®", location: "Annecy, France",
    websiteUrl: "https://example.utmb.world", startDate: "2026-09-12", endDate: "2026-09-12", formatCount: 2,
  });
});

test("emits an idempotent migration with stable UTMB provenance", () => {
  const catalog = normalizeUtmbCatalog({ events: [event], races: [race()], dateFrom: "2026-09-10", dateTo: "2027-12-31" });
  const sql = buildUtmbMigrationSql(catalog, "2026-09-10");
  assert.match(sql, /utmbRaceId/);
  assert.match(sql, /utmbTenant/);
  assert.match(sql, /set is_current = false/);
  assert.match(sql, /temporary compatibility envelope/);
  assert.match(sql, /source_sibling\.source_url/);
  assert.match(sql, /utmbRaceId}' is null/);
  assert.match(sql, /on conflict \(event_id, edition_year\) do update/);
  assert.match(sql, /Expected % verified UTMB formats/);
});
