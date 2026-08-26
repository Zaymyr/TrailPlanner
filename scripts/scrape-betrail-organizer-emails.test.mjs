import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeRaceUrl,
  chooseEventDate,
  csvToRecords,
  extractEmailAddresses,
  normalizeExactEventDate,
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

test("normalizeExactEventDate accepts exact ISO, numeric, and French dates", () => {
  assert.equal(normalizeExactEventDate("2027-01-30T08:00:00+01:00", 2027), "2027-01-30");
  assert.equal(normalizeExactEventDate("30/01/2027", 2027), "2027-01-30");
  assert.equal(normalizeExactEventDate("30 janvier 2027", 2027), "2027-01-30");
  assert.equal(normalizeExactEventDate("janvier 2027", 2027), "");
  assert.equal(normalizeExactEventDate("30 janvier 2026", 2027), "");
});

test("chooseEventDate prefers an unambiguous structured date for the race edition", () => {
  assert.equal(
    chooseEventDate(
      {
        structured: ["2027-01-30T08:00:00+01:00"],
        attributes: ["2027-01-31"],
        visible: ["30 janvier 2027", "31 janvier 2027"],
      },
      "https://www.betrail.run/race/la.romagnatoise/2027",
    ),
    "2027-01-30",
  );
  assert.equal(
    chooseEventDate(
      { structured: [], attributes: [], visible: ["30 janvier 2027", "31 janvier 2027"] },
      "https://www.betrail.run/race/example/2027",
    ),
    "",
  );
});
