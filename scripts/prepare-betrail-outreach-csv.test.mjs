import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCsvTable,
  prepareOutreachRows,
  repairShiftedDateEnrichment,
  serializeCsvTable,
} from "./prepare-betrail-outreach-csv.mjs";

test("parseCsvTable and serializeCsvTable preserve commas, quotes, and newlines", () => {
  const csv = '"name","description"\n"Trail, test","Line 1\nLine ""2"""\n';
  const table = parseCsvTable(csv);

  assert.deepEqual(table, {
    headers: ["name", "description"],
    rows: [{ name: "Trail, test", description: 'Line 1\nLine "2"' }],
  });
  assert.deepEqual(parseCsvTable(serializeCsvTable(table.headers, table.rows)), table);
});

test("repairShiftedDateEnrichment moves only date fields one row up", () => {
  const rows = [
    { email: "first@example.org", reply_flag: "1", event_date_verified: "" },
    { email: "second@example.org", reply_flag: "0", event_date_verified: "2027-03-21" },
  ];

  const repaired = repairShiftedDateEnrichment(rows);
  assert.equal(repaired[0].event_date_verified, "2027-03-21");
  assert.equal(repaired[0].reply_flag, "1");
  assert.equal(repaired[1].event_date_verified, "");
});

test("prepareOutreachRows selects safe, untouched prospects by event proximity", () => {
  const rows = [
    {
      email: "later@example.org",
      archived: "false",
      excluded: "false",
      "opted-out": "false",
      overloop_event_date_safe: "2027-02-01",
    },
    {
      email: "soon@example.org",
      archived: "false",
      excluded: "false",
      "opted-out": "false",
      overloop_event_date_safe: "2027-01-10",
    },
    {
      email: "replied@example.org",
      archived: "false",
      excluded: "false",
      "opted-out": "false",
      replied_at: "2026-08-01 10:00:00 UTC",
      overloop_event_date_safe: "2027-01-15",
    },
  ];

  const prepared = prepareOutreachRows(rows, {
    asOf: "2026-08-26",
    minDaysBefore: 90,
    maxDaysBefore: 180,
    dailyLimit: 1,
  });

  assert.equal(prepared[0].outreach_queue_rank, "2");
  assert.equal(prepared[0].outreach_selected_today, "false");
  assert.equal(prepared[1].outreach_queue_rank, "1");
  assert.equal(prepared[1].outreach_selected_today, "true");
  assert.match(prepared[2].outreach_block_reason, /replied/);
});
