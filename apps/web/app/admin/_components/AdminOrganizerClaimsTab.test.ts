import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Admin Organizer publication grants", () => {
  it("lets admins select the grant origin and keeps bank-transfer details", () => {
    const source = readFileSync(resolve(process.cwd(), "app/admin/_components/AdminOrganizerClaimsTab.tsx"), "utf8");
    expect(source).toContain("Gérer le pack et les accès");
    expect(source).toContain("Paiement Stripe");
    expect(source).toContain("Paiement par virement");
    expect(source).toContain("Offert");
    expect(source).toContain('action: "setEditionGrant"');
    expect(source).toContain("Montant HT");
    expect(source).toContain("ORGANIZER_TIER_PRICE_EUR");
    expect(source).toContain("€ HT");
    expect(source).toContain("readOnly");
    expect(source).toContain("Total à payer");
    expect(source).toContain("TVA non applicable, art. 293 B du CGI");
    expect(source).toContain("Prévisualiser la facture PDF");
    expect(source).toContain("Générer une facture");
    expect(source).toContain("Générer et rendre disponible");
    expect(source).toContain("SIREN (si l’organisation en possède un)");
    expect(source).toContain("Le paiement et les droits existants ne seront pas modifiés");
    expect(source).toContain("Pack actuellement actif");
    expect(source).toContain('["visibility", "essential", "complete", "signature"]');
    expect(source).toContain("Repasser à Visibilité");
    expect(source).toContain("Émettre la facture et enregistrer le virement");
    expect(source).toContain("min-h-12 cursor-pointer");
    expect(source).toContain('role="alert"');
    expect(source).not.toContain("<LiveToggle");
    expect(source).not.toContain('action: "setRacebookVisibility"');
    expect(source).toContain("Modules offerts hors pack");
    expect(source).toContain("Statistiques RaceBook");
    expect(source).toContain('action: "setEditionCapabilityGrant"');
    expect(source).toContain('capabilityKey: "racebook_analytics.view"');
    expect(source).toContain("Inclus dans Signature");
    expect(source).toContain("Offert manuellement pour cette édition");
    expect(source).toContain("analyticsGrantEnabled !== initialAnalyticsGrantEnabled");
    expect(source).toContain("setInitialAnalyticsGrantEnabled(analyticsGrantIsActive)");
  });

  it("lets admins search and paginate the organizer publication events", () => {
    const source = readFileSync(resolve(process.cwd(), "app/admin/_components/AdminOrganizerClaimsTab.tsx"), "utf8");
    expect(source).toContain("PUBLICATION_EVENTS_PER_PAGE = 10");
    expect(source).toContain('type="search"');
    expect(source).toContain("Rechercher une course, un lieu ou un format");
    expect(source).toContain("paginatedPublicationEvents.map");
    expect(source).toContain('aria-label="Pagination des courses organisateurs"');
    expect(source).toContain("Précédente");
    expect(source).toContain("Suivante");
    expect(source).toContain("event.editionYear");
    expect(source).toContain("event.editionId ?? event.id");
  });

  it("uses searchable autocomplete fields for direct organizer assignment", () => {
    const source = readFileSync(resolve(process.cwd(), "app/admin/_components/AdminOrganizerClaimsTab.tsx"), "utf8");
    expect(source).toContain("function AssignmentAutocomplete");
    expect(source).toContain('aria-autocomplete="list"');
    expect(source).toContain("emailSearch=");
    expect(source).toContain("Saisissez au moins 2 caractères pour rechercher un compte.");
    expect(source).toContain("Rechercher une course, un lieu ou une date");
    expect(source).not.toContain('<select\n                id="organizer-assignment-event"');
  });

  it("keeps bank-transfer invoices VAT-exempt", () => {
    const source = readFileSync(resolve(process.cwd(), "app/admin/_components/AdminOrganizerClaimsTab.tsx"), "utf8");
    expect(source).toContain('tax: "0,00"');
    expect(source).toContain("TVA non applicable, art. 293 B du CGI");
    expect(source).not.toContain('formData.set("applyVat"');
  });
});
