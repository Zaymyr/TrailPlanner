import test from "node:test";
import assert from "node:assert/strict";

import { buildFormatQueue, parseFormatText } from "./build-format-import-queue.mjs";

test("parses multiple formats while tolerating trailing labels", () => {
  assert.deepEqual(parseFormatText("50km/2300 D+; 15 km / 550 D+ / 80% Off.").map((format) => ({
    name: format.formatName,
    distance: format.distanceKm,
    gain: format.elevationGainM,
  })), [
    { name: "50km", distance: 50, gain: 2300 },
    { name: "15 km", distance: 15, gain: 550 },
  ]);
});

test("creates one queue row per format and does not trust extrapolated dates", () => {
  const rows = buildFormatQueue([
    {
      uuid: "prospect-1",
      "Organization name": "Trail des Tests",
      "Organization website": "https://betrail.example/race/trail-des-tests/2027",
      official_website: "https://trail.example/",
      formats_raw: "30km/1200 D+; 12km/300 D+",
      "Organization city": "Lyon",
      "Organization country": "France",
      outreach_planning_date: "12/04/2027",
      event_date_basis: "édition 2026 extrapolée",
    },
  ], { asOf: "2026-09-06" });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].candidate_event_date, "");
  assert.equal(rows[0].priority_date, "2027-04-12");
  assert.equal(rows[0].candidate_mandatory_complete, "FALSE");
  assert.equal(rows[0].coverage_pct, "80");
  assert.equal(rows[0].research_status, "needs_enrichment");
  assert.match(rows[0].missing_fields, /race_date/);
});

test("accepts an exact date and marks the row for review rather than auto-import", () => {
  const [row] = buildFormatQueue([{
    uuid: "prospect-2",
    race_name: "Course exacte",
    race_url: "https://betrail.example/race/course-exacte/2027",
    official_website: "https://course.example/",
    formats_raw: "42km/1800 D+",
    city: "Annecy",
    country: "France",
    date: "2027-06-20",
    event_date_basis: "date exacte",
  }]);

  assert.equal(row.candidate_event_date, "2027-06-20");
  assert.equal(row.candidate_mandatory_complete, "TRUE");
  assert.equal(row.research_status, "review_required");
  assert.equal(row.ready_to_import, "FALSE");
});

test("filters out races scheduled before the campaign minimum date", () => {
  const rows = buildFormatQueue([
    { race_name: "Trop proche", race_url: "https://betrail.example/race/early/2026", formats_raw: "20km/500 D+", city: "Lyon", country: "France", date: "2026-09-20", event_date_basis: "date exacte" },
    { race_name: "Dans trois semaines", race_url: "https://betrail.example/race/target/2026", formats_raw: "20km/500 D+", city: "Lyon", country: "France", date: "2026-09-27", event_date_basis: "date exacte" },
  ], { asOf: "2026-09-06", minDaysBefore: 21 });
  assert.deepEqual(rows.map((row) => row.event_name), ["Dans trois semaines"]);
});

test("bounds a cross-year campaign with explicit inclusive dates", () => {
  const excluded = [];
  const rows = buildFormatQueue([
    { race_name: "Octobre", race_url: "https://betrail.example/race/octobre/2026", formats_raw: "20km", date: "2026-10-31", event_date_basis: "date exacte" },
    { race_name: "Novembre", race_url: "https://betrail.example/race/novembre/2026", formats_raw: "20km", date: "2026-11-01", event_date_basis: "date exacte" },
    { race_name: "Février", race_url: "https://betrail.example/race/fevrier/2027", formats_raw: "20km", date: "2027-02-28", event_date_basis: "date exacte" },
    { race_name: "Mars", race_url: "https://betrail.example/race/mars/2027", formats_raw: "20km", date: "2027-03-01", event_date_basis: "date exacte" },
  ], { asOf: "2026-09-08", dateFrom: "2026-11-01", dateTo: "2027-02-28", onExcluded: row => excluded.push(row) });
  assert.deepEqual(rows.map(row => row.event_name), ["Novembre", "Février"]);
  assert.equal(rows[0].min_event_date, "2026-11-01");
  assert.equal(rows[0].max_event_date, "2027-02-28");
  assert.deepEqual(excluded.map(row => row.reason).sort(), ["after_campaign_window", "before_campaign_window"]);
  assert.throws(() => buildFormatQueue([], { dateFrom: "2027-03-01", dateTo: "2027-02-28" }), /invalides/);
});

test("spreads a limited batch across events", () => {
  const rows = buildFormatQueue([
    { race_name: "Multi", race_url: "https://betrail.example/race/multi/2026", formats_raw: "30km/1200 D+; 15km/500 D+", city: "Lyon", country: "France", date: "2026-09-27", event_date_basis: "date exacte" },
    { race_name: "Single", race_url: "https://betrail.example/race/single/2026", formats_raw: "20km/500 D+", city: "Lyon", country: "France", date: "2026-09-27", event_date_basis: "date exacte" },
  ], { asOf: "2026-09-06", minDaysBefore: 21, limit: 2 });
  assert.deepEqual(rows.map((row) => row.event_name), ["Multi", "Single"]);
});

test("paginates every format exactly once, including offset without limit", () => {
  const source = Array.from({length:4},(_,i)=>({race_name:`Course ${i}`,race_url:`https://www.betrail.run/race/test-${i}/2025`,formats_raw:"30km/1200 D+;15km/500 D+",date:"2027-06-20",event_date_basis:"date exacte"}));
  const all = buildFormatQueue(source,{asOf:"2027-01-01"});
  const pages = [0,3,6].flatMap(offset=>buildFormatQueue(source,{asOf:"2027-01-01",offset,limit:3}));
  assert.deepEqual(pages.map(r=>r.format_key),all.map(r=>r.format_key));
  assert.equal(new Set(pages.map(r=>r.format_key)).size,8);
  assert.deepEqual(buildFormatQueue(source,{asOf:"2027-01-01",offset:3}),all.slice(3));
});

test("accepts spreadsheet planning dates without asserting an exact race date", () => {
  const [row] = buildFormatQueue([{race_name:"SausseTrail",race_url:"https://www.betrail.run/race/sausse/2025",formats_raw:"20km/500 D+",outreach_planning_date:"46369",event_date_basis:"édition 2025 extrapolée"}],{asOf:"2026-09-06",minDaysBefore:21});
  assert.equal(row.priority_date,"2026-12-13");
  assert.equal(row.target_edition_year,"2026");
  assert.equal(row.candidate_event_date,"");
});

test("reports exclusions and rejects invalid pagination", () => {
  const excluded=[];
  assert.equal(buildFormatQueue([{race_name:"No date",race_url:"https://example.test/",formats_raw:"20km"}],{asOf:"2026-09-06",minDaysBefore:21,onExcluded:r=>excluded.push(r)}).length,0);
  assert.equal(excluded[0].reason,"missing_planning_date");
  assert.throws(()=>buildFormatQueue([],{offset:-1}),/invalides/);
  assert.throws(()=>buildFormatQueue([],{asOf:"2026-02-30"}),/invalides/);
});
