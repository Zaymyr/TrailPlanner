import * as React from "react";
import Link from "next/link";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { cn } from "../../../../components/utils";
import type { OrganizerCompletionSummary, OrganizerModuleId } from "../completion";
import { ADD_FORMAT_TAB_ID, EVENT_TAB_ID } from "./constants";
import { buildEditionYearOptions, formatEventDateRange, getRaceEditionYear, getRaceEditionYearLabel, groupRacesBySeries } from "./helpers";
import type { ClaimRow, EditionRequestRow, MembershipRow, OrganizerEventDetail, PublicationRequestRow, RaceFormat } from "./types";
import { LevelBadge, LiveToggle, StatusBadge } from "./controls";

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
          <Link href="/sign-in">
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
  completion,
  hasDirtyChanges,
  status,
  onSaveAll,
  onNotifyFollowers,
  onRequestPublication,
  onRacebookVisibilityChange,
  onDeleteEvent,
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
  onImportWebsite: () => void;
  completion: OrganizerCompletionSummary | null;
  hasDirtyChanges: boolean;
  status: "idle" | "loading" | "saving" | "uploading";
  onSaveAll: () => void;
  onNotifyFollowers: () => void;
  onRequestPublication: (raceId: string) => void;
  onRacebookVisibilityChange: (raceId: string, isLive: boolean) => void;
  onDeleteEvent: () => Promise<boolean>;
}) {
  const [newEditionDialogOpen, setNewEditionDialogOpen] = React.useState(false);
  const [duplicatePreviousEdition, setDuplicatePreviousEdition] = React.useState(true);
  const [deleteEventDialogOpen, setDeleteEventDialogOpen] = React.useState(false);
  const [deleteEventConfirmation, setDeleteEventConfirmation] = React.useState("");
  const eventScore = completion?.raceProgressScore ?? 0;
  const raceProgress = completion?.raceProgress ?? [];
  const editionYearOptions = buildEditionYearOptions(event?.races ?? [], event?.editions ?? [], editionRequests, selectedEventId);
  const raceRows = groupRacesBySeries(event?.races ?? []).map((group) => {
    const activeEdition =
      group.races.find((race) => getRaceEditionYear(race, event?.editions) === selectedEditionYear) ??
      group.races[0] ??
      null;
    const activeProgress = activeEdition ? raceProgress.find((entry) => entry.id === activeEdition.id)?.score ?? 0 : 0;
    return {
      id: group.id,
      label: group.seriesName,
      score: activeProgress,
      activeEdition,
    };
  });
  const isLive = event?.is_live !== false;
  const publicationPending = publicationRequestStates.some((request) => request.status === "pending");
  const dateLabel = formatEventDateRange(event, selectedEditionYear);

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand dark:text-emerald-300">Dashboard organisateur</p>
          <p className="mt-1 text-sm text-muted-foreground dark:text-slate-300">
            {[event?.location, dateLabel].filter(Boolean).join(" - ") || "Lieu et dates à compléter"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            aria-label="Supprimer la course sélectionnée"
            title="Supprimer la course sélectionnée"
            onClick={() => {
              setDeleteEventConfirmation("");
              setDeleteEventDialogOpen(true);
            }}
            disabled={!selectedEventId || status !== "idle"}
            className="w-10 shrink-0 border-red-300 px-0 text-xl leading-none text-red-700 hover:border-red-400 hover:bg-red-50 hover:text-red-800"
          >
            ×
          </Button>
          <select
            className="h-10 rounded-md border border-border bg-card px-3 text-sm"
            value={selectedEventId ?? ""}
            onChange={(selectEvent) => onSelectedEventChange(selectEvent.target.value)}
          >
            {memberships.map((membership) => (
              <option key={membership.id} value={membership.event_id}>
                {membership.race_events?.name ?? membership.event_id}
              </option>
            ))}
          </select>
          <span
            className={cn(
              "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
              completion?.informationComplete
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-amber-300 bg-amber-50 text-amber-800"
            )}
          >
            {completion?.informationComplete ? "Informations renseignées" : "À compléter"}
          </span>
          <Link href="/organizers">
            <Button variant="outline">Ajouter une course</Button>
          </Link>
          <Button type="button" variant="outline" onClick={onImportWebsite}>
            Importer depuis un site web
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-foreground">
          <span className={cn("h-2.5 w-2.5 rounded-full", isLive ? "bg-emerald-500" : "bg-muted-foreground")} />
          {isLive ? "Course visible" : "Course masquée"}
        </span>
        <span className="text-muted-foreground">{event?.races.length ?? 0} formats</span>
      </div>

      <div className="mt-3 space-y-2">
        {editionYearOptions.length > 0 ? (
          <div className="rounded-md border border-border/60 bg-background/50 p-2.5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-[9rem] max-w-[12rem] flex-1">
                <label htmlFor="organizer-event-edition-select" className="text-sm font-medium text-foreground">
                  Édition
                </label>
                <select
                  id="organizer-event-edition-select"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                  value={selectedEditionYear}
                  onChange={(event) => onSelectedEditionYearChange(event.target.value)}
                >
                  {editionYearOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDuplicatePreviousEdition(true);
                  setNewEditionDialogOpen(true);
                }}
                disabled={status !== "idle"}
              >
                Créer une nouvelle édition
              </Button>
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 rounded-md border border-border/70 bg-background/80 p-3 md:grid-cols-[minmax(0,14rem)_minmax(140px,1fr)_auto] md:items-center">
          <span className="min-w-0 text-lg font-semibold text-foreground">
            {selectedMembership?.race_events?.name ?? event?.name ?? "Événement"}
          </span>
          <InlineProgressBar score={eventScore} className="min-w-[140px] flex-1" />
          <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", isLive ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-border bg-muted text-muted-foreground")}>
            {isLive ? "Course visible" : "Course masquée"}
          </span>
        </div>
        {raceRows.length > 0 ? (
          raceRows.map((race) => {
            const racePublicationPending = publicationRequestStates.some(
              (request) => request.status === "pending" && (!request.race_id || request.race_id === race.activeEdition?.id)
            );
            return (
            <div
              key={race.id}
              className="grid gap-3 rounded-md border border-border/60 bg-background/50 p-3 text-sm md:grid-cols-[minmax(0,14rem)_minmax(140px,1fr)_auto] md:items-center"
            >
              <span className="min-w-0 font-medium text-foreground">
                {race.label || "Format sans nom"}
                {race.activeEdition ? ` · ${getRaceEditionYearLabel(race.activeEdition.race_date)}` : ""}
              </span>
              <InlineProgressBar score={race.score} className="min-w-[140px] flex-1" />
              {race.activeEdition?.racebook_publication_approved_at ? (
                <LiveToggle
                  checked={race.activeEdition.racebook_is_live === true}
                  disabled={status !== "idle"}
                  onChange={(checked) => onRacebookVisibilityChange(race.activeEdition!.id, checked)}
                  liveLabel="Racebook publié"
                  draftLabel="Racebook masqué"
                />
              ) : (
                <LiveToggle
                  checked={false}
                  disabled={racePublicationPending || status !== "idle"}
                  onChange={() => onRequestPublication(race.activeEdition!.id)}
                  draftLabel={racePublicationPending ? "Demande en cours" : "Demander la publication"}
                />
              )}
            </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">Aucune course pour le moment.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {publicationPending ? (
          <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Publication en attente de validation admin
          </span>
        ) : null}
        <Button type="button" onClick={onNotifyFollowers} variant="outline" disabled={!event}>
          Notifier les coureurs
        </Button>
        <Button type="button" onClick={onSaveAll} disabled={!hasDirtyChanges || status === "saving"}>
          {status === "saving" ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>

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
              />
              <span>
                <span className="block font-medium">Dupliquer depuis l’édition précédente</span>
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

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-2 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "rounded-t-lg border border-transparent px-5 py-3 text-base font-semibold transition-colors focus:outline-none",
                activeTab === tab.id
                  ? "border-brand border-b-card bg-brand-surface text-brand shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
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
        <div className="mt-3 rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
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

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      {modules.map((module) => (
        <button
          key={module.id}
          type="button"
          aria-label={`${module.title}. ${module.description}`}
          className={cn(
            "min-h-[112px] rounded-lg border bg-card p-3 text-left transition hover:border-brand-border hover:shadow-sm lg:min-w-0",
            module.status === "complete" && activeModule !== module.id && "border-emerald-300",
            activeModule === module.id && "border-brand bg-brand-surface/60 ring-2 ring-brand/30 shadow-sm",
            isDirty(module.id) && module.status !== "complete" && "border-amber-300"
          )}
          onClick={() => onSelectModule(module.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <StatusBadge status={module.status} />
            <LevelBadge level={module.level} />
          </div>
          <h2 className="mt-2 text-sm font-semibold leading-snug text-foreground">{module.title}</h2>
          {module.missingLabels?.length ? (
            <p className="mt-2 line-clamp-2 text-[11px] font-medium text-amber-700">
              Manque : {module.missingLabels.slice(0, 3).join(", ")}
              {module.missingLabels.length > 3 ? "..." : ""}
            </p>
          ) : null}
          <div className="mt-4 flex items-end justify-between gap-2">
            <span className="text-xs font-medium text-foreground">{module.countLabel}</span>
            <span className="text-xs font-semibold text-brand">{isDirty(module.id) ? "À sauvegarder" : "Modifier"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function InlineProgressBar({ score, className }: { score: number; className?: string }) {
  const progressTone = getProgressTone(score);

  return (
    <div className={cn("h-6 overflow-hidden rounded-full", progressTone.track, className)}>
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
