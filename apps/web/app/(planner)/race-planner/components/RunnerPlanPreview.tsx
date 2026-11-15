"use client";

import Link from "next/link";
import type { Route } from "next";
import React from "react";

import { useRunnerPrice } from "../../../hooks/useRunnerPrice";
import type { Segment } from "../types";

const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")}`;
const formatPace = (minutes: number) => {
  const seconds = Math.round(minutes * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const SegmentRow = ({ segment, locale }: { segment: Segment; locale: string }) => {
  const fr = locale === "fr";
  return (
    <div className="flex flex-wrap justify-between gap-2 py-3">
      <span>{segment.from} → {segment.checkpoint}</span>
      <span>
        {Math.round(segment.targetFuelGrams)} g · {Math.round(segment.targetWaterMl)} ml · {Math.round(segment.targetSodiumMg)} mg {fr ? "de sodium" : "sodium"}
      </span>
    </div>
  );
};

export function RunnerPlanPreview({ locale, planId, duration, distanceKm, segments, onSave }: {
  locale: string;
  planId: string | null;
  duration: number | null;
  distanceKm: number;
  segments: Segment[];
  onSave: () => void;
}) {
  const fr = locale === "fr";
  const href = `/premium${planId ? `?planId=${encodeURIComponent(planId)}` : ""}` as Route;
  const coursePrice = useRunnerPrice("course", locale);
  const annualPrice = useRunnerPrice("annual", locale);
  const [firstSegment, ...lockedSegments] = segments;

  const providerPriceCopy = coursePrice.status === "available" && annualPrice.status === "available"
    ? (fr
      ? `Cette course : ${coursePrice.formatted} · Toutes tes courses : ${annualPrice.formatted}/an.`
      : `This race: ${coursePrice.formatted} · All your races: ${annualPrice.formatted}/year.`)
    : coursePrice.status === "loading" || annualPrice.status === "loading"
      ? (fr ? "Chargement des prix Stripe…" : "Loading Stripe prices…")
      : (fr ? "Les prix sont momentanément indisponibles. Aucun montant n’est remplacé ou estimé." : "Prices are temporarily unavailable. No amount is substituted or estimated.");

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-2xl font-semibold">{fr ? "Ton estimation gratuite" : "Your free estimate"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">{fr ? "Temps total estimé" : "Estimated total time"}</p>
          <p className="text-3xl font-semibold">{duration === null ? "—" : formatDuration(duration)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{fr ? "Allure moyenne" : "Average pace"}</p>
          <p className="text-3xl font-semibold">
            {duration !== null && distanceKm > 0 ? `${formatPace(duration / distanceKm)} /km` : "—"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">{fr ? "Départ et premier tronçon" : "Start and first section"}</h3>
        {firstSegment ? (
          <SegmentRow segment={firstSegment} locale={locale} />
        ) : (
          <p className="text-sm text-muted-foreground">{fr ? "Le premier tronçon sera visible après le calcul." : "The first section will appear after calculation."}</p>
        )}
      </div>

      {lockedSegments.length > 0 ? (
        <div className="space-y-2">
          <p className="font-semibold">{fr ? "La suite de ta préparation" : "The rest of your preparation"}</p>
          <p className="text-sm text-muted-foreground">
            {fr ? "Débloque le plan pour consulter et ajuster chaque tronçon." : "Unlock the plan to review and adjust every section."}
          </p>
          <div className="relative overflow-hidden rounded-xl border border-border">
            <div aria-hidden="true" className="pointer-events-none select-none divide-y divide-border px-4 opacity-35 blur-[2px]">
              {lockedSegments.map((segment, index) => (
                <SegmentRow key={`${segment.checkpoint}-${index}`} segment={segment} locale={locale} />
              ))}
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-background/65 to-background/95" />
          </div>
        </div>
      ) : null}

      {planId ? (
        <Link href={href} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 py-3 font-semibold text-white">
          {fr ? "Débloquer toute ma préparation" : "Unlock my full preparation"}
        </Link>
      ) : (
        <button type="button" onClick={onSave} className="min-h-11 rounded-lg bg-brand px-5 py-3 font-semibold text-white">
          {fr ? "Enregistrer mon estimation" : "Save my estimate"}
        </button>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">{providerPriceCopy}</p>
    </section>
  );
}
