import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const organizerFiles = [
  "app/organizer/_components/dashboard/aid-stations-editor.tsx",
  "app/organizer/_components/dashboard/event-format-editors.tsx",
  "app/organizer/_components/dashboard/shell.tsx",
  "app/organizer/_components/dashboard/website-import-review-details.tsx",
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
    const source = readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");
    const start = source.indexOf("<Dialog open={websiteImportOpen");
    const end = source.lastIndexOf("\n    </div>\n  );");
    const websiteImportSection = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(websiteImportSection).toContain("Données trouvées");
    expect(websiteImportSection).toContain("À renseigner manuellement");
    expect(websiteImportSection).toContain("Récupéré");
    expect(websiteImportSection).toContain("Manquant");
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

  it("keeps document and assisted reconciliation evidence visible in the secondary review", () => {
    const absolutePath = resolve(process.cwd(), "app/organizer/_components/dashboard/website-import-review-details.tsx");
    const source = readFileSync(absolutePath, "utf8");

    expect(source).toContain("Documents analysés");
    expect(source).toContain("Rapprochement assisté");
    expect(source).toContain("Comparaison champ par champ");
    expect(source).toContain("Preuve :");
    expect(source).toContain("ne modifient aucune donnée automatiquement");
    expect(source).toContain("Champs à intégrer");
    expect(source).toContain("remplace automatiquement la précédente");
  });

  it("exposes one format name field and synchronizes both persisted names", () => {
    const absolutePath = resolve(process.cwd(), "app/organizer/_components/dashboard/event-format-editors.tsx");
    const source = readFileSync(absolutePath, "utf8");
    const dashboardSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"), "utf8");

    expect(source).toContain('label="Nom du format"');
    expect(source).toContain("name: value, seriesName: value");
    expect(source).not.toContain('label="Libelle format"');
    expect(dashboardSource).toContain("seriesName: mergedForm.name");
    expect(dashboardSource).toContain("seriesName: newRaceForm.name");
  });
});
