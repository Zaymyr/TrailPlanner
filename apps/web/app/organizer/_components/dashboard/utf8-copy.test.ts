import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const organizerFiles = [
  "app/organizer/_components/dashboard/aid-stations-editor.tsx",
  "app/organizer/_components/dashboard/event-format-editors.tsx",
  "app/organizer/_components/dashboard/detail-editors.tsx",
  "app/organizer/_components/dashboard/shell.tsx",
  "app/organizer/_components/dashboard/website-import-review-details.tsx",
  "app/organizer/_components/dashboard/branding-editor.tsx",
  "app/organizer/_components/dashboard/invoices-dialog.tsx",
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

  it("keeps the organizer onboarding concise and replayable", () => {
    const dashboardSource = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"),
      "utf8",
    );
    const shellSource = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/shell.tsx"),
      "utf8",
    );

    expect(dashboardSource).toContain("Étape {current} sur {total}");
    expect(dashboardSource).toContain("Commun ou par format");
    expect(dashboardSource).toContain("Configurer mes sections");
    expect(dashboardSource).not.toContain('if (data.setupCompletedAt === null && data.tier !== "visibility")');
    expect(shellSource).toContain("Revoir le guide");
    forbiddenSequences.forEach((sequence) => {
      expect(dashboardSource).not.toContain(sequence);
    });
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

  it("keeps both admin complimentary offers explicit", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"), "utf8");
    const shellSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/dashboard/shell.tsx"), "utf8");
    const controlsSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/dashboard/controls.tsx"), "utf8");

    expect(dashboardSource).toContain('action: "setEditionTier"');
    expect(dashboardSource).toContain("paidOrganizerTiers");
    expect(dashboardSource).toContain("complimentaryGrantTarget === tier");
    expect(dashboardSource).toContain("grantComplimentaryOffer(tier)");
    expect(dashboardSource).toContain("ORGANIZER_TIER_PRICE_EUR[tier]");
    expect(shellSource).toContain("ORGANIZER_TIER_PRICE_EUR[editionTier]");
    expect(shellSource).toContain("Offre ${ORGANIZER_TIER_LABEL[editionTier]} offerte");
    expect(controlsSource).toContain('{ value: "hidden", label: "Masqué"');
    expect(controlsSource).toContain('{ value: "private", label: "Privé"');
    expect(controlsSource).toContain('{ value: "public", label: "Public"');
    expect(controlsSource).toContain("group-hover/visibility:block");
    expect(controlsSource).toContain("group-focus-within/visibility:block");
    expect(controlsSource).toContain("La course et son RaceBook sont visibles uniquement par les organisateurs actifs");
    expect(dashboardSource).toContain('racebookIsLive: visibility === "public"');
    expect(dashboardSource).toContain('visibility === "public" && activeTier === "visibility"');
    expect(dashboardSource).toContain('openPricingDialog("publication")');
    expect(dashboardSource.indexOf('visibility === "public" && activeTier === "visibility"')).toBeLessThan(
      dashboardSource.indexOf('setStatus("saving")', dashboardSource.indexOf("const setRacebookVisibility"))
    );
  });

  it("keeps the pricing dialog wide and viewport-bounded", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"), "utf8");

    expect(dashboardSource).toContain("!max-w-5xl");
    expect(dashboardSource).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dashboardSource).toContain("min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain");
  });

  it("explains the notification entitlement without presenting it as publication", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"), "utf8");

    expect(dashboardSource).toContain('openPricingDialog("notification")');
    expect(dashboardSource).toContain("Débloquer les notifications coureurs");
    expect(dashboardSource).toContain("Les notifications sont disponibles avec les offres Complet et Signature");
    expect(dashboardSource).toContain('pricingIntent !== "notification" || ORGANIZER_TIER_RANK[tier] >= ORGANIZER_TIER_RANK.complete');
  });

  it("keeps the organizer shell compact, responsive, and accessible", () => {
    const shellSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/dashboard/shell.tsx"), "utf8");
    const dashboardSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"), "utf8");

    expect(shellSource).toContain("React.useState(false)");
    expect(shellSource).toContain("open={isSummaryExpanded}");
    expect(shellSource).toContain("onToggle={(toggleEvent) => setIsSummaryExpanded(toggleEvent.currentTarget.open)}");
    expect(shellSource).toContain('isSummaryExpanded ? "Fermer" : "Ouvrir"');
    expect(shellSource).toContain('cn("h-5 overflow-hidden rounded-full"');
    expect(shellSource).toContain('htmlFor="organizer-event-combobox"');
    expect(shellSource).toContain('role="combobox"');
    expect(shellSource).toContain('aria-autocomplete="list"');
    expect(shellSource).toContain('role="listbox"');
    expect(shellSource).toContain('role="option"');
    expect(shellSource).toContain('href="/sign-in?next=%2Forganizer"');
    expect(shellSource).toContain("Rechercher ou choisir…");
    expect(shellSource).toContain("Aucun événement trouvé.");
    expect(shellSource).toContain("md:grid-cols-[minmax(16rem,28rem)_10rem]");
    expect(shellSource).toContain('htmlFor="organizer-workspace-select"');
    expect(shellSource).toContain('<optgroup label="Informations communes">');
    expect(shellSource).toContain("Commun à toutes les courses");
    expect(shellSource).toContain('<optgroup label="Formats de course">');
    expect(shellSource).toContain("Course masquée pour le public");
    expect(shellSource).toContain("RaceBook privé");
    expect(shellSource).toContain("Course et RaceBook publics");
    expect(shellSource).toContain('aria-label="Ajouter un format"');
    expect(shellSource).toContain("Créer un autre événement");
    expect(shellSource).toContain("Gérer la visibilité");
    expect(shellSource).toContain("Notifier les coureurs");
    expect(shellSource).toContain("Actions");
    expect(shellSource).toContain("Factures");
    expect(shellSource).toContain("Modifications non enregistrées");
    expect(shellSource).toContain("Une autre section contient des modifications non enregistrées.");
    expect(shellSource).toContain("fixed inset-x-4 top-20");
    expect(shellSource).toContain("sm:bottom-4");
    expect(dashboardSource).toContain("hasAnyDirtyChanges={hasAnyDirtyChanges}");
    expect(shellSource).toContain("Supprimer l’édition");
    expect(shellSource).toContain("Supprimer l’événement");
    expect(dashboardSource).toContain("<ContextualHelp");
    expect(shellSource).not.toContain("<StatusBadge");
    expect(shellSource).not.toContain("<LevelBadge");
    expect(shellSource).not.toContain('isDirty(module.id) ? "À sauvegarder" : "Modifier"');
    expect(shellSource).toContain('module.status === "empty" && "border-slate-200');
    expect(shellSource).toContain('module.status === "incomplete" && "border-amber-300');
    expect(shellSource).toContain('module.status === "complete" && "border-emerald-300');
    expect(shellSource).toContain('activeModule === module.id && "border-brand shadow-lg ring-2 ring-brand');
    expect(shellSource).toContain('min-h-[82px] rounded-lg');
    expect(shellSource).not.toContain('Manque : {module.missingLabels');
    expect(dashboardSource).toContain("raceSeriesGroups.filter");
    expect(dashboardSource).not.toContain("race.racebook_preview_is_visible !== false");
  });

  it("keeps invoice empty, pending, and downloadable states explicit", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/invoices-dialog.tsx"),
      "utf8"
    );
    expect(source).toContain("Aucun achat facturé.");
    expect(source).toContain("Facture en attente");
    expect(source).toContain("Télécharger");
    expect(source).toContain('paymentChannel === "bank_transfer" ? "Virement bancaire" : "Stripe"');
  });

  it("keeps format publication prerequisites visible and persisted", () => {
    const editorSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/dashboard/event-format-editors.tsx"), "utf8");
    const dashboardSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"), "utf8");

    expect(editorSource).toContain('label="Site officiel / source du format"');
    expect(editorSource).toContain("locationText: inheritedLocationText");
    expect(dashboardSource).toContain("externalSiteUrl: newRaceForm.externalSiteUrl");
    expect(dashboardSource).toContain("externalSiteUrl: nextForm.externalSiteUrl?.trim() || undefined");
    expect(dashboardSource).toContain("locationText: newRaceForm.locationText || eventForm.location");
    expect(dashboardSource).toContain("locationText: nextForm.locationText || eventForm.location");
    expect(dashboardSource).toContain("site officiel/source");
  });

  it("stages RaceBook section changes in a wide responsive dialog before one explicit save", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"), "utf8");

    expect(dashboardSource).toContain("setModuleSettingsDraft");
    expect(dashboardSource).toContain("saveModuleSettings");
    expect(dashboardSource).toContain("Sections communes à l’édition");
    expect(dashboardSource).toContain("Sections propres aux formats");
    expect(dashboardSource).toContain("Réglages différents selon les formats");
    expect(dashboardSource).toContain('module.scope === "edition"');
    expect(dashboardSource).toContain('module.scope === "race"');
    expect(dashboardSource).toContain("!max-w-6xl");
    expect(dashboardSource).toContain("min-[900px]:grid-cols-3");
    expect(dashboardSource).toContain("Enregistrement des sections en cours…");
    expect(dashboardSource).toContain("en attente d’enregistrement.");
  });

  it("keeps event information grouped into a clear hierarchy", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/event-format-editors.tsx"),
      "utf8"
    );

    expect(source).toContain("Informations principales");
    expect(source).toContain("Présence en ligne");
    expect(source).toContain("Dates de l’édition");
    expect(source).toContain("Contact d’urgence");
    expect(source).toContain("Image de couverture");
    expect(source).toContain('label="Nom du contact"');
    expect(source).toContain('label="Téléphone"');
    expect(source).toContain('type="tel"');
    expect(source).toContain("border-amber-200 bg-amber-50/50");
  });

  it("separates aid stations and relay points into local views", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/aid-stations-editor.tsx"),
      "utf8"
    );

    expect(source).toContain('{ id: "aidStations", label: "Ravitos" }');
    expect(source).toContain('{ id: "relay", label: "Relais" }');
    expect(source).toContain('activeView === "aidStations"');
    expect(source.indexOf("<FixedCourseCard")).toBeLessThan(source.indexOf("<TabsList"));
    expect(source).toContain("disabled={startWaveCount > 0}");
    expect(source).toContain("leurs horaires définissent le départ.");
    expect(source).toContain('title="Départ"');
    expect(source).toContain('title="Arrivée"');
    expect(source).toContain('StationMetaChip>Barrière {details.cutoffTime?.trim() || "-"}');
    expect(source).toContain('aria-label="Tronçons du relais"');
    expect(source).not.toContain('label="Passage prévu"');
    expect(source).not.toContain('label="Note de passage"');
    expect(source).not.toContain('" - Barrière à définir"');
  });

  it("keeps the earliest SAS synchronized with the shared start-time card", () => {
    const editorSource = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/structured-content-editors.tsx"),
      "utf8"
    );
    const dashboardSource = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"),
      "utf8"
    );

    expect(editorSource).toContain("referenceStartTime");
    expect(editorSource).toContain("onSummaryChange?.({ raceId, count: remote.items.length, referenceStartTime })");
    expect(dashboardSource).toContain("startWaveCount={currentStartWaveCount}");
    expect(dashboardSource).toContain("startTime={currentStartTime}");
    expect(dashboardSource).toContain("previous.count > 0");
    expect(dashboardSource).toContain("startTime: previous.referenceStartTime");
  });

  it("keeps format detail modules free from redundant nested headings", () => {
    const dashboardSource = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"),
      "utf8"
    );
    const detailSource = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/detail-editors.tsx"),
      "utf8"
    );

    expect(dashboardSource).toContain('`Retrait dossard - ${activeRace.name}`');
    expect(dashboardSource).toContain('`Matériel - ${activeRace.name}`');
    expect(dashboardSource).toContain('`Accès - ${activeRace.name}`');
    expect(dashboardSource).toContain('label="Retrait différent pour ce format"');
    expect(dashboardSource).toContain('label="Matériel différent pour ce format"');
    expect(dashboardSource).toContain('label="Accès différents pour ce format"');
    expect(dashboardSource).toContain('activeModule === "formats" || activeModule === "equipment" || activeModule === "bibPickup" || activeModule === "access"');
    expect(detailSource).toContain("showHeader={false}");
    expect(detailSource).toContain("framed={false}");
    expect(detailSource).not.toContain("<p className=\"font-semibold text-foreground\">Retrait dossard - {activeRace.name}</p>");
  });

  it("keeps access fields aligned with the runner-facing information hierarchy", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/detail-editors.tsx"),
      "utf8"
    );

    expect(source).toContain("1. Lieux et itinéraire");
    expect(source).toContain("2. À retenir");
    expect(source).toContain("3. Venir sur place");
    expect(source).toContain('label="Information prioritaire"');
    expect(source).toContain('label="Fonctionnement des navettes"');
    expect(source).toContain('label="Horaires des navettes"');
    expect(source).not.toContain('label="Note accès"');
  });

  it("keeps edition visibility and year-confirmed deletion in the organizer header", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/shell.tsx"),
      "utf8"
    );

    expect(source).toContain('liveLabel="Visible"');
    expect(source).toContain('draftLabel="Masquée"');
    expect(source).toContain('description="Afficher ou masquer toutes les courses de cette édition dans le catalogue."');
    expect(source).toContain("Masquer l’édition retire ses courses du catalogue");
    expect(source).toContain("deleteEditionConfirmation !== selectedEditionYear");
    expect(source).toContain("Tape « {selectedEditionYear} » pour confirmer");
  });

  it("keeps the RaceBook branding draft, preview, reset, publish, and Pro upsell controls explicit", () => {
    const editorSource = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/dashboard/branding-editor.tsx"),
      "utf8"
    );
    const dashboardSource = readFileSync(
      resolve(process.cwd(), "app/organizer/_components/OrganizerDashboard.tsx"),
      "utf8"
    );

    expect(editorSource).toContain("Brouillon non publié");
    expect(editorSource).toContain("Aperçu mobile");
    expect(editorSource).toContain("Annuler les changements");
    expect(editorSource).toContain("Réinitialiser au thème Pace Yourself");
    expect(editorSource).toContain("Enregistrer le brouillon");
    expect(editorSource).toContain("Publier la DA");
    expect(editorSource).toContain('window.addEventListener("beforeunload"');
    expect(editorSource).toContain("RACEBOOK_EDITION_LOGO_ENABLED ? (");
    expect(editorSource).toContain("theme.accentSurfaceColor");
    expect(dashboardSource).toContain("Cette section restera privée jusqu’au passage à");
    expect(dashboardSource).toContain("Offre requise pour publier toutes les sections");
  });
});
