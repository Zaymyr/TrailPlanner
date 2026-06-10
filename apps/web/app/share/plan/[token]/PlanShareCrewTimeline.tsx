"use client";

import { useMemo, useState } from "react";

import type { PlanShareCrewState, PlanShareSnapshot } from "../../../../lib/plan-share";

type PlanShareCheckpoint = PlanShareSnapshot["checkpoints"][number];
type PlanSharePassage = PlanShareCrewState["passages"][number];

type PlanShareCrewTimelineProps = {
  token: string;
  summary: PlanShareSnapshot;
  departureTime: string | null;
  crewState: PlanShareCrewState;
  locale: "fr" | "en";
};

const COPY = {
  fr: {
    title: "Équipe ravitos",
    liveTitle: "Suivi course",
    departure: "Départ exact",
    saveStart: "Enregistrer",
    saved: "Enregistré",
    saving: "Sauvegarde...",
    resetTracking: "Revenir au prévu",
    startRequired: "Renseigne l'heure de départ avant de valider un passage.",
    saveError: "Impossible d'enregistrer pour le moment.",
    nextPoint: "Prochain point équipe",
    estimatedFrom: "Calculé depuis {name}",
    done: "Ravito fait",
    validatePassage: "Ravito fait",
    revalidatePassage: "Revalider",
    validateFinish: "Arrivée faite",
    planned: "Prévu",
    next: "Prochain",
    noMorePoints: "Tous les points équipe sont validés.",
    delta: "Écart",
    give: "À donner",
    nothingToGive: "Rien à donner",
    assistanceAvailable: "Assistance",
    noAssistance: "Sans assistance",
    water: "Eau",
    pause: "Pause",
    waterFull: "poche pleine {liters} L",
    waterRefill: "remplir la poche",
    waterUnavailable: "pas de recharge eau",
    waterFinish: "arrivée",
    solidUnavailable: "pas de solide",
    dayOffset: "J+{days}",
    remaining: "dans {duration}",
    confirmedAt: "Validé à {time}",
  },
  en: {
    title: "Crew aid stations",
    liveTitle: "Race tracking",
    departure: "Exact start",
    saveStart: "Save",
    saved: "Saved",
    saving: "Saving...",
    resetTracking: "Back to plan",
    startRequired: "Enter the start time before confirming a passage.",
    saveError: "Unable to save right now.",
    nextPoint: "Next crew point",
    estimatedFrom: "Computed from {name}",
    done: "Done",
    validatePassage: "Aid station done",
    revalidatePassage: "Revalidate",
    validateFinish: "Finish done",
    planned: "Planned",
    next: "Next",
    noMorePoints: "All crew points are confirmed.",
    delta: "Offset",
    give: "Give",
    nothingToGive: "Nothing to give",
    assistanceAvailable: "Crew access",
    noAssistance: "No crew access",
    water: "Water",
    pause: "Pause",
    waterFull: "full bladder {liters} L",
    waterRefill: "refill the bladder",
    waterUnavailable: "no water refill",
    waterFinish: "finish",
    solidUnavailable: "no solids",
    dayOffset: "D+{days}",
    remaining: "in {duration}",
    confirmedAt: "Confirmed at {time}",
  },
} as const;

function parseClock(value: string) {
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function resolveClockNearPlanned(clockMinutes: number, plannedAbsoluteMinutes: number) {
  let resolved = clockMinutes;
  while (resolved - plannedAbsoluteMinutes > 720) resolved -= 1440;
  while (plannedAbsoluteMinutes - resolved > 720) resolved += 1440;
  return resolved;
}

function formatDuration(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours <= 0) return `${safeMinutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function formatSignedDuration(totalMinutes: number) {
  const rounded = Math.round(totalMinutes);
  if (rounded === 0) return "0 min";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${formatDuration(Math.abs(rounded))}`;
}

function formatKm(distanceKm: number) {
  const rounded = Number(distanceKm.toFixed(1));
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${formatted} km`;
}

function formatLiters(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function formatAbsoluteClock(totalMinutes: number, locale: "fr" | "en") {
  const rounded = Math.round(totalMinutes);
  const dayOffset = Math.floor(rounded / 1440);
  const clockMinutes = ((rounded % 1440) + 1440) % 1440;
  const clock = `${String(Math.floor(clockMinutes / 60)).padStart(2, "0")}:${String(
    clockMinutes % 60
  ).padStart(2, "0")}`;

  if (dayOffset <= 0) return clock;
  return `${clock} ${COPY[locale].dayOffset.replace("{days}", String(dayOffset))}`;
}

function getWaterInstruction(checkpoint: PlanShareCheckpoint, summary: PlanShareSnapshot, locale: "fr" | "en") {
  const copy = COPY[locale];
  if (checkpoint.waterState === "full") {
    return copy.waterFull.replace("{liters}", formatLiters(summary.waterBagLiters));
  }
  if (checkpoint.waterState === "refill") return copy.waterRefill;
  if (checkpoint.waterState === "finish") return copy.waterFinish;
  return copy.waterUnavailable;
}

function isCrewCheckpoint(checkpoint: PlanShareCheckpoint) {
  return checkpoint.assistanceState === "available" && !checkpoint.isStart && !checkpoint.isFinish;
}

function isTrackableCheckpoint(checkpoint: PlanShareCheckpoint) {
  return isCrewCheckpoint(checkpoint) || checkpoint.isFinish;
}

function getCurrentClockMinutes() {
  const now = new Date();
  return {
    clockMinutes: now.getHours() * 60 + now.getMinutes(),
    iso: now.toISOString(),
  };
}

function normalizePassages(passages: PlanSharePassage[], checkpoints: PlanShareCheckpoint[]) {
  const checkpointOrder = new Map(checkpoints.map((checkpoint, order) => [checkpoint.index, order]));
  const byCheckpoint = new Map<number, PlanSharePassage>();

  for (const passage of passages) {
    if (!checkpointOrder.has(passage.checkpointIndex)) continue;
    byCheckpoint.set(passage.checkpointIndex, {
      checkpointIndex: passage.checkpointIndex,
      actualMinute: Math.max(0, Math.round(passage.actualMinute)),
      confirmedAt: passage.confirmedAt,
    });
  }

  return Array.from(byCheckpoint.values()).sort(
    (a, b) => (checkpointOrder.get(a.checkpointIndex) ?? 0) - (checkpointOrder.get(b.checkpointIndex) ?? 0)
  );
}

export function PlanShareCrewTimeline({
  token,
  summary,
  departureTime,
  crewState,
  locale,
}: PlanShareCrewTimelineProps) {
  const copy = COPY[locale];
  const initialPassages = useMemo(
    () => normalizePassages(crewState.passages, summary.checkpoints),
    [crewState.passages, summary.checkpoints]
  );
  const [startTime, setStartTime] = useState(departureTime ?? "");
  const [savedStartTime, setSavedStartTime] = useState(departureTime ?? "");
  const [passages, setPassages] = useState<PlanSharePassage[]>(initialPassages);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"saved" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passagesByIndex = useMemo(() => {
    return new Map(passages.map((passage) => [passage.checkpointIndex, passage]));
  }, [passages]);

  const timeline = useMemo(() => {
    const startMinutes = parseClock(startTime);
    const startCheckpoint = summary.checkpoints.find((checkpoint) => checkpoint.isStart) ?? summary.checkpoints[0];
    const trackableCheckpoints = summary.checkpoints.filter(isTrackableCheckpoint);
    const confirmedTrackable = trackableCheckpoints.filter((checkpoint) => passagesByIndex.has(checkpoint.index));
    const anchorCheckpoint = confirmedTrackable[confirmedTrackable.length - 1] ?? startCheckpoint;
    const anchorPassage = passagesByIndex.get(anchorCheckpoint.index) ?? null;
    const anchorActualMinute = anchorPassage?.actualMinute ?? 0;
    const anchorAbsolute = startMinutes !== null ? startMinutes + anchorActualMinute : null;
    const nextCheckpoint =
      trackableCheckpoints.find(
        (checkpoint) => checkpoint.index > anchorCheckpoint.index && !passagesByIndex.has(checkpoint.index)
      ) ?? null;

    const getCheckpointAbsolute = (checkpoint: PlanShareCheckpoint) => {
      const confirmed = passagesByIndex.get(checkpoint.index);
      if (startMinutes === null) return null;
      if (confirmed) return startMinutes + confirmed.actualMinute;
      if (checkpoint.index >= anchorCheckpoint.index) {
        return startMinutes + anchorActualMinute + checkpoint.arrivalMinute - anchorCheckpoint.arrivalMinute;
      }
      return startMinutes + checkpoint.arrivalMinute;
    };

    const nextAbsolute = nextCheckpoint ? getCheckpointAbsolute(nextCheckpoint) : null;
    const delta =
      anchorPassage && startMinutes !== null
        ? anchorPassage.actualMinute - anchorCheckpoint.arrivalMinute
        : null;

    return {
      startMinutes,
      anchorCheckpoint,
      anchorPassage,
      anchorAbsolute,
      nextCheckpoint,
      nextAbsolute,
      delta,
      getCheckpointAbsolute,
    };
  }, [passagesByIndex, startTime, summary.checkpoints]);

  async function persistCrewState(nextPassages: PlanSharePassage[], nextStartTime: string, key: string) {
    setSavingKey(key);
    setError(null);
    setFeedback(null);

    const normalizedStartTime = nextStartTime.trim() || null;
    const normalizedPassages = normalizePassages(nextPassages, summary.checkpoints);

    try {
      const response = await fetch("/api/plan-shares/crew-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          departureTime: normalizedStartTime,
          crewState: { passages: normalizedPassages },
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            departureTime?: string | null;
            crewState?: PlanShareCrewState;
          }
        | null;

      if (!response.ok || !data?.crewState) {
        throw new Error("Unable to persist crew state");
      }

      const nextSavedStartTime = data.departureTime ?? "";
      setSavedStartTime(nextSavedStartTime);
      setStartTime(nextSavedStartTime);
      setPassages(normalizePassages(data.crewState.passages, summary.checkpoints));
      setFeedback("saved");
    } catch {
      setError(copy.saveError);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveStartTime() {
    if (startTime && parseClock(startTime) === null) {
      setError(copy.startRequired);
      return;
    }

    await persistCrewState(passages, startTime, "start");
  }

  async function handleConfirmPassage(checkpoint: PlanShareCheckpoint) {
    const startMinutes = parseClock(startTime);
    if (startMinutes === null) {
      setError(copy.startRequired);
      return;
    }

    const now = getCurrentClockMinutes();
    const plannedAbsolute = startMinutes + checkpoint.arrivalMinute;
    const actualAbsolute = resolveClockNearPlanned(now.clockMinutes, plannedAbsolute);
    const nextPassage: PlanSharePassage = {
      checkpointIndex: checkpoint.index,
      actualMinute: Math.max(0, Math.round(actualAbsolute - startMinutes)),
      confirmedAt: now.iso,
    };
    const nextPassages = [...passages.filter((passage) => passage.checkpointIndex !== checkpoint.index), nextPassage];

    await persistCrewState(nextPassages, startTime, `checkpoint-${checkpoint.index}`);
  }

  async function handleResetTracking() {
    if (startTime && parseClock(startTime) === null) {
      setError(copy.startRequired);
      return;
    }

    await persistCrewState([], startTime, "reset");
  }

  const startCanSave = startTime !== savedStartTime && (!startTime || parseClock(startTime) !== null);
  const canResetTracking = passages.length > 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-foreground">{copy.liveTitle}</h2>
          {canResetTracking ? (
            <button
              type="button"
              disabled={savingKey !== null}
              onClick={handleResetTracking}
              className="min-h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingKey === "reset" ? copy.saving : copy.resetTracking}
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-muted-foreground">
              {copy.departure}
              <input
                type="time"
                step="60"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setFeedback(null);
                  setError(null);
                }}
                className="min-h-12 rounded-lg border border-border bg-background px-3 font-mono text-base font-bold text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <button
              type="button"
              disabled={!startCanSave || savingKey !== null}
              onClick={handleSaveStartTime}
              className="min-h-11 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingKey === "start" ? copy.saving : copy.saveStart}
            </button>
            {feedback === "saved" && !error ? <p className="text-xs font-semibold text-brand">{copy.saved}</p> : null}
            {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          </div>

          <div className="rounded-lg bg-brand-surface p-4">
            <p className="text-xs font-semibold uppercase text-brand">{copy.nextPoint}</p>
            {timeline.nextCheckpoint ? (
              <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-lg font-bold text-foreground">{timeline.nextCheckpoint.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {copy.estimatedFrom.replace("{name}", timeline.anchorCheckpoint.name)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  {timeline.nextAbsolute !== null ? (
                    <p className="font-mono text-2xl font-bold text-brand">
                      {formatAbsoluteClock(timeline.nextAbsolute, locale)}
                    </p>
                  ) : (
                    <p className="font-mono text-2xl font-bold text-brand">
                      T+{formatDuration(timeline.nextCheckpoint.arrivalMinute)}
                    </p>
                  )}
                  {timeline.anchorAbsolute !== null && timeline.nextAbsolute !== null ? (
                    <p className="text-sm text-muted-foreground">
                      {copy.remaining.replace(
                        "{duration}",
                        formatDuration(timeline.nextAbsolute - timeline.anchorAbsolute)
                      )}
                    </p>
                  ) : null}
                  {timeline.delta !== null ? (
                    <p className="text-sm text-muted-foreground">
                      {copy.delta} {formatSignedDuration(timeline.delta)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-1 text-lg font-bold text-foreground">{copy.noMorePoints}</p>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground">{copy.title}</h2>
      <div className="grid gap-3">
        {summary.checkpoints.map((checkpoint) => {
          const waterInstruction = getWaterInstruction(checkpoint, summary, locale);
          const checkpointAbsolute = timeline.getCheckpointAbsolute(checkpoint);
          const confirmedPassage = passagesByIndex.get(checkpoint.index) ?? null;
          const isNoAssistance = checkpoint.assistanceState === "unavailable";
          const isAssistancePoint = isCrewCheckpoint(checkpoint);
          const isTrackable = isTrackableCheckpoint(checkpoint);
          const isNext = timeline.nextCheckpoint !== null && checkpoint.index === timeline.nextCheckpoint.index;
          const shouldShowGiveBlock = !isNoAssistance;
          const canValidate = isTrackable && !checkpoint.isStart;
          const cardIsSaving = savingKey === `checkpoint-${checkpoint.index}`;
          const cardClasses = isAssistancePoint
            ? "border-brand-border bg-brand-surface shadow-sm"
            : isNoAssistance
              ? "border-border bg-muted/60 opacity-80"
              : "border-border bg-card";

          return (
            <article key={`${checkpoint.index}-${checkpoint.name}`} className={`rounded-lg border p-4 ${cardClasses}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`break-words text-lg font-bold ${
                        isNoAssistance ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {checkpoint.name}
                    </h3>
                    {confirmedPassage ? (
                      <span className="rounded-full border border-brand bg-brand px-2 py-0.5 text-xs font-bold text-brand-foreground">
                        {copy.done}
                      </span>
                    ) : isNext ? (
                      <span className="rounded-full border border-brand-border bg-brand-surface px-2 py-0.5 text-xs font-bold text-brand">
                        {copy.next}
                      </span>
                    ) : isNoAssistance ? (
                      <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-xs font-bold text-muted-foreground">
                        {copy.planned}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-mono text-sm text-muted-foreground">
                    {formatKm(checkpoint.distanceKm)} - T+{formatDuration(checkpoint.arrivalMinute)}
                    {checkpointAbsolute !== null ? ` / ${formatAbsoluteClock(checkpointAbsolute, locale)}` : ""}
                  </p>
                  {confirmedPassage && checkpointAbsolute !== null ? (
                    <p className="mt-1 text-sm font-semibold text-brand">
                      {copy.confirmedAt.replace("{time}", formatAbsoluteClock(checkpointAbsolute, locale))}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                      {copy.water}: {waterInstruction}
                    </span>
                    {checkpoint.solidState === "unavailable" ? (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                        {copy.solidUnavailable}
                      </span>
                    ) : null}
                    {checkpoint.assistanceState === "available" || checkpoint.assistanceState === "start" ? (
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${
                          isAssistancePoint
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-brand-border bg-brand-surface text-brand"
                        }`}
                      >
                        {copy.assistanceAvailable}
                      </span>
                    ) : checkpoint.assistanceState === "unavailable" ? (
                      <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-bold text-muted-foreground">
                        {copy.noAssistance}
                      </span>
                    ) : null}
                    {checkpoint.pauseMinutes > 0 ? (
                      <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                        {copy.pause} +{Math.round(checkpoint.pauseMinutes)} min
                      </span>
                    ) : null}
                  </div>

                  {canValidate ? (
                    <button
                      type="button"
                      disabled={savingKey !== null}
                      onClick={() => handleConfirmPassage(checkpoint)}
                      className="min-h-11 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cardIsSaving
                        ? copy.saving
                        : confirmedPassage
                          ? checkpoint.isFinish
                            ? copy.validateFinish
                            : copy.revalidatePassage
                          : checkpoint.isFinish
                            ? copy.validateFinish
                            : copy.validatePassage}
                    </button>
                  ) : null}
                </div>
              </div>

              {shouldShowGiveBlock ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{copy.give}</p>
                  {checkpoint.supplies.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">{copy.nothingToGive}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {checkpoint.supplies.map((product) => (
                        <span
                          key={product.productId}
                          className="inline-flex max-w-full items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground"
                        >
                          <span className="truncate">{product.name}</span>
                          <span className="font-mono font-bold text-brand">x{product.quantity}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
