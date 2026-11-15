import * as React from "react";
import Link from "next/link";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { cn } from "../../../../components/utils";
import { ORGANIZER_TIER_LABEL, ORGANIZER_TIER_PRICE_EUR, ORGANIZER_TIER_RANK } from "../../../../lib/organizer-modules";
import type { OrganizerCompletionSummary, OrganizerModuleId } from "../completion";
import { ADD_FORMAT_TAB_ID, EVENT_TAB_ID } from "./constants";
import { buildEditionYearOptions, formatEventDateRange, getEventEdition, getRaceEditionYear, getRaceEditionYearLabel, groupRacesBySeries } from "./helpers";
import type { ClaimRow, EditionRequestRow, MembershipRow, OrganizerEventDetail, PublicationRequestRow, RacebookPublicationState, RaceFormat } from "./types";
import { ContextualHelp, LiveToggle, RacebookVisibilityControl } from "./controls";
import type { RacebookVisibilityState } from "./controls";
import { SelectField } from "./form-kit";

const FORMAT_VISIBILITY_LABEL: Record<RacebookVisibilityState, string> = {
  hidden: "Course masquée pour le public",
  private: "Livret coureur privé",
  public: "Course et Livret coureur publics",
};

const getProgressTone = (score: number) => {
  if (score < 20) {
    return {
      track: "bg-red-100",
      fill: "bg-red-500",
      text: "text-white",
    };
  }
  if (score <= 80) {
    return {
      track: "bg-amber-100",
      fill: "bg-amber-500",
      text: "text-white",
    };
  }
  return {
    track: "bg-emerald-100",
    fill: "bg-emerald-500",
    text: "text-white",
  };
};

export function OrganizerSignedOutCard() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Dashboard organisateur</CardTitle>
          <CardDescription>Connecte-toi pour accéder à ton espace organisateur.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/sign-in?next=%2Forganizer">
            <Button>Se connecter</Button>
          </Link>
          <Link href="/organizers">
            <Button variant="outline">Ajouter une course</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function OrganizerNoMembershipCard({ pendingClaims, rejectedClaims }: { pendingClaims: ClaimRow[]; rejectedClaims: ClaimRow[] }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Dashboard organisateur</CardTitle>
          <CardDescription>Aucune course n&apos;est encore rattachée à ce compte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingClaims.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Demandes en attente</p>
              {pendingClaims.map((claim) => (
                <div key={claim.id} className="rounded-md border border-border bg-background p-3 text-sm">
                  {claim.race_events?.name ?? claim.organization_name}
                </div>
              ))}
            </div>
          ) : null}
          {rejectedClaims.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Demandes refusées</p>
              {rejectedClaims.map((claim) => (
                <div key={claim.id} className="rounded-md border border-border bg-background p-3 text-sm">
                  <p className="font-medium">{claim.race_events?.name ?? claim.organization_name}</p>
                  {claim.reviewer_notes ? <p className="text-muted-foreground">{claim.reviewer_notes}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {pendingClaims.length === 0 && rejectedClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tu n&apos;as pas encore créé de course.</p>
          ) : null}
          <Link href="/organizers">
            <Button>Ajouter une course</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function OrganizerSummaryHeader({
  selectedMembership,
  event,
  memberships,
  selectedEventId,
  editionRequests,
  selectedEditionYear,
  newEditionDate,
  newEditionEndDate,
  publicationRequestStates,
  onSelectedEventChange,
  onSelectedEditionYearChange,
  onEditionDateChange,
  onEditionEndDateChange,
  onRequestEdition,
  onImportWebsite,
  importWebsiteLabel = "Importer les informations",
  completion,
  isVisibilityOnboardingActive = false,
  autosaveState,
  lastAutosavedAt,
  status,
  activeRaceId,
  modifiedFormatCount = 0,
  publicationStatesByRace,
  onRetryAutosave,
  onNotifyFollowers,
  onRequestPublication,
  onRacebookVisibilityChange,
  onPublishRace,
  onOpenPublicationHistory,
  onEditionVisibilityChange,
  onDeleteEdition,
  onDeleteEvent,
  onReplayOnboarding,
  onOpenInvoices,
}: {
  selectedMembership: MembershipRow | null;
  event: OrganizerEventDetail | null;
  memberships: MembershipRow[];
  selectedEventId: string | null;
  editionRequests: EditionRequestRow[];
  selectedEditionYear: string;
  newEditionDate: string;
  newEditionEndDate: string;
  publicationRequestStates: PublicationRequestRow[];
  onSelectedEventChange: (eventId: string) => void;
  onSelectedEditionYearChange: (year: string) => void;
  onEditionDateChange: (value: string) => void;
  onEditionEndDateChange: (value: string) => void;
  onRequestEdition: (duplicatePreviousEdition: boolean) => Promise<boolean>;
  onImportWebsite?: () => void;
  importWebsiteLabel?: string;
  completion: OrganizerCompletionSummary | null;
  isVisibilityOnboardingActive?: boolean;
  autosaveState: "idle" | "saving" | "saved" | "error";
  lastAutosavedAt: Date | null;
  status: "idle" | "loading" | "saving" | "uploading";
  activeRaceId?: string | null;
  modifiedFormatCount?: number;
  publicationStatesByRace: Record<string, RacebookPublicationState>;
  onRetryAutosave: () => void;
  onNotifyFollowers: (raceId?: string) => void;
  onRequestPublication: () => void;
  onRacebookVisibilityChange: (raceId: string, state: RacebookVisibilityState) => void;
  onPublishRace: (raceId: string, label: string) => void;
  onOpenPublicationHistory: (raceId: string, label: string, intent: "history" | "restore") => void;
  onEditionVisibilityChange: (isVisible: boolean) => Promise<boolean>;
  onDeleteEdition: () => Promise<boolean>;
  onDeleteEvent: () => Promise<boolean>;
  onReplayOnboarding: () => void;
  onOpenInvoices: () => void;
}) {
  const [newEditionDialogOpen, setNewEditionDialogOpen] = React.useState(false);
  const [duplicatePreviousEdition, setDuplicatePreviousEdition] = React.useState(true);
  const [isEditionCreationPending, setIsEditionCreationPending] = React.useState(false);
  const [deleteEventDialogOpen, setDeleteEventDialogOpen] = React.useState(false);
  const [deleteEventConfirmation, setDeleteEventConfirmation] = React.useState("");
  const [deleteEditionDialogOpen, setDeleteEditionDialogOpen] = React.useState(false);
  const [deleteEditionConfirmation, setDeleteEditionConfirmation] = React.useState("");
  const [isSummaryExpanded, setIsSummaryExpanded] = React.useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = React.useState(false);
  const actionsMenuRef = React.useRef<HTMLDetailsElement>(null);
  const actionsSummaryRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!actionsMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!actionsMenuRef.current?.contains(event.target as Node)) setActionsMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setActionsMenuOpen(false);
      actionsSummaryRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionsMenuOpen]);
  React.useEffect(() => {
    if (!isVisibilityOnboardingActive) setIsSummaryExpanded(false);
  }, [isVisibilityOnboardingActive]);
  const isVisibilityExpanded = isSummaryExpanded || isVisibilityOnboardingActive;
  const eventScore = completion?.informationComplete
    ? 100
    : Math.min(completion?.raceProgressScore ?? 0, 99);
  const completedSectionCount = completion?.modules.filter((module) => module.status === "complete").length ?? 0;
  const totalSectionCount = completion?.modules.length ?? 0;
  const raceProgress = completion?.raceProgress ?? [];
  const editionYearOptions = buildEditionYearOptions(event?.races ?? [], event?.editions ?? [], editionRequests, selectedEventId);
  const raceRows = groupRacesBySeries(event?.races ?? []).flatMap((group) => {
    const activeEdition = group.races.find(
      (race) => getRaceEditionYear(race, event?.editions) === selectedEditionYear
    ) ?? null;
    if (!activeEdition) return [];
    const activeProgress = raceProgress.find((entry) => entry.id === activeEdition.id)?.score ?? 0;
    return [{
      id: group.id,
      label: group.seriesName,
      score: activeProgress,
      activeEdition,
    }];
  });
  const publicFormatCount = raceRows.filter((race) => race.activeEdition?.racebook_is_live === true).length;
  const allFormatsPublic = raceRows.length > 0 && publicFormatCount === raceRows.length;
  const previewSlug = raceRows.find((race) => race.activeEdition?.slug)?.activeEdition?.slug ?? null;
  const supporterGuideRaceId = raceRows.find((race) => race.activeEdition?.id)?.activeEdition?.id ?? null;
  const dateLabel = formatEventDateRange(event, selectedEditionYear);
  const selectedEdition = getEventEdition(event, selectedEditionYear);
  const editionIsVisible = selectedEdition?.is_visible !== false;
  const editionTier = selectedEdition?.entitlement?.status === "active" ? selectedEdition.entitlement.tier : "visibility";
  const canPublishRacebook = editionTier !== "visibility";
  const entitlementSource = selectedEdition?.entitlement?.source;
  const purchase = selectedEdition?.purchase;
  const isComplimentaryOffer = entitlementSource === "complimentary" || entitlementSource === "legacy_admin";
  const offerStatusLabel = purchase
    ? `Payé par ${purchase.paymentChannel === "bank_transfer" ? "virement" : "Stripe"}${purchase.paidAt ? ` le ${new Date(purchase.paidAt).toLocaleDateString("fr-FR")}` : ""}`
    : entitlementSource === "stripe" || entitlementSource === "manual_payment"
    ? "Paiement confirmé"
    : entitlementSource === "admin" && editionTier !== "visibility"
      ? `Activation administrateur · ${ORGANIZER_TIER_LABEL[editionTier]}`
    : isComplimentaryOffer && editionTier !== "visibility"
      ? `Offre ${ORGANIZER_TIER_LABEL[editionTier]} offerte — valeur : ${ORGANIZER_TIER_PRICE_EUR[editionTier]} € HT`
        : "Aucun paiement actif";
  return (
    <section className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm sm:px-4">
      <div id="organizer-onboarding-overview" className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="sr-only">Espace organisateur</p>
          <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
            {selectedMembership?.race_events?.name ?? event?.name ?? "Événement"}
          </h1>
          <span className={cn("ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", publicFormatCount > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>
            {publicFormatCount > 0 ? `En ligne · ${publicFormatCount} format${publicFormatCount > 1 ? "s" : ""} public${publicFormatCount > 1 ? "s" : ""}` : "Brouillon"}
          </span>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {[event?.location, dateLabel].filter(Boolean).join(" · ") || "Lieu et dates à compléter"}
          </p>
        </div>

        <div id="organizer-onboarding-selectors" className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_8rem] lg:max-w-md">
          <OrganizerEventCombobox memberships={memberships} selectedEventId={selectedEventId} onSelectedEventChange={onSelectedEventChange} />
          <div>
            <label htmlFor="organizer-event-edition-select" className="mb-1 block text-xs font-medium text-muted-foreground">Édition</label>
            <SelectField id="organizer-event-edition-select" title="Changer l’année à modifier sans changer d’événement." value={selectedEditionYear} onValueChange={onSelectedEditionYearChange} options={editionYearOptions.map((option) => ({ value: option.value, label: option.label }))} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {raceRows.length > 0 && (!canPublishRacebook || modifiedFormatCount > 0) ? (
            <Button type="button" onClick={onRequestPublication} disabled={!editionIsVisible || status !== "idle"} className="!h-11" title="Publier atomiquement tous les formats modifiés de cette édition.">
              {canPublishRacebook
                ? `Publier tous les formats modifiés (${modifiedFormatCount})`
                : "Choisir une offre"}
            </Button>
          ) : allFormatsPublic && previewSlug ? (
            <Link href={`/courses/${previewSlug}`} className="inline-flex">
              <Button type="button" className="!h-11">Voir le Livret coureur</Button>
            </Link>
          ) : null}
          {previewSlug ? <Link href={`/courses/${previewSlug}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand underline-offset-4 hover:underline">Aperçu coureur</Link> : null}
          {supporterGuideRaceId ? <Link href={`/courses/supporter-guide/${supporterGuideRaceId}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand underline-offset-4 hover:underline">Aperçu accompagnateur</Link> : null}
          {supporterGuideRaceId ? <a href={`/api/supporter-guide/qr?raceId=${supporterGuideRaceId}`} download className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand underline-offset-4 hover:underline">Télécharger le QR</a> : null}
          <details ref={actionsMenuRef} open={actionsMenuOpen} onToggle={(event) => setActionsMenuOpen(event.currentTarget.open)} className="group relative">
            <summary ref={actionsSummaryRef} aria-haspopup="menu" aria-expanded={actionsMenuOpen} title="Ouvrir les actions utilisées moins souvent." className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring marker:content-none">
              Actions
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4 transition group-open:rotate-180">
                <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div role="menu" onClickCapture={() => setActionsMenuOpen(false)} className="absolute right-0 z-30 mt-2 grid w-64 gap-1 rounded-lg border border-border bg-card p-2 shadow-xl">
              <Button role="menuitem" type="button" variant="ghost" onClick={() => onNotifyFollowers(activeRaceId ?? undefined)} disabled={!event} className="!justify-start" title="Envoyer une actualité aux coureurs qui suivent l’événement.">
                Notifier les coureurs
              </Button>
              {onImportWebsite ? (
                <Button role="menuitem" type="button" variant="ghost" onClick={onImportWebsite} className="!justify-start" title="Préremplir le Livret coureur depuis les sources officielles.">{importWebsiteLabel}</Button>
              ) : null}
              <Button
                role="menuitem"
                type="button"
                variant="ghost"
                onClick={() => {
                  setDuplicatePreviousEdition(ORGANIZER_TIER_RANK[editionTier] >= ORGANIZER_TIER_RANK.complete);
                  setNewEditionDialogOpen(true);
                }}
                disabled={status !== "idle"}
                className="!justify-start"
                title="Créer une nouvelle année, vide ou dupliquée depuis l’édition actuelle."
              >
                Créer une nouvelle édition
              </Button>
              <Link role="menuitem" href="/organizers" title="Créer un événement distinct de celui actuellement sélectionné." className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                <span className="flex h-10 items-center px-4 text-sm font-semibold text-foreground hover:bg-muted/40">Créer un autre événement</span>
              </Link>
              <Button
                role="menuitem"
                type="button"
                variant="ghost"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onReplayOnboarding();
                }}
                className="!justify-start"
                title="Afficher à nouveau la visite guidée de cet espace."
              >
                Revoir le guide
              </Button>
              <Button
                role="menuitem"
                type="button"
                variant="ghost"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onOpenInvoices();
                }}
                className="!justify-start"
                title="Consulter et télécharger les factures Stripe et virement."
              >
                Factures
              </Button>
              <div className="my-1 border-t border-border" />
              <Button
                role="menuitem"
                type="button"
                variant="ghost"
                onClick={() => {
                  setDeleteEditionConfirmation("");
                  setDeleteEditionDialogOpen(true);
                }}
                disabled={!selectedEdition || status !== "idle"}
                className="!justify-start !text-red-700"
                title="Supprimer définitivement l’édition sélectionnée et ses formats."
              >
                Supprimer l’édition
              </Button>
              <Button
                role="menuitem"
                type="button"
                variant="ghost"
                onClick={() => {
                  setDeleteEventConfirmation("");
                  setDeleteEventDialogOpen(true);
                }}
                disabled={!selectedEventId || status !== "idle"}
                className="!justify-start !text-red-700"
                title="Supprimer définitivement l’événement et toutes ses éditions."
              >
                Supprimer l’événement
              </Button>
            </div>
          </details>
        </div>
      </div>

      <details open={isVisibilityOnboardingActive || undefined} className="group mt-1 border-t border-border/70">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring marker:content-none">
          Visibilité et progression
          <span className="ml-auto">Configurer</span>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
        <span className="text-sm font-medium text-foreground">Minimum requis</span>
        <InlineProgressBar score={eventScore} className="min-w-[12rem] flex-1" />
        <span className="text-xs font-medium text-muted-foreground">Complétion globale : {completedSectionCount} section{completedSectionCount > 1 ? "s" : ""} sur {totalSectionCount} renseignée{completedSectionCount > 1 ? "s" : ""}</span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", completion?.informationComplete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>{completion?.informationComplete ? "Minimum requis atteint" : "Minimum requis à compléter"}</span>
      </div>

      <details open={isVisibilityExpanded} onToggle={(toggleEvent) => setIsSummaryExpanded(toggleEvent.currentTarget.open)} className="group mt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md px-2 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring marker:content-none">
          Gérer la visibilité
          <span className="font-normal text-muted-foreground">{raceRows.length} format{raceRows.length > 1 ? "s" : ""}</span>
          <span className="ml-auto text-xs text-muted-foreground">{isVisibilityExpanded ? "Fermer" : "Ouvrir"}</span>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>

        {isVisibilityExpanded ? <div id="organizer-onboarding-visibility" className="mt-2 space-y-2 rounded-lg border border-border bg-background/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">Catalogue</p>
              <ContextualHelp text="Masquer l’édition retire ses courses du catalogue et ses Livrets coureurs du public. Les données restent conservées." />
            </div>
            <LiveToggle checked={editionIsVisible} disabled={!selectedEdition || status !== "idle"} onChange={(checked) => void onEditionVisibilityChange(checked)} liveLabel="Visible" draftLabel="Masquée" description="Afficher ou masquer toutes les courses de cette édition dans le catalogue." />
          </div>
          {raceRows.length > 0 ? raceRows.map((race) => {
            const visibilityState: RacebookVisibilityState = race.activeEdition!.racebook_is_live === true
              ? "public"
              : race.activeEdition!.racebook_preview_is_visible === false
                ? "hidden"
                : "private";
            const publicationState = publicationStatesByRace[race.activeEdition!.id];
            const formatLabel = race.label || "Format sans nom";
            return (
              <div key={race.id} className="grid gap-3 rounded-lg border border-border/60 bg-card p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{formatLabel}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{race.score}% complété</span>
                    <span aria-hidden="true">·</span>
                    <span>{getRaceEditionYearLabel(race.activeEdition!.race_date)}</span>
                  </div>
                </div>
                <RacebookVisibilityControl
                  label={race.label || "format sans nom"}
                  value={visibilityState}
                  disabled={status !== "idle"}
                  publicDisabled={!editionIsVisible || race.activeEdition!.data_status === "draft"}
                  onChange={(state) => onRacebookVisibilityChange(race.activeEdition!.id, state)}
                />
                {publicationState ? (
                  publicationState.hasUnpublishedChanges ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="!h-10 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                      disabled={status !== "idle" || autosaveState !== "saved"}
                      onClick={() => onPublishRace(race.activeEdition!.id, formatLabel)}
                    >
                      Publier les modifications
                    </Button>
                  ) : (
                    <span className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">
                      Informations à jour
                    </span>
                  )
                ) : (
                  <span className="inline-flex min-h-10 items-center px-3 text-sm text-muted-foreground">Chargement…</span>
                )}
                <details className="group/versions relative justify-self-start lg:justify-self-end">
                  <summary
                    className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-card text-xl font-semibold leading-none text-foreground transition hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring marker:content-none"
                    aria-label={`Ouvrir les versions de ${formatLabel}`}
                    title="Historique et restauration"
                  >
                    …
                  </summary>
                  <div role="menu" className="absolute right-0 z-40 mt-2 grid w-64 gap-1 rounded-lg border border-border bg-card p-2 shadow-xl">
                    <Button
                      role="menuitem"
                      type="button"
                      variant="ghost"
                      className="!justify-start"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onOpenPublicationHistory(race.activeEdition!.id, formatLabel, "history");
                      }}
                    >
                      Historique des versions
                    </Button>
                    <Button
                      role="menuitem"
                      type="button"
                      variant="ghost"
                      className="!justify-start"
                      disabled={!publicationState?.currentPublicationId}
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onOpenPublicationHistory(race.activeEdition!.id, formatLabel, "restore");
                      }}
                    >
                      Restaurer une ancienne version
                    </Button>
                  </div>
                </details>
              </div>
            );
          }) : <p className="text-sm text-muted-foreground">Aucune course pour le moment.</p>}
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">Pack {ORGANIZER_TIER_LABEL[editionTier]}</strong>
            {purchase ? <span>· {purchase.paymentChannel === "bank_transfer" ? "Virement" : "Stripe"}{purchase.paidAt ? ` · ${new Date(purchase.paidAt).toLocaleDateString("fr-FR")}` : ""}</span> : null}
            <ContextualHelp text={offerStatusLabel} label="Détail de l’offre" />
          </div>
        </div> : null}
      </details>
      </details>

      <Dialog
        open={newEditionDialogOpen}
        onOpenChange={(open) => {
          if (!isEditionCreationPending) setNewEditionDialogOpen(open);
        }}
      >
        <DialogContent>
          <form
            className="grid gap-5"
            aria-busy={isEditionCreationPending}
            onSubmit={async (event) => {
              event.preventDefault();
              setIsEditionCreationPending(true);
              try {
                const created = await onRequestEdition(duplicatePreviousEdition);
                if (created) setNewEditionDialogOpen(false);
              } finally {
                setIsEditionCreationPending(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Créer une nouvelle édition</DialogTitle>
              <DialogDescription>Choisis les dates de l’édition. Elle sera créée en brouillon.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="organizer-new-edition-date" className="text-sm font-medium text-foreground">
                  Date de début
                </label>
                <input
                  id="organizer-new-edition-date"
                  type="date"
                  required
                  disabled={isEditionCreationPending}
                  className="mt-2 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                  value={newEditionDate}
                  onChange={(event) => onEditionDateChange(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="organizer-new-edition-end-date" className="text-sm font-medium text-foreground">
                  Date de fin
                </label>
                <input
                  id="organizer-new-edition-end-date"
                  type="date"
                  required
                  disabled={isEditionCreationPending}
                  min={newEditionDate || undefined}
                  className="mt-2 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                  value={newEditionEndDate}
                  onChange={(event) => onEditionEndDateChange(event.target.value)}
                />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-md border border-border bg-background/70 p-3 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-input accent-brand"
                checked={duplicatePreviousEdition}
                onChange={(event) => setDuplicatePreviousEdition(event.target.checked)}
                disabled={isEditionCreationPending || ORGANIZER_TIER_RANK[editionTier] < ORGANIZER_TIER_RANK.complete}
              />
              <span>
                <span className="block font-medium">Dupliquer depuis l’édition précédente {ORGANIZER_TIER_RANK[editionTier] < ORGANIZER_TIER_RANK.complete ? "— Complet" : ""}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Reprend les formats de l’édition {selectedEditionYear} dans la nouvelle édition.
                </span>
              </span>
            </label>
            {isEditionCreationPending ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-3 rounded-md border border-brand-border bg-brand-surface p-3 text-sm text-foreground"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand/30 border-t-brand"
                />
                <span>
                  <span className="block font-medium">
                    {duplicatePreviousEdition ? "Duplication de l’édition en cours…" : "Création de l’édition en cours…"}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {duplicatePreviousEdition
                      ? "Les formats et leurs données sont en cours de préparation. Cette opération peut prendre quelques instants."
                      : "La nouvelle édition est en cours de préparation. Cette opération peut prendre quelques instants."}
                  </span>
                </span>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewEditionDialogOpen(false)} disabled={isEditionCreationPending || status !== "idle"}>
                Annuler
              </Button>
              <Button type="submit" disabled={isEditionCreationPending || status !== "idle"}>
                {isEditionCreationPending
                  ? duplicatePreviousEdition
                    ? "Duplication en cours…"
                    : "Création en cours…"
                  : "Créer l’édition"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteEditionDialogOpen}
        onOpenChange={(open) => {
          setDeleteEditionDialogOpen(open);
          if (!open) setDeleteEditionConfirmation("");
        }}
      >
        <DialogContent>
          <form
            className="grid gap-5"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              if (deleteEditionConfirmation !== selectedEditionYear) return;
              void onDeleteEdition().then((deleted) => {
                if (deleted) {
                  setDeleteEditionDialogOpen(false);
                  setDeleteEditionConfirmation("");
                }
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Supprimer définitivement l’édition {selectedEditionYear} ?</DialogTitle>
              <DialogDescription>
                Tous les formats de cette édition, leurs Livrets coureurs, GPX et données organisateur seront supprimés. Les plans déjà créés resteront disponibles sans lien vers leur course source. Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div>
              <label htmlFor="organizer-delete-edition-confirmation" className="text-sm font-medium text-foreground">
                Tape « {selectedEditionYear} » pour confirmer
              </label>
              <input
                id="organizer-delete-edition-confirmation"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="mt-2 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                value={deleteEditionConfirmation}
                onChange={(changeEvent) => setDeleteEditionConfirmation(changeEvent.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteEditionDialogOpen(false)} disabled={status !== "idle"}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={deleteEditionConfirmation !== selectedEditionYear || status !== "idle"}
                className="!bg-red-600 !text-white hover:!bg-red-700"
              >
                {status === "saving" ? "Suppression..." : "Supprimer l’édition"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteEventDialogOpen}
        onOpenChange={(open) => {
          setDeleteEventDialogOpen(open);
          if (!open) setDeleteEventConfirmation("");
        }}
      >
        <DialogContent>
          <form
            className="grid gap-5"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              if (deleteEventConfirmation !== "Supprimer") return;
              void onDeleteEvent().then((deleted) => {
                if (deleted) {
                  setDeleteEventDialogOpen(false);
                  setDeleteEventConfirmation("");
                }
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Supprimer définitivement cette course ?</DialogTitle>
              <DialogDescription>
                La course « {selectedMembership?.race_events?.name ?? event?.name ?? "sélectionnée"} », ses éditions, ses formats et ses informations organisateur seront supprimés. Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div>
              <label htmlFor="organizer-delete-event-confirmation" className="text-sm font-medium text-foreground">
                Tape « Supprimer » pour confirmer
              </label>
              <input
                id="organizer-delete-event-confirmation"
                type="text"
                autoComplete="off"
                className="mt-2 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                value={deleteEventConfirmation}
                onChange={(changeEvent) => setDeleteEventConfirmation(changeEvent.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteEventDialogOpen(false)} disabled={status !== "idle"}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={deleteEventConfirmation !== "Supprimer" || status !== "idle"}
                className="!bg-red-600 !text-white hover:!bg-red-700"
              >
                {status === "saving" ? "Suppression..." : "Supprimer définitivement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function OrganizerEventCombobox({
  memberships,
  selectedEventId,
  onSelectedEventChange,
}: {
  memberships: MembershipRow[];
  selectedEventId: string | null;
  onSelectedEventChange: (eventId: string) => void;
}) {
  const listboxId = React.useId();
  const selectedLabel = memberships.find((membership) => membership.event_id === selectedEventId)?.race_events?.name ?? "";
  const [query, setQuery] = React.useState(selectedLabel);
  const [open, setOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filteredMemberships = normalizedQuery
    ? memberships.filter((membership) =>
        (membership.race_events?.name ?? membership.event_id).toLocaleLowerCase("fr").includes(normalizedQuery)
      )
    : memberships;

  React.useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [open, selectedLabel]);

  const openList = () => {
    if (open) return;
    setQuery("");
    setHighlightedIndex(0);
    setOpen(true);
  };
  const closeList = () => {
    setOpen(false);
    setQuery(selectedLabel);
  };
  const selectMembership = (membership: MembershipRow) => {
    setQuery(membership.race_events?.name ?? membership.event_id);
    setOpen(false);
    if (membership.event_id !== selectedEventId) onSelectedEventChange(membership.event_id);
  };

  return (
    <div className="relative min-w-0">
      <label htmlFor="organizer-event-combobox" className="mb-1 block text-xs font-medium text-muted-foreground">Événement</label>
      <div className="relative">
        <input
          id="organizer-event-combobox"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && filteredMemberships[highlightedIndex] ? `${listboxId}-${filteredMemberships[highlightedIndex].id}` : undefined}
          value={query}
          onFocus={openList}
          onClick={openList}
          onBlur={closeList}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeList();
              event.currentTarget.blur();
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                openList();
                return;
              }
              const direction = event.key === "ArrowDown" ? 1 : -1;
              setHighlightedIndex((current) =>
                filteredMemberships.length === 0
                  ? 0
                  : (current + direction + filteredMemberships.length) % filteredMemberships.length
              );
              return;
            }
            if (event.key === "Enter" && open && filteredMemberships[highlightedIndex]) {
              event.preventDefault();
              selectMembership(filteredMemberships[highlightedIndex]);
            }
          }}
          placeholder="Rechercher ou choisir…"
          className="h-11 w-full rounded-md border border-border bg-card px-3 pr-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={cn("pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition", open && "rotate-180")}>
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {open ? (
        <div id={listboxId} role="listbox" aria-label="Événements" className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl">
          {filteredMemberships.length > 0 ? filteredMemberships.map((membership, index) => {
            const label = membership.race_events?.name ?? membership.event_id;
            return (
              <button
                key={membership.id}
                id={`${listboxId}-${membership.id}`}
                type="button"
                role="option"
                aria-selected={membership.event_id === selectedEventId}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectMembership(membership)}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-foreground",
                  index === highlightedIndex ? "bg-brand-surface" : "hover:bg-muted/50"
                )}
              >
                <span className="truncate">{label}</span>
                {membership.event_id === selectedEventId ? <span className="ml-3 text-xs font-semibold text-brand">Sélectionné</span> : null}
              </button>
            );
          }) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">Aucun événement trouvé.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CompletionTabsPanel({
  tabs,
  activeTab,
  activeRace,
  completion,
  dirtyModules,
  onTabChange,
  onSelectModule,
  activeModule,
}: {
  tabs: Array<{ id: string; label: string; visibility?: RacebookVisibilityState }>;
  activeTab: string;
  activeRace: RaceFormat | null;
  completion: OrganizerCompletionSummary;
  dirtyModules: Set<OrganizerModuleId>;
  onTabChange: (tab: string) => void;
  onSelectModule: (moduleId: OrganizerModuleId) => void;
  activeModule: OrganizerModuleId;
}) {
  const isEventTab = activeTab === EVENT_TAB_ID;
  const isAddTab = activeTab === ADD_FORMAT_TAB_ID;
  const modules = isEventTab ? completion.eventModules : activeRace ? completion.formatModules : [];
  const eventTab = tabs.find((tab) => tab.id === EVENT_TAB_ID);
  const formatTabs = tabs.filter((tab) => tab.id !== EVENT_TAB_ID && tab.id !== ADD_FORMAT_TAB_ID);
  const addFormatTab = tabs.find((tab) => tab.id === ADD_FORMAT_TAB_ID);

  const getFormatOptionLabel = (tab: { label: string; visibility?: RacebookVisibilityState }) =>
    `Format · ${tab.label}${tab.visibility ? ` — ${FORMAT_VISIBILITY_LABEL[tab.visibility]}` : ""}`;

  const statusTone = (status: OrganizerCompletionSummary["modules"][number]["status"]) =>
    status === "complete" ? "bg-emerald-500" : status === "incomplete" ? "bg-amber-500" : "bg-muted-foreground/35";
  const renderModules = (items: OrganizerCompletionSummary["modules"]) => items.map((module) => (
    <button
      key={module.id}
      type="button"
      aria-label={`${module.title}. ${module.countLabel}`}
      aria-current={activeModule === module.id ? "page" : undefined}
      onClick={() => onSelectModule(module.id)}
      className={cn(
        "flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        activeModule === module.id ? "bg-brand-surface font-semibold text-brand" : "text-foreground hover:bg-muted/50"
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", statusTone(module.status))} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block leading-snug">{module.title}</span>
        {activeModule === module.id ? <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{module.countLabel}</span> : null}
      </span>
      {dirtyModules.has(module.id) ? <span className="sr-only">Modifications à sauvegarder</span> : null}
    </button>
  ));

  return (
    <nav id="organizer-onboarding-module-tiles" aria-label="Sections" className="rounded-xl border border-border bg-card p-2 shadow-sm min-[1320px]:sticky min-[1320px]:top-3">
      <div id="organizer-onboarding-scope-navigation" className="min-[1320px]:hidden">
        <label htmlFor="organizer-workspace-select" className="mb-1.5 block text-sm font-medium text-foreground">
          Informations à modifier
        </label>
        <SelectField
          id="organizer-workspace-select"
          className="min-w-0"
          value={activeTab}
          options={[
            ...(eventTab ? [{ value: eventTab.id, label: "Commun à toutes les courses" }] : []),
            ...formatTabs.map((tab) => ({ value: tab.id, label: getFormatOptionLabel(tab) })),
            ...(addFormatTab ? [{ value: addFormatTab.id, label: "+ Ajouter un format" }] : []),
          ]}
          onValueChange={onTabChange}
        />
        {!isAddTab ? <div className="mt-2"><label htmlFor="organizer-section-select" className="mb-1.5 block text-sm font-medium text-foreground">Section</label><SelectField id="organizer-section-select" value={activeModule} options={modules.map((module) => ({ value: module.id, label: `${module.title} · ${module.countLabel}` }))} onValueChange={(value) => onSelectModule(value as OrganizerModuleId)} /></div> : null}
      </div>

      <div id="organizer-onboarding-scope-navigation" className="hidden min-[1320px]:block">
        <div className="pb-2">
          {eventTab ? (
            <button
              type="button"
              aria-current={isEventTab ? "page" : undefined}
              onClick={() => onTabChange(eventTab.id)}
              className={cn(
                "flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isEventTab
                  ? "bg-brand-surface text-brand"
                  : "text-foreground hover:bg-muted/50"
              )}
            >
              <span>
                <span className="block text-sm font-semibold">Commun à toutes les courses</span>
                <span className="block text-xs font-normal text-muted-foreground">Événement</span>
              </span>
            </button>
          ) : null}
        </div>
        {isEventTab ? <div className="border-t border-border py-2">{renderModules(completion.eventModules)}</div> : null}

        <div className="min-w-0 border-t border-border pt-2">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Formats de course</p>
          <div className="space-y-1">
            {formatTabs.map((tab) => (
              <div key={tab.id}>
              <button
                type="button"
                aria-current={activeTab === tab.id ? "page" : undefined}
                aria-expanded={activeTab === tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  tab.visibility === "hidden"
                    ? activeTab === tab.id
                      ? "bg-muted text-muted-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                    : activeTab === tab.id
                      ? "bg-muted/60 text-foreground"
                      : "text-foreground hover:bg-muted/50"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block leading-snug">{tab.label}</span>
                  {tab.visibility ? (
                    <span className={cn(
                      "mt-0.5 block text-[11px] font-medium",
                      tab.visibility === "hidden" ? "text-slate-500" : "text-muted-foreground"
                    )}>
                      {FORMAT_VISIBILITY_LABEL[tab.visibility]}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden="true" className={cn("shrink-0 text-muted-foreground transition", activeTab === tab.id && "rotate-90")}>›</span>
              </button>
              {activeTab === tab.id && !isEventTab && !isAddTab ? <div className="mb-1 ml-3 mt-1 border-l border-border pl-2">{renderModules(modules)}</div> : null}
              </div>
            ))}
            {addFormatTab ? (
              <button
                type="button"
                aria-label="Ajouter un format"
                aria-current={isAddTab ? "page" : undefined}
                onClick={() => onTabChange(addFormatTab.id)}
                className={cn(
                    "min-h-10 w-full rounded-lg border border-dashed px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isAddTab
                    ? "border-brand bg-brand-surface text-brand shadow-sm ring-2 ring-brand/25"
                    : "border-border bg-card text-muted-foreground hover:border-brand-border hover:text-foreground"
                )}
              >
                + Ajouter un format
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}

export function OrganizerProgressRail({ completion }: { completion: OrganizerCompletionSummary }) {
  const completed = completion.modules.filter((module) => module.status === "complete").length;
  const total = completion.modules.length;
  const score = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = completion.modules.filter((module) => module.status !== "complete").slice(0, 5);

  return (
    <aside className="space-y-3 min-[1320px]:sticky min-[1320px]:top-3 min-[1320px]:self-start" aria-label="État du Livret coureur">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--brand)) ${score}%, hsl(var(--muted)) ${score}% 100%)` }} aria-label={`${completed} sections complètes sur ${total}`}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-card text-sm font-bold text-foreground">{completed}/{total}</span>
          </div>
          <div><h2 className="font-semibold text-foreground">À faire</h2><p className="text-xs text-muted-foreground">{completion.informationComplete ? "Minimum requis atteint" : "Minimum requis à compléter"}</p></div>
        </div>
        <ul className="mt-4 space-y-2">
          {remaining.length > 0 ? remaining.map((module) => (
            <li key={module.id} className="flex items-start gap-2 text-sm text-foreground"><span className="mt-1 h-3.5 w-3.5 shrink-0 rounded border border-amber-500 bg-amber-50" aria-hidden="true" /><span>{module.title}<span className="ml-1 text-xs text-muted-foreground">{module.countLabel}</span></span></li>
          )) : <li className="text-sm text-emerald-700">Toutes les sections sont renseignées.</li>}
        </ul>
      </section>
    </aside>
  );
}

export function OrganizerModuleGrid({
  modules,
  activeModule,
  dirtyModules,
  onSelectModule,
}: {
  modules: OrganizerCompletionSummary["modules"];
  activeModule: OrganizerModuleId;
  dirtyModules: Set<OrganizerModuleId>;
  onSelectModule: (moduleId: OrganizerModuleId) => void;
}) {
  const isDirty = (moduleId: OrganizerModuleId) => dirtyModules.has(moduleId);
  const getStatusLabel = (module: OrganizerCompletionSummary["modules"][number]) =>
    module.status === "complete" ? "Complet" : module.level === "optional" && module.status === "empty" ? "Optionnel" : "À compléter";

  return (
    <div id="organizer-onboarding-module-tiles" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
      {modules.map((module) => (
        <button
          key={module.id}
          type="button"
          aria-label={`${module.title}. ${getStatusLabel(module)}. ${module.countLabel}. ${module.description}`}
          aria-current={activeModule === module.id ? "true" : undefined}
          className={cn(
            "relative min-h-[64px] rounded-lg border-2 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-md lg:min-w-0",
            module.status === "empty" && "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/30",
            module.status === "incomplete" && "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20",
            module.status === "complete" && "border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20",
            activeModule === module.id && "border-brand shadow-lg ring-2 ring-brand ring-offset-2 ring-offset-card",
            isDirty(module.id) && "after:absolute after:right-3 after:top-3 after:h-2.5 after:w-2.5 after:rounded-full after:bg-amber-500 after:content-[''] after:ring-4 after:ring-amber-500/15"
          )}
          onClick={() => onSelectModule(module.id)}
        >
          <h2 className="pr-5 text-sm font-bold leading-snug text-foreground">{module.title}</h2>
          <p className="mt-1 text-[11px] font-semibold leading-snug text-foreground/80">{getStatusLabel(module)}</p>
          <p className="mt-0.5 text-xs font-medium leading-snug text-muted-foreground">{module.countLabel}</p>
          {isDirty(module.id) ? <span className="sr-only">Modifications à sauvegarder</span> : null}
        </button>
      ))}
    </div>
  );
}

function InlineProgressBar({ score, className }: { score: number; className?: string }) {
  const progressTone = getProgressTone(score);

  return (
    <div className={cn("h-5 overflow-hidden rounded-full", progressTone.track, className)}>
      <div
        className={cn(
          "flex h-full min-w-10 items-center justify-end rounded-full px-2 text-[11px] font-semibold leading-none transition-all",
          progressTone.fill,
          progressTone.text
        )}
        style={{ width: `${score}%` }}
      >
        {score}%
      </div>
    </div>
  );
}
