import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const organizerFiles = [
  "app/organizer/_components/dashboard/aid-stations-editor.tsx",
];

const forbiddenSequences = [
  "Ã",
  "�",
  "â€™",
  "â€œ",
  "â€",
  "â€“",
  "â€”",
];

describe("organizer dashboard UTF-8 copy", () => {
  it.each(organizerFiles)("keeps %s free from mojibake sequences", (relativePath) => {
    const absolutePath = resolve(process.cwd(), relativePath);
    const source = readFileSync(absolutePath, "utf8");

    forbiddenSequences.forEach((sequence) => {
      expect(source).not.toContain(sequence);
    });
  });

  it("keeps the website import review copy free from mojibake sequences", () => {
    const absolutePath = resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx");
    const source = readFileSync(absolutePath, "utf8");
    const start = source.indexOf("<Dialog open={websiteImportOpen}");
    const end = source.indexOf("<RunnerPreviewDialog", start);
    const websiteImportSection = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(websiteImportSection).toContain("Voir les informations fiables");
    expect(websiteImportSection).toContain("Date détectée");
    forbiddenSequences.forEach((sequence) => {
      expect(websiteImportSection).not.toContain(sequence);
    });
  });
});
