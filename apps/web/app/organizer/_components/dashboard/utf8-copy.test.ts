import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const organizerFiles = [
  "app/organizer/_components/dashboard/aid-stations-editor.tsx",
  "app/organizer/_components/dashboard/event-format-editors.tsx",
  "app/organizer/_components/dashboard/shell.tsx",
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
    const end = source.lastIndexOf("\n    </div>\n  );");
    const websiteImportSection = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(websiteImportSection).toContain("Données trouvées");
    expect(websiteImportSection).toContain("À renseigner manuellement");
    expect(websiteImportSection).toContain("GPX manquant");
    expect(websiteImportSection).toContain("Formats regroupés par distance");
    expect(websiteImportSection).toContain("Date détectée");
    forbiddenSequences.forEach((sequence) => {
      expect(websiteImportSection).not.toContain(sequence);
    });
  });

  it("keeps removed format actions out of the organizer UI", () => {
    const files = [
      "app/organizer/_components/OrganizerDashboard.tsx",
      "app/organizer/_components/dashboard/event-format-editors.tsx",
      "app/organizer/_components/dashboard/shell.tsx",
    ];
    const source = files.map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), "utf8")).join("\n");

    expect(source).not.toContain("Prévisualiser côté coureur");
    expect(source).not.toContain("Previsualiser ce format");
    expect(source).not.toContain("Masquer les details");
    expect(source).not.toContain("Dupliquer ce format");
    expect(source).toContain("Lieu différent de l&apos;événement");
  });
});
