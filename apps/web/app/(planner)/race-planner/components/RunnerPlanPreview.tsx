"use client";

import Link from "next/link";
import type { Route } from "next";
import type { Segment } from "../types";

const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")}`;
const formatPace = (minutes: number) => {
  const seconds = Math.round(minutes * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export function RunnerPlanPreview({ locale, planId, duration, distanceKm, segments, onSave }: {
  locale: string; planId: string | null; duration: number | null; distanceKm: number; segments: Segment[]; onSave: () => void;
}) {
  const fr = locale === "fr";
  const href = `/premium${planId ? `?planId=${encodeURIComponent(planId)}` : ""}` as Route;
  return <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
    <h2 className="text-2xl font-semibold">{fr ? "Ton estimation gratuite" : "Your free estimate"}</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><p className="text-muted-foreground">{fr ? "Temps total estimé" : "Estimated total time"}</p><p className="text-3xl font-semibold">{duration === null ? "—" : formatDuration(duration)}</p></div>
      <div><p className="text-muted-foreground">{fr ? "Allure moyenne" : "Average pace"}</p><p className="text-3xl font-semibold">{duration !== null && distanceKm > 0 ? `${formatPace(duration / distanceKm)} /km` : "—"}</p></div>
    </div>
    <h3 className="font-semibold">{fr ? "Tes besoins par portion" : "Your needs by section"}</h3>
    <ul className="divide-y divide-border">{segments.map((segment, index) => <li key={`${segment.checkpoint}-${index}`} className="flex flex-wrap justify-between gap-2 py-3">
      <span>{segment.from} → {segment.checkpoint}</span>
      <span>{Math.round(segment.targetFuelGrams)} g · {Math.round(segment.targetWaterMl)} ml · {Math.round(segment.targetSodiumMg)} mg {fr ? "sodium" : "sodium"}</span>
    </li>)}</ul>
    <div className="grid gap-4 sm:grid-cols-2">{[
      [fr ? "Adapte ton allure section par section" : "Adjust your pace section by section", fr ? "Débloquer mes allures" : "Unlock pacing"],
      [fr ? "Construis ton plan nutrition ravito par ravito" : "Build your nutrition plan aid station by aid station", fr ? "Construire mon plan nutrition" : "Build my nutrition plan"],
    ].map(([title, label]) => <div key={title} className="space-y-3 rounded-xl border border-border p-4"><h3 className="font-semibold">{title}</h3><Link className="font-semibold text-brand underline" href={href}>{label}</Link></div>)}</div>
    {planId ? <Link href={href} className="inline-flex rounded-lg bg-brand px-5 py-3 font-semibold text-white">{fr ? "Débloquer mon plan complet" : "Unlock my complete plan"}</Link> : <button type="button" onClick={onSave} className="rounded-lg bg-brand px-5 py-3 font-semibold text-white">{fr ? "Enregistrer mon estimation" : "Save my estimate"}</button>}
    <p className="text-sm text-muted-foreground">{fr ? "Une course : 9,99 € · Toutes tes courses : 29,99 €/an. Plus avantageux dès 4 courses par an." : "One race: €9.99 · All your races: €29.99/year. Better value from 4 races per year."}</p>
  </section>;
}
