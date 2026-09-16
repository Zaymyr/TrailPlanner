"use client";

import React, { useEffect, useMemo, useState } from "react";

import { MetricCard } from "../../../../components/ui/MetricCard";
import { TimeSeriesLineChart } from "../../../../components/ui/TimeSeriesLineChart";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";

import type { RaceFormat } from "./types";

type AnalyticsRange = "7d" | "30d" | "90d";

type AnalyticsPayload = {
  access: { allowed: true; source: "tier" | "complimentary" };
  range: AnalyticsRange;
  raceId: string | null;
  timing: { from: string; to: string; generatedAt: string; cacheTtlSeconds: number };
  summary: {
    uniqueReaders: number;
    totalOpens: number;
    averageActiveSeconds: number | null;
    engagementRate: number | null;
  };
  daily: Array<{ date: string; uniqueReaders: number; totalOpens: number }>;
};

type Props = {
  editionId: string;
  accessToken: string;
  access: { allowed: boolean; source: "tier" | "complimentary" | null };
  races: RaceFormat[];
  onOpenPricing: () => void;
};

export function formatAnalyticsDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return minutes > 0 ? `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s` : `${remainingSeconds} s`;
}

export function OrganizerAnalyticsPanel({ editionId, accessToken, access, races, onOpenPricing }: Props) {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [raceId, setRaceId] = useState("");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    setRaceId("");
    setData(null);
  }, [editionId]);

  useEffect(() => {
    if (!access.allowed) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ range });
    if (raceId) params.set("raceId", raceId);
    setState("loading");
    fetch(`/api/organizer/editions/${editionId}/analytics?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as AnalyticsPayload | { message?: string } | null;
        if (!response.ok || !payload || !("summary" in payload)) throw new Error("analytics_unavailable");
        setData(payload);
        setState("idle");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setData(null);
        setState("error");
      });
    return () => controller.abort();
  }, [access.allowed, accessToken, editionId, raceId, range]);

  const hasData = useMemo(() => data !== null && (
    data.summary.uniqueReaders > 0 || data.summary.totalOpens > 0 || data.daily.some((point) => point.uniqueReaders > 0 || point.totalOpens > 0)
  ), [data]);

  if (!access.allowed) {
    return (
      <Card className="border-brand/30 bg-brand/5">
        <CardHeader>
          <CardTitle>Suivez l’usage de votre RaceBook</CardTitle>
          <CardDescription>Les statistiques sont incluses dans l’offre Signature. Découvrez les consultations, la durée active et l’engagement de vos lecteurs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={onOpenPricing}>Découvrir l’offre Signature</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="organizer-analytics-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="organizer-analytics-title" className="text-lg font-semibold text-foreground">Performance du RaceBook</h2>
          <p className="text-sm text-muted-foreground">
            {access.source === "complimentary" ? "Module offert pour cette édition." : "Module inclus dans votre offre Signature."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Format
            <select aria-label="Filtrer les statistiques par format" className="block h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground" value={raceId} onChange={(event) => setRaceId(event.target.value)}>
              <option value="">Tous les formats</option>
              {races.map((race) => <option key={race.id} value={race.id}>{race.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Période
            <select aria-label="Période des statistiques" className="block h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground" value={range} onChange={(event) => setRange(event.target.value as AnalyticsRange)}>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
              <option value="90d">90 jours</option>
            </select>
          </label>
        </div>
      </div>

      {state === "loading" ? <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground" role="status">Chargement des statistiques…</p> : null}
      {state === "error" ? <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800" role="alert">Statistiques temporairement indisponibles. Réessayez dans quelques minutes.</p> : null}
      {state === "idle" && data && !hasData ? <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">Aucune consultation sur cette période.</p> : null}
      {state === "idle" && data && hasData ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Lecteurs uniques estimés" value={data.summary.uniqueReaders.toLocaleString("fr-FR")} helper="Identifiants PostHog distincts" />
            <MetricCard label="Ouvertures totales" value={data.summary.totalOpens.toLocaleString("fr-FR")} />
            <MetricCard label="Durée active moyenne" value={formatAnalyticsDuration(data.summary.averageActiveSeconds)} helper="Sessions fermées correctement" />
            <MetricCard label="Taux d’engagement" value={data.summary.engagementRate === null ? "—" : `${Math.round(data.summary.engagementRate * 100)} %`} helper="Sessions avec interaction mesurable" />
          </div>
          <TimeSeriesLineChart
            title="Consultations quotidiennes"
            description="Lecteurs estimés et ouvertures du RaceBook."
            points={data.daily.map((point) => ({
              date: point.date,
              values: { uniqueReaders: point.uniqueReaders, totalOpens: point.totalOpens },
            }))}
            series={[
              { key: "uniqueReaders", label: "Lecteurs", color: "#f97316" },
              { key: "totalOpens", label: "Ouvertures", color: "#2563eb" },
            ]}
            locale="fr-FR"
            ariaLabel="Évolution quotidienne des lecteurs et des ouvertures"
          />
          <p className="text-xs text-muted-foreground">Les lecteurs sont des identifiants techniques estimés. La durée et l’engagement reposent sur les sessions correctement clôturées.</p>
        </>
      ) : null}
    </section>
  );
}
