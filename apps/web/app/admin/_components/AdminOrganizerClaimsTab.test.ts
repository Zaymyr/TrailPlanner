import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Admin Organizer purchases", () => {
  it("uses the purchase workflow and no longer renders an admin RaceBook toggle", () => {
    const source = readFileSync(resolve(process.cwd(), "app/admin/_components/AdminOrganizerClaimsTab.tsx"), "utf8");
    expect(source).toContain("Enregistrer un achat");
    expect(source).toContain("Montant HT");
    expect(source).toContain("Total TTC");
    expect(source).toContain("Facture PDF facultative");
    expect(source).not.toContain("<LiveToggle");
    expect(source).not.toContain('action: "setRacebookVisibility"');
  });
});
