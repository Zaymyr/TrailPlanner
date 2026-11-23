import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/** Organisateurs since lot 5: the orchestrator plus its domain components of `organizers/`. */
const readOrganizerSources = () => {
  const directory = resolve(process.cwd(), "app/admin/_components/organizers");
  return [
    readFileSync(resolve(process.cwd(), "app/admin/_components/AdminOrganizerClaimsTab.tsx"), "utf8"),
    ...readdirSync(directory).filter((name) => name.endsWith(".tsx") || (name.endsWith(".ts") && !name.endsWith(".test.ts"))).map((name) => readFileSync(resolve(directory, name), "utf8")),
  ].join("\n");
};

describe("Admin Organizer publication grants", () => {
  it("lets admins select the grant origin and the offered modules, without billing in the dialog", () => {
    const source = readOrganizerSources();
    expect(source).toContain("Gérer le pack et les accès");
    expect(source).toContain("Paiement Stripe");
    expect(source).toContain("Paiement par virement");
    expect(source).toContain("Offert");
    expect(source).toContain('action: "setEditionGrant"');
    expect(source).toContain("ORGANIZER_TIER_PRICE_EUR");
    expect(source).toContain("€ HT");
    expect(source).toContain("Pack actuellement actif");
    expect(source).toContain('["visibility", "essential", "complete", "signature"]');
    expect(source).toContain("Repasser à Visibilité");
    expect(source).toContain("min-h-12 cursor-pointer");
    expect(source).toContain('role="alert"');
    expect(source).not.toContain("<LiveToggle");
    expect(source).not.toContain('action: "setRacebookVisibility"');
    expect(source).toContain("Modules offerts hors pack");
    expect(source).toContain("ORGANIZER_FEATURES.map");
    expect(source).toContain('action: "setEditionCapabilityGrant"');
    expect(source).toContain("feature.key");
    expect(source).toContain('`Inclus dans ${feature.minimumTier === "complete" ? "Complet" : "Signature"}`');
    expect(source).toContain("Offert manuellement pour cette édition");
    expect(source).toContain("Fonctionnalités pouvant être offertes");
    expect(source).not.toContain("unit_price_cents");
    expect(source).not.toContain("Prix HT (€)");
    expect(source).toContain("enabledFeatureGrants.includes(feature.key) !== initialFeatureGrants.includes(feature.key)");
    expect(source).toContain("setInitialFeatureGrants(activeFeatures)");
  });

  it("hands billing over to Ventes & facturation (lot 4)", () => {
    const source = readOrganizerSources();
    expect(source).toContain("<EditionBillingSummary event={event} />");
    expect(source).toContain("/admin/billing?edition=");
    expect(source).toContain('get("edition")');
    expect(source).not.toContain("/api/admin/organizer-invoices");
    expect(source).not.toContain("/api/admin/organizer-payments");
    expect(source).not.toContain("Créer une facture");
    expect(source).not.toContain("needsBankTransferDetails");
  });

  it("lets admins search and paginate the organizer publication events", () => {
    const source = readOrganizerSources();
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
    const source = readOrganizerSources();
    expect(source).toContain("function AssignmentAutocomplete");
    expect(source).toContain('aria-autocomplete="list"');
    expect(source).toContain("emailSearch=");
    expect(source).toContain('open && "z-50"');
    expect(source).toContain('<Card className="relative z-10 rounded-lg">');
    expect(source).toContain("Saisissez au moins 2 caractères pour rechercher un compte.");
    expect(source).toContain("Rechercher une course, un lieu ou une date");
    expect(source).not.toContain('<select\n                id="organizer-assignment-event"');
  });
});
