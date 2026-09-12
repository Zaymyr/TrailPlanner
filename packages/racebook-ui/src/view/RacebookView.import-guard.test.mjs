import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mobileScreenUrl = new URL(
  "../../../../apps/mobile/app/(app)/race/[id]/racebook.tsx",
  import.meta.url,
);

test("the mobile RaceBook keeps the shared renderer wired", () => {
  const source = readFileSync(mobileScreenUrl, "utf8");

  assert.match(
    source,
    /import\s*\{[^}]*RacebookView[^}]*\}\s*from\s*['"]@pace-yourself\/racebook-ui['"]/s,
  );
  assert.match(source, /<RacebookView\b/);
  assert.doesNotMatch(source, /SHARED_RACEBOOK_MOBILE_VIEW_ENABLED/);
  assert.doesNotMatch(
    source,
    /function\s+(SponsorBanner|SponsorChip|FeaturedSponsor|AidStationCard|RacebookLoadingScreen)\b/,
  );
});
