import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Admin Organizer publication grants", () => {
  it("lets admins select the grant origin and keeps bank-transfer details", () => {
    const source = readFileSync(resolve(process.cwd(), "app/admin/_components/AdminOrganizerClaimsTab.tsx"), "utf8");
    expect(source).toContain("Gérer le droit de publication");
    expect(source).toContain("Paiement Stripe");
    expect(source).toContain("Paiement par virement");
    expect(source).toContain("Offert");
    expect(source).toContain('action: "setEditionGrant"');
    expect(source).toContain("Montant HT");
    expect(source).toContain("Total TTC");
    expect(source).toContain("Facture PDF facultative");
    expect(source).toContain("Pack actuellement actif");
    expect(source).toContain('role="alert"');
    expect(source).not.toContain("<LiveToggle");
    expect(source).not.toContain('action: "setRacebookVisibility"');
  });
});
