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
    const start = source.indexOf("<Dialog\n        open={websiteImportOpen");
    const end = source.lastIndexOf("\n    </div>\n  );");
    const websiteImportSection = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(websiteImportSection).toContain("Découvrir les formats");
    expect(websiteImportSection).toContain("Confirmer les formats");
    expect(websiteImportSection).toContain("Appliquer les choix");
    expect(websiteImportSection).toContain("brouillons masqués");
    expect(websiteImportSection).toContain("URLs officielles supplémentaires");
    expect(websiteImportSection).toContain("Sources analysées");
    expect(websiteImportSection).toContain("information");
    expect(websiteImportSection).toContain("étayée");
    expect(websiteImportSection).toContain(
      "page événement, règlement, programme, logistique, inscription, archive ou format"
    );
    expect(source).toContain("additionalUrls,");
    expect(websiteImportSection).not.toContain("URLs de formats connues");
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

  it("keeps format and field evidence visible in the two-step review", () => {
    const absolutePath = resolve(process.cwd(), "app/organizer/_components/dashboard/website-import-review-details.tsx");
    const source = readFileSync(absolutePath, "utf8");

    expect(source).toContain("Preuves d’existence");
    expect(source).toContain("Étape 2 sur 2");
    expect(source).toContain("Conflit");
    expect(source).toContain("Preuve :");
    expect(source).toContain("Laisser ce champ manquant");
    expect(source).toContain("Les conflits ne sont jamais sélectionnés automatiquement");
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

  it("keeps the emergency contact labels readable in event information", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/event-format-editors.tsx"),
      "utf8"
    );

    expect(source).toContain('label="Contact d\'urgence"');
    expect(source).toContain('label="Numéro d\'urgence"');
    expect(source).toContain('type="tel"');
  });

  it("separates aid stations and relay points into local views", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/aid-stations-editor.tsx"),
      "utf8"
    );

    expect(source).toContain('{ id: "aidStations", label: "Ravitos" }');
    expect(source).toContain('{ id: "relay", label: "Relais" }');
    expect(source).toContain('activeView === "aidStations"');
    expect(source).toContain('title="Départ"');
    expect(source).toContain('title="Arrivée"');
    expect(source).toContain('StationMetaChip>Barrière {details.cutoffTime?.trim() || "-"}');
    expect(source).toContain('aria-label="Tronçons du relais"');
    expect(source).not.toContain('label="Passage prévu"');
    expect(source).not.toContain('label="Note de passage"');
    expect(source).not.toContain('" - Barrière à définir"');
  });

  it("keeps edition visibility and year-confirmed deletion in the organizer header", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/shell.tsx"),
      "utf8"
    );

    expect(source).toContain('liveLabel="Édition visible"');
    expect(source).toContain('draftLabel="Édition masquée"');
    expect(source).toContain("deleteEditionConfirmation !== selectedEditionYear");
    expect(source).toContain("Tape « {selectedEditionYear} » pour confirmer");
  });
});
