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
import type { ClaimRow, EditionRequestRow, MembershipRow, OrganizerEventDetail, PublicationRequestRow, RaceFormat } from "./types";
import { ContextualHelp, LiveToggle, RacebookVisibilityControl } from "./controls";
import type { RacebookVisibilityState } from "./controls";

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
  hasDirtyChanges,
  hasAnyDirtyChanges,
  status,
  activeRaceId,
  onSaveAll,
  onNotifyFollowers,
  onRequestPublication,
  onRacebookVisibilityChange,
  onEditionVisibilityChange,
  onDeleteEdition,
  onDeleteEvent,
  onReplayOnboarding,
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
  hasDirtyChanges: boolean;
  hasAnyDirtyChanges: boolean;
  status: "idle" | "loading" | "saving" | "uploading";
  activeRaceId?: string | null;
  onSaveAll: () => void;
  onNotifyFollowers: (raceId?: string) => void;
  onRequestPublication: () => void;
  onRacebookVisibilityChange: (raceId: string, state: RacebookVisibilityState) => void;
  onEditionVisibilityChange: (isVisible: boolean) => Promise<boolean>;
  onDeleteEdition: () => Promise<boolean>;
  onDeleteEvent: () => Promise<boolean>;
  onReplayOnboarding: () => void;
}) {
  const [newEditionDialogOpen, setNewEditionDialogOpen] = React.useState(false);
  const [duplicatePreviousEdition, setDuplicatePreviousEdition] = React.useState(true);
  const [deleteEventDialogOpen, setDeleteEventDialogOpen] = React.useState(false);
  const [deleteEventConfirmation, setDeleteEventConfirmation] = React.useState("");
  const [deleteEditionDialogOpen, setDeleteEditionDialogOpen] = React.useState(false);
  const [deleteEditionConfirmation, setDeleteEditionConfirmation] = React.useState("");
  const [isSummaryExpanded, setIsSummaryExpanded] = React.useState(false);
  const eventScore = completion?.raceProgressScore ?? 0;
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
  const dateLabel = formatEventDateRange(event, selectedEditionYear);
  const selectedEdition = getEventEdition(event, selectedEditionYear);
  const editionIsVisible = selectedEdition?.is_visible !== false;
  const editionTier = selectedEdition?.entitlement?.status === "active" ? selectedEdition.entitlement.tier : "visibility";
  const canPublishRacebook = editionTier !== "visibility";
  const entitlementSource = selectedEdition?.entitlement?.source;
  const isComplimentaryOffer = entitlementSource === "admin" || entitlementSource === "legacy_admin";
  const offerStatusLabel = entitlementSource === "stripe"
    ? "Paiement confirmé"
    : isComplimentaryOffer && editionTier !== "visibility"
      ? `Offre ${ORGANIZER_TIER_LABEL[editionTier]} offerte — valeur : ${ORGANIZER_TIER_PRICE_EUR[editionTier]} € HT`
        : "Aucun paiement actif";
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div id="organizer-onboarding-overview" className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand dark:text-emerald-300">Espace organisateur</p>
          <h1 className="mt-1 truncate text-xl font-semibold text-foreground">
            {selectedMembership?.race_events?.name ?? event?.name ?? "Événement"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[event?.location, dateLabel].filter(Boolean).join(" · ") || "Lieu et dates à compléter"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {raceRows.length > 0 ? (
            <Button type="button" onClick={onRequestPublication} disabled={!editionIsVisible || status !== "idle"} className="!h-11" title="Publier les formats complets sélectionnés pour cette édition.">
              {canPublishRacebook ? "Publier" : "Choisir une offre"}
            </Button>
          ) : null}
          <details className="group relative">
            <summary title="Ouvrir les actions utilisées moins souvent." className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring marker:content-none">
              Actions
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4 transition group-open:rotate-180">
                <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="absolute right-0 z-30 mt-2 grid w-64 gap-1 rounded-lg border border-border bg-card p-2 shadow-xl">
              <Button type="button" variant="ghost" onClick={() => onNotifyFollowers(activeRaceId ?? undefined)} disabled={!event} className="!justify-start" title="Envoyer une actualité aux coureurs qui suivent l’événement.">
                Notifier les coureurs
              </Button>
              {onImportWebsite ? (
                <Button type="button" variant="ghost" onClick={onImportWebsite} className="!justify-start" title="Préremplir le RaceBook depuis les sources officielles.">{importWebsiteLabel}</Button>
              ) : null}
              <Button
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
              <Link href="/organizers" title="Créer un événement distinct de celui actuellement sélectionné." className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                <span className="flex h-10 items-center px-4 text-sm font-semibold text-foreground hover:bg-muted/40">Créer un autre événement</span>
              </Link>
              <Button
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
              <div className="my-1 border-t border-border" />
              <Button
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

      <div id="organizer-onboarding-selectors" className="mt-5 grid max-w-2xl gap-3 border-t border-border pt-4 md:grid-cols-[minmax(16rem,28rem)_10rem]">
        <OrganizerEventCombobox
          memberships={memberships}
          selectedEventId={selectedEventId}
          onSelectedEventChange={onSelectedEventChange}
        />
        <div>
          <label htmlFor="organizer-event-edition-select" className="mb-1 block text-xs font-medium text-muted-foreground">Édition</label>
          <select id="organizer-event-edition-select" title="Changer l’année à modifier sans changer d’événement." className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground" value={selectedEditionYear} onChange={(selectEvent) => onSelectedEditionYearChange(selectEvent.target.value)}>
            {editionYearOptions.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">Préparation</span>
        <InlineProgressBar score={eventScore} className="min-w-[12rem] flex-1" />
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", completion?.informationComplete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>{completion?.informationComplete ? "Prêt à publier" : "À compléter"}</span>
      </div>

      <details open={isSummaryExpanded} onToggle={(toggleEvent) => setIsSummaryExpanded(toggleEvent.currentTarget.open)} className="group mt-2">
        <summary id="organizer-onboarding-visibility" className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md px-2 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring marker:content-none">
          Gérer la visibilité
          <span className="font-normal text-muted-foreground">{raceRows.length} format{raceRows.length > 1 ? "s" : ""}</span>
          <span className="ml-auto text-xs text-muted-foreground">{isSummaryExpanded ? "Fermer" : "Ouvrir"}</span>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>

        <div className="mt-2 space-y-2 rounded-lg border border-border bg-background/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">Catalogue</p>
              <ContextualHelp text="Masquer l’édition retire ses courses du catalogue et ses RaceBooks du public. Les données restent conservées." />
            </div>
            <LiveToggle checked={editionIsVisible} disabled={!selectedEdition || status !== "idle"} onChange={(checked) => void onEditionVisibilityChange(checked)} liveLabel="Visible" draftLabel="Masquée" description="Afficher ou masquer toutes les courses de cette édition dans le catalogue." />
          </div>
          {raceRows.length > 0 ? raceRows.map((race) => {
            const visibilityState: RacebookVisibilityState = race.activeEdition!.racebook_is_live === true
              ? "public"
              : race.activeEdition!.racebook_preview_is_visible === false
                ? "hidden"
                : "private";
            return (
              <div key={race.id} className="grid gap-3 rounded-lg border border-border/60 bg-card p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{race.label || "Format sans nom"}</p>
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
              </div>
            );
          }) : <p className="text-sm text-muted-foreground">Aucune course pour le moment.</p>}
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">{ORGANIZER_TIER_LABEL[editionTier]}</strong>
            <ContextualHelp text={offerStatusLabel} label="Détail de l’offre" />
          </div>
        </div>
      </details>

      {hasAnyDirtyChanges || status === "saving" ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 top-20 z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-lg border border-amber-300 bg-card p-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-6 sm:top-auto sm:mx-0 sm:min-w-96"
        >
          <p className="min-w-0 text-sm font-medium text-foreground">
            {status === "saving"
              ? "Sauvegarde en cours…"
              : hasDirtyChanges
                ? "Modifications non enregistrées"
                : "Une autre section contient des modifications non enregistrées."}
          </p>
          {hasDirtyChanges || status === "saving" ? (
            <Button type="button" onClick={onSaveAll} disabled={status === "saving"} className="!h-11 shrink-0">
              {status === "saving" ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Dialog open={newEditionDialogOpen} onOpenChange={setNewEditionDialogOpen}>
        <DialogContent>
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void onRequestEdition(duplicatePreviousEdition).then((created) => {
                if (created) setNewEditionDialogOpen(false);
              });
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
                disabled={ORGANIZER_TIER_RANK[editionTier] < ORGANIZER_TIER_RANK.complete}
              />
              <span>
                <span className="block font-medium">Dupliquer depuis l’édition précédente {ORGANIZER_TIER_RANK[editionTier] < ORGANIZER_TIER_RANK.complete ? "— Complet" : ""}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Reprend les formats de l’édition {selectedEditionYear} dans la nouvelle édition.
                </span>
              </span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewEditionDialogOpen(false)} disabled={status !== "idle"}>
                Annuler
              </Button>
              <Button type="submit" disabled={status !== "idle"}>
                {status === "saving" ? "Création..." : "Créer l’édition"}
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
                Tous les formats de cette édition, leurs Racebooks, GPX et données organisateur seront supprimés. Les plans déjà créés resteront disponibles sans lien vers leur course source. Cette action est irréversible.
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
  tabs: Array<{ id: string; label: string }>;
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

  return (
    <section className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
      <div id="organizer-onboarding-scope-navigation" className="md:hidden">
        <label htmlFor="organizer-workspace-select" className="mb-1.5 block text-sm font-medium text-foreground">
          Informations à modifier
        </label>
        <select
          id="organizer-workspace-select"
          className="h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground"
          value={activeTab}
          onChange={(event) => onTabChange(event.target.value)}
        >
          {eventTab ? (
            <optgroup label="Informations communes">
              <option value={eventTab.id}>Commun à toutes les courses</option>
            </optgroup>
          ) : null}
          <optgroup label="Formats de course">
            {formatTabs.map((tab) => <option key={tab.id} value={tab.id}>Format · {tab.label}</option>)}
            {addFormatTab ? <option value={addFormatTab.id}>+ Ajouter un format</option> : null}
          </optgroup>
        </select>
      </div>

      <div id="organizer-onboarding-scope-navigation" className="hidden gap-4 border-b border-border pb-4 md:grid lg:grid-cols-[minmax(14rem,0.8fr)_minmax(0,3fr)]">
        <div className="rounded-xl bg-muted/40 p-2">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Informations communes</p>
          {eventTab ? (
            <button
              type="button"
              aria-current={isEventTab ? "page" : undefined}
              onClick={() => onTabChange(eventTab.id)}
              className={cn(
                "flex min-h-14 w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isEventTab
                  ? "border-brand bg-brand-surface text-brand shadow-sm ring-2 ring-brand/25"
                  : "border-transparent bg-card text-foreground hover:border-brand-border"
              )}
            >
              <span>
                <span className="block text-sm font-semibold">Commun à toutes les courses</span>
                <span className="block text-xs font-normal text-muted-foreground">Événement</span>
              </span>
              {isEventTab ? <span className="h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-brand/15" aria-hidden="true" /> : null}
            </button>
          ) : null}
        </div>

        <div className="min-w-0 rounded-xl bg-muted/20 p-2">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Formats de course</p>
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
            {formatTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? "page" : undefined}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "inline-flex min-h-14 shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  activeTab === tab.id
                    ? "border-brand bg-brand-surface text-brand shadow-sm ring-2 ring-brand/25"
                    : "border-transparent bg-card text-foreground hover:border-brand-border"
                )}
              >
                {tab.label}
                {activeTab === tab.id ? <span className="h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-brand/15" aria-hidden="true" /> : null}
              </button>
            ))}
            {addFormatTab ? (
              <button
                type="button"
                aria-label="Ajouter un format"
                aria-current={isAddTab ? "page" : undefined}
                onClick={() => onTabChange(addFormatTab.id)}
                className={cn(
                  "min-h-14 shrink-0 rounded-lg border border-dashed px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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

      {!isAddTab ? (
        <OrganizerModuleGrid
          modules={modules}
          activeModule={activeModule}
          dirtyModules={dirtyModules}
          onSelectModule={onSelectModule}
        />
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Renseigne le nouveau format dans le formulaire ci-dessous. Ses tuiles apparaîtront après création.
        </div>
      )}
    </section>
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
  const statusLabels = {
    empty: "Aucune information",
    incomplete: "Partiellement complété",
    complete: "Complet",
  } as const;

  return (
    <div id="organizer-onboarding-module-tiles" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
      {modules.map((module) => (
        <button
          key={module.id}
          type="button"
          aria-label={`${module.title}. ${statusLabels[module.status]}. ${module.countLabel}. ${module.description}`}
          aria-current={activeModule === module.id ? "true" : undefined}
          className={cn(
            "relative min-h-[82px] rounded-lg border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md lg:min-w-0",
            module.status === "empty" && "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/30",
            module.status === "incomplete" && "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20",
            module.status === "complete" && "border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20",
            activeModule === module.id && "border-brand shadow-lg ring-2 ring-brand ring-offset-2 ring-offset-card",
            isDirty(module.id) && "after:absolute after:right-3 after:top-3 after:h-2.5 after:w-2.5 after:rounded-full after:bg-amber-500 after:content-[''] after:ring-4 after:ring-amber-500/15"
          )}
          onClick={() => onSelectModule(module.id)}
        >
          <h2 className="pr-5 text-sm font-bold leading-snug text-foreground">{module.title}</h2>
          <p className="mt-1.5 text-xs font-medium leading-snug text-muted-foreground">{module.countLabel}</p>
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
