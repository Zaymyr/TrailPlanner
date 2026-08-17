import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeRaceUrl,
  csvToRecords,
  extractEmailAddresses,
  recordsToCsv,
} from "./scrape-betrail-organizer-emails.mjs";

test("extractEmailAddresses normalizes and deduplicates public addresses", () => {
  assert.deepEqual(
    extractEmailAddresses("Contact: Course@Example.org, course@example.org; aide [at] club [dot] fr"),
    ["course@example.org", "aide@club.fr"],
  );
});

test("recordsToCsv quotes commas and double quotes", () => {
  const csv = recordsToCsv([
    {
      raceName: 'Trail du "Lac", 10 km',
      date: "2026-09-01",
      organizer: "Club local",
      emails: ["contact@example.org"],
      raceUrl: "https://www.betrail.run/race/example/2026/10km",
      status: "email_found",
    },
  ]);

  assert.match(csv, /"Trail du ""Lac"", 10 km"/);
  assert.match(csv, /"contact@example.org"/);
  assert.deepEqual(csvToRecords(csv), [
    {
      raceName: 'Trail du "Lac", 10 km',
      date: "2026-09-01",
      organizer: "Club local",
      emails: ["contact@example.org"],
      raceUrl: "https://www.betrail.run/race/example/2026/10km",
      status: "email_found",
    },
  ]);
});

test("canonicalizeRaceUrl removes query strings, fragments, and trailing slashes", () => {
  assert.equal(
    canonicalizeRaceUrl("https://www.betrail.run/race/example/2026/?source=calendar#contact"),
    "https://www.betrail.run/race/example/2026",
  );
});
