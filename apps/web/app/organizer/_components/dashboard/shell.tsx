import Link from "next/link";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { TabsList } from "../../../../components/ui/tabs";
import { cn } from "../../../../components/utils";
import type { OrganizerCompletionSummary, OrganizerModuleId } from "../completion";
import { ADD_FORMAT_TAB_ID, EVENT_TAB_ID } from "./constants";
import { formatEventDateRange } from "./helpers";
import type { ClaimRow, MembershipRow, OrganizerEventDetail, RaceFormat } from "./types";
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
            <Button variant="outline">Demander un claim</Button>
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
          <CardDescription>Aucune course approuvée pour ce compte.</CardDescription>
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
            <p className="text-sm text-muted-foreground">Tu n&apos;as pas encore de demande.</p>
          ) : null}
          <Link href="/organizers">
            <Button>Demander un claim</Button>
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
  onSelectedEventChange,
  completion,
  hasDirtyChanges,
  status,
  onSaveAll,
  onPreview,
  onTogglePublish,
  onToggleRacePublish,
}: {
  selectedMembership: MembershipRow | null;
  event: OrganizerEventDetail | null;
  memberships: MembershipRow[];
  selectedEventId: string | null;
  onSelectedEventChange: (eventId: string) => void;
  completion: OrganizerCompletionSummary | null;
  hasDirtyChanges: boolean;
  status: "idle" | "loading" | "saving" | "uploading";
  onSaveAll: () => void;
  onPreview: () => void;
  onTogglePublish: () => void;
  onToggleRacePublish: (raceId: string, nextIsLive: boolean) => void;
}) {
  const eventScore = completion?.raceProgressScore ?? 0;
  const raceProgress = completion?.raceProgress ?? [];
  const raceRows = (event?.races ?? []).map((race) => ({
    ...race,
    score: raceProgress.find((entry) => entry.id === race.id)?.score ?? 0,
  }));
  const isLive = event?.is_live !== false;
  const dateLabel = formatEventDateRange(event);

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
          <Link href="/organizers">
            <Button variant="outline">Nouveau claim</Button>
          </Link>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-foreground">
          <span className={cn("h-2.5 w-2.5 rounded-full", isLive ? "bg-emerald-500" : "bg-muted-foreground")} />
          {isLive ? "Live" : "Brouillon"}
        </span>
        <span className="text-muted-foreground">{event?.races.length ?? 0} formats</span>
      </div>

      <div className="mt-3 space-y-2">
        <div className="grid gap-3 rounded-md border border-border/70 bg-background/80 p-3 md:grid-cols-[minmax(0,14rem)_minmax(140px,1fr)_auto] md:items-center">
          <span className="min-w-0 text-lg font-semibold text-foreground">
            {selectedMembership?.race_events?.name ?? event?.name ?? "Événement"}
          </span>
          <InlineProgressBar score={eventScore} className="min-w-[140px] flex-1" />
          <LiveToggle checked={isLive} disabled={status === "saving"} onChange={() => onTogglePublish()} />
        </div>
        {raceRows.length > 0 ? (
          raceRows.map((race) => (
            <div
              key={race.id}
              className="grid gap-3 rounded-md border border-border/60 bg-background/50 p-3 text-sm md:grid-cols-[minmax(0,14rem)_minmax(140px,1fr)_auto] md:items-center"
            >
              <span className="min-w-0 font-medium text-foreground">{race.name || "Course sans nom"}</span>
              <InlineProgressBar score={race.score} className="min-w-[140px] flex-1" />
              <LiveToggle
                checked={race.is_live}
                disabled={status === "saving"}
                onChange={() => onToggleRacePublish(race.id, !race.is_live)}
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Aucune course pour le moment.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onPreview} variant="outline">
          Prévisualiser côté coureur
        </Button>
        <Button type="button" onClick={onSaveAll} disabled={!hasDirtyChanges || status === "saving"}>
          {status === "saving" ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>
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
  const description = isEventTab
    ? "Informations communes à tous les formats."
    : activeRace
      ? "Informations propres au format sélectionné."
      : "Crée un nouveau format depuis le formulaire ci-dessous.";

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Avancement global</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <TabsList tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
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
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {modules.map((module) => (
        <button
          key={module.id}
          type="button"
          aria-label={`${module.title}. ${module.description}`}
          className={cn(
            "min-h-[112px] rounded-lg border bg-card p-3 text-left transition hover:border-brand-border hover:shadow-sm",
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
