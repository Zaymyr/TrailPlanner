"use client";

import { useMemo, useState } from "react";

import type { PlanShareSnapshot } from "../../../../lib/plan-share";

type PlanShareCheckpoint = PlanShareSnapshot["checkpoints"][number];

type PlanShareCrewTimelineProps = {
  summary: PlanShareSnapshot;
  departureTime: string | null;
  locale: "fr" | "en";
};

const COPY = {
  fr: {
    title: "Équipe ravitos",
    liveTitle: "Suivi course",
    departure: "Départ",
    lastPassage: "Dernier passage",
    actualTime: "Heure réelle",
    noPassage: "Aucun",
    nextPoint: "Prochain point",
    passed: "Passé",
    next: "Prochain",
    finishPassed: "Arrivée passée",
    delta: "Écart",
    give: "À donner",
    nothingToGive: "Rien à donner",
    assistanceAvailable: "Assistance",
    noAssistance: "Sans assistance",
    carryFromPrevious: "Produits à porter depuis le point assistance précédent.",
    water: "Eau",
    pause: "Pause",
    waterFull: "poche pleine {liters} L",
    waterRefill: "remplir la poche",
    waterUnavailable: "pas de recharge eau",
    waterFinish: "arrivée",
    solidUnavailable: "pas de solide",
    dayOffset: "J+{days}",
    remaining: "dans {duration}",
  },
  en: {
    title: "Crew aid stations",
    liveTitle: "Race tracking",
    departure: "Start",
    lastPassage: "Last passage",
    actualTime: "Actual time",
    noPassage: "None",
    nextPoint: "Next point",
    passed: "Passed",
    next: "Next",
    finishPassed: "Finish passed",
    delta: "Offset",
    give: "Give",
    nothingToGive: "Nothing to give",
    assistanceAvailable: "Crew access",
    noAssistance: "No crew access",
    carryFromPrevious: "Products must be carried from the previous crew point.",
    water: "Water",
    pause: "Pause",
    waterFull: "full bladder {liters} L",
    waterRefill: "refill the bladder",
    waterUnavailable: "no water refill",
    waterFinish: "finish",
    solidUnavailable: "no solids",
    dayOffset: "D+{days}",
    remaining: "in {duration}",
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

export function PlanShareCrewTimeline({ summary, departureTime, locale }: PlanShareCrewTimelineProps) {
  const copy = COPY[locale];
  const [startTime, setStartTime] = useState(departureTime ?? "");
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState("");
  const [actualPassTime, setActualPassTime] = useState("");

  const timeline = useMemo(() => {
    const startMinutes = parseClock(startTime);
    const selectedIndex = selectedCheckpointIndex === "" ? null : Number(selectedCheckpointIndex);
    const selectedCheckpoint =
      selectedIndex === null
        ? null
        : summary.checkpoints.find((checkpoint) => checkpoint.index === selectedIndex) ?? null;
    const actualClock = parseClock(actualPassTime);
    const actualAbsolute =
      selectedCheckpoint && actualClock !== null
        ? startMinutes !== null
          ? resolveClockNearPlanned(actualClock, startMinutes + selectedCheckpoint.arrivalMinute)
          : actualClock
        : null;

    const getCheckpointAbsolute = (checkpoint: PlanShareCheckpoint) => {
      if (selectedCheckpoint && actualAbsolute !== null) {
        if (checkpoint.index >= selectedCheckpoint.index) {
          return actualAbsolute + checkpoint.arrivalMinute - selectedCheckpoint.arrivalMinute;
        }
      }

      if (startMinutes !== null) return startMinutes + checkpoint.arrivalMinute;
      return null;
    };

    const nextCheckpoint =
      selectedCheckpoint && actualAbsolute !== null
        ? summary.checkpoints.find((checkpoint) => checkpoint.index > selectedCheckpoint.index) ?? null
        : summary.checkpoints.find((checkpoint) => !checkpoint.isStart) ?? null;
    const nextAbsolute = nextCheckpoint ? getCheckpointAbsolute(nextCheckpoint) : null;
    const delta =
      selectedCheckpoint && actualAbsolute !== null && startMinutes !== null
        ? actualAbsolute - (startMinutes + selectedCheckpoint.arrivalMinute)
        : null;

    return {
      selectedCheckpoint,
      actualAbsolute,
      nextCheckpoint,
      nextAbsolute,
      delta,
      getCheckpointAbsolute,
    };
  }, [actualPassTime, selectedCheckpointIndex, startTime, summary.checkpoints]);

  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xl font-bold text-foreground">{copy.liveTitle}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-muted-foreground">
            {copy.departure}
            <input
              type="time"
              step="60"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="min-h-12 rounded-lg border border-border bg-background px-3 font-mono text-base font-bold text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-muted-foreground">
            {copy.lastPassage}
            <select
              value={selectedCheckpointIndex}
              onChange={(event) => {
                setSelectedCheckpointIndex(event.target.value);
                if (!event.target.value) setActualPassTime("");
              }}
              className="min-h-12 rounded-lg border border-border bg-background px-3 text-base font-semibold text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">{copy.noPassage}</option>
              {summary.checkpoints.map((checkpoint) => (
                <option key={checkpoint.index} value={checkpoint.index}>
                  {checkpoint.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-muted-foreground">
            {copy.actualTime}
            <input
              type="time"
              step="60"
              value={actualPassTime}
              disabled={!selectedCheckpointIndex}
              onChange={(event) => setActualPassTime(event.target.value)}
              className="min-h-12 rounded-lg border border-border bg-background px-3 font-mono text-base font-bold text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg bg-brand-surface p-4">
          <p className="text-xs font-semibold uppercase text-brand">{copy.nextPoint}</p>
          {timeline.nextCheckpoint ? (
            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <p className="text-lg font-bold text-foreground">{timeline.nextCheckpoint.name}</p>
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
                {timeline.actualAbsolute !== null && timeline.nextAbsolute !== null ? (
                  <p className="text-sm text-muted-foreground">
                    {copy.remaining.replace(
                      "{duration}",
                      formatDuration(timeline.nextAbsolute - timeline.actualAbsolute)
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
            <p className="mt-1 text-lg font-bold text-foreground">{copy.finishPassed}</p>
          )}
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground">{copy.title}</h2>
      <div className="grid gap-3">
        {summary.checkpoints.map((checkpoint) => {
          const waterInstruction = getWaterInstruction(checkpoint, summary, locale);
          const checkpointAbsolute = timeline.getCheckpointAbsolute(checkpoint);
          const isPassed =
            timeline.selectedCheckpoint !== null &&
            timeline.actualAbsolute !== null &&
            checkpoint.index === timeline.selectedCheckpoint.index;
          const isNext = timeline.nextCheckpoint !== null && checkpoint.index === timeline.nextCheckpoint.index;

          return (
            <article
              key={`${checkpoint.index}-${checkpoint.name}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-lg font-bold text-foreground">{checkpoint.name}</h3>
                    {isPassed ? (
                      <span className="rounded-full border border-brand-border bg-brand-surface px-2 py-0.5 text-xs font-bold text-brand">
                        {copy.passed}
                      </span>
                    ) : null}
                    {isNext ? (
                      <span className="rounded-full border border-brand-border bg-brand-surface px-2 py-0.5 text-xs font-bold text-brand">
                        {copy.next}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-mono text-sm text-muted-foreground">
                    {formatKm(checkpoint.distanceKm)} - T+{formatDuration(checkpoint.arrivalMinute)}
                    {checkpointAbsolute !== null ? ` / ${formatAbsoluteClock(checkpointAbsolute, locale)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    {copy.water}: {waterInstruction}
                  </span>
                  {checkpoint.solidState === "unavailable" ? (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                      {copy.solidUnavailable}
                    </span>
                  ) : null}
                  {checkpoint.assistanceState === "available" || checkpoint.assistanceState === "start" ? (
                    <span className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-bold text-brand">
                      {copy.assistanceAvailable}
                    </span>
                  ) : checkpoint.assistanceState === "unavailable" ? (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                      {copy.noAssistance}
                    </span>
                  ) : null}
                  {checkpoint.pauseMinutes > 0 ? (
                    <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                      {copy.pause} +{Math.round(checkpoint.pauseMinutes)} min
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{copy.give}</p>
                {checkpoint.supplies.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {checkpoint.assistanceState === "unavailable" ? copy.carryFromPrevious : copy.nothingToGive}
                  </p>
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
