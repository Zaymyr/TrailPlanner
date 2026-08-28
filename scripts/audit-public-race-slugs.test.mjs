import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDescriptiveSlug,
  buildSlugAudit,
  detectTechnicalSlug,
  fetchPublicRaceData,
  slugify,
} from "./audit-public-race-slugs.mjs";

test("slugify preserves readable French names without accents", () => {
  assert.equal(slugify("L'Échappée Belle — 42 km"), "l-echappee-belle-42-km");
  assert.equal(slugify("Trail du Cœur d'Alsace"), "trail-du-coeur-d-alsace");
});

test("buildDescriptiveSlug combines event and format but avoids duplicated event names", () => {
  assert.equal(
    buildDescriptiveSlug({ id: "race-1", event_name: "UTMB Mont-Blanc", name: "CCC", location: "Chamonix" }),
    "utmb-mont-blanc-ccc",
  );
  assert.equal(
    buildDescriptiveSlug({ id: "race-2", event_name: "Trail des Crêtes", name: "Trail des Crêtes 30 km" }),
    "trail-des-cretes-30-km",
  );
});

test("detectTechnicalSlug identifies importer, UUID suffix, and generic format slugs", () => {
  assert.deepEqual(detectTechnicalSlug("organizer-import-af2359c5", "La Cour'Eaunes"), [
    "technical_prefix",
    "generated_hex_suffix",
  ]);
  assert.deepEqual(detectTechnicalSlug("18km-x7q2", "18 km"), ["generic_format_slug", "short_generated_suffix"]);
  assert.deepEqual(detectTechnicalSlug("trail-des-templiers-80-km", "Trail des Templiers 80 km"), []);
});

test("audit proposes deterministic, unique slugs and reports the original base collision", () => {
  const data = {
    events: [{ id: "event-1", name: "Trail du Vercors", location: "Villard-de-Lans" }],
    races: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        event_id: "event-1",
        name: "42 km",
        slug: "organizer-import-af2359c5",
        distance_km: 42,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        event_id: "event-1",
        name: "42 km",
        slug: "42km-z9y8",
        distance_km: 42,
      },
    ],
  };

  const first = buildSlugAudit(data);
  const second = buildSlugAudit(data);
  assert.deepEqual(first, second);
  assert.deepEqual(first, buildSlugAudit({ ...data, races: [...data.races].reverse() }));
  assert.equal(first.dry_run, true);
  assert.equal(first.write_operations, 0);
  assert.match(first.application_note, /aucun slug/i);
  assert.equal(first.summary.technical_slugs, 2);
  assert.equal(first.summary.base_collisions, 2);
  assert.equal(first.summary.unresolved_proposal_collisions, 0);
  assert.equal(first.proposals[0].proposed_slug, "trail-du-vercors-trail-42-km-villard-de-lans");
  assert.equal(first.proposals[1].proposed_slug, "trail-du-vercors-trail-42-km-villard-de-lans-22222222");
  assert.equal(first.proposals[0].action, "review_rename");
});

test("audit keeps a healthy existing slug even when a cosmetic candidate differs", () => {
  const report = buildSlugAudit({
    races: [{ id: "race-1", name: "Marathon du Mont-Blanc", slug: "marathon-du-mont-blanc", location: "Chamonix" }],
  });
  assert.equal(report.proposals[0].action, "keep");
});

test("Supabase reader uses GET only and excludes races attached to a non-live parent", async (context) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options?.method });
    if (String(url).includes("/race_events?")) {
      return new Response(JSON.stringify([{ id: "live-event", name: "Trail live", location: "Annecy" }]));
    }
    return new Response(
      JSON.stringify([
        { id: "standalone", event_id: null, slug: "trail-libre", name: "Trail libre" },
        { id: "visible", event_id: "live-event", slug: "trail-live", name: "Trail live" },
        { id: "hidden-parent", event_id: "draft-event", slug: "trail-cache", name: "Trail cache" },
      ]),
    );
  };

  const data = await fetchPublicRaceData({ supabaseUrl: "https://example.supabase.co", anonKey: "anon-test" });
  assert.deepEqual(data.races.map((race) => race.id), ["standalone", "visible"]);
  assert.ok(calls.every((call) => call.method === "GET"));
});

test("Supabase reader refuses elevated keys before any request", async () => {
  const servicePayload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  await assert.rejects(
    () => fetchPublicRaceData({ supabaseUrl: "https://example.supabase.co", anonKey: `header.${servicePayload}.sig` }),
    /service_role/,
  );
  await assert.rejects(
    () => fetchPublicRaceData({ supabaseUrl: "https://example.supabase.co", anonKey: "sb_secret_example" }),
    /service_role/,
  );
});
