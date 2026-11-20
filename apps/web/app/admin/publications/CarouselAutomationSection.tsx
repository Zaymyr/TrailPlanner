"use client";

import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { CAROUSEL_MARK, CAROUSEL_SERIES_NAMES, carouselSubject, describeCarouselItem, formatAutomationDay } from "./automation-labels";
import { AUTOMATION_TONE_CLASS, SettingRow } from "./AutomationCard";
import { CAROUSEL_SERIES_KEYS, type CarouselAutomationView, type CarouselItemView, type CarouselSeriesKey, type RenderActivityView } from "./publications-api";

const SERIES_HELP: Record<CarouselSeriesKey, string> = {
  plan: "Mardi : glucides, eau et sodium pour 3 objectifs, puis les grammes tronçon par tronçon, d’une course 2 à 4 semaines plus tard.",
  brief: "Jeudi : barrières horaires ou ravitos, puis le livret coureur (si l’organisation l’a acheté) ou le plan de course, d’une course 7 à 14 jours plus tard.",
  week: "Dimanche soir : les courses du lundi au dimanche qui vient.",
};

const canExclude = (item: CarouselItemView) =>
  item.status === "planned" || item.status === "failed" || item.status === "generating" || (item.status === "skipped" && item.reason !== "excluded");

const isFinished = (item: CarouselItemView) =>
  item.status === "scheduled" || item.status === "failed" || (item.status === "skipped" && item.reason !== "too_late");

/** Paramètres · carousels: one switch per series (generation and publication follow the two main switches). */
export function CarouselSeriesSettings({ data, publishTime, busy, message, onSeries }: {
  data: CarouselAutomationView | undefined;
  publishTime: string;
  busy: boolean;
  message: string | null;
  onSeries: (patch: Partial<Record<CarouselSeriesKey, boolean>>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{CAROUSEL_MARK} Séries de carrousels</CardTitle>
        <CardDescription>Une série allumée réserve son jour de la semaine : les reels l’évitent (une publication par jour au plus).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {!data ? <p className="text-muted-foreground">Chargement…</p> : CAROUSEL_SERIES_KEYS.map((key) => (
          <SettingRow key={key} id={`carousel-${key}`} label={CAROUSEL_SERIES_NAMES[key]} checked={data.series[key]} disabled={busy} onChange={(next) => onSeries({ [key]: next })}>
            <p className="text-xs text-muted-foreground">{SERIES_HELP[key]} Publication à {publishTime}.</p>
          </SettingRow>
        ))}
        {message ? <p className="text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Carrousels tab: the weekly slots with « Exclure » / « Rétablir » and the live render stage. */
export function CarouselPlanList({ data, publishTime, busy, highlightedItemId, renders, onItemAction, onRefresh }: {
  data: CarouselAutomationView | undefined;
  publishTime: string;
  busy: boolean;
  highlightedItemId: string | null;
  renders: Map<string, RenderActivityView>;
  onItemAction: (itemId: string, action: "exclude" | "include") => void;
  onRefresh: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const items = data?.items ?? [];
  const visible = showAll ? items : items.filter((item) => !isFinished(item));
  const anySeries = data ? CAROUSEL_SERIES_KEYS.some((key) => data.series[key]) : true;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Prochains carrousels automatiques</CardTitle>
          {!anySeries ? <CardDescription>Aucune série allumée (Paramètres).</CardDescription> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setShowAll((value) => !value)}>{showAll ? "Masquer les terminés" : "Tout afficher"}</Button>
          <Button type="button" variant="outline" className="h-8 px-2 text-xs" disabled={busy} onClick={onRefresh}>Recalculer</Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {visible.length === 0 ? (
          <p className="text-muted-foreground">Aucun carrousel prévu.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {visible.map((item) => {
              const status = describeCarouselItem(item);
              const render = item.carouselJobId ? renders.get(item.carouselJobId) : undefined;
              const live = render && render.status === "active" && (item.status === "rendering" || item.status === "generating");
              return (
                <li key={item.id} id={`automation-${item.id}`} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 ${highlightedItemId === item.id ? "bg-brand/10" : ""}`}>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{CAROUSEL_MARK} {CAROUSEL_SERIES_NAMES[item.series]} · {carouselSubject(item)}</p>
                    <p className="text-xs text-muted-foreground">{formatAutomationDay(item.plannedPublishDate)} à {publishTime}</p>
                    <p className={`text-xs ${AUTOMATION_TONE_CLASS[live ? "active" : status.tone]}`}>{live ? render.stage : status.label}</p>
                  </div>
                  {item.status === "skipped" && item.reason === "excluded" ? (
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={busy} onClick={() => onItemAction(item.id, "include")}>Rétablir</Button>
                  ) : canExclude(item) ? (
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={busy} onClick={() => onItemAction(item.id, "exclude")}>Exclure</Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Carrousels tab: « Générer maintenant » for a chosen race or week, outside the calendar. */
export function CarouselGenerateNow({ data, busy, message, onGenerate }: {
  data: CarouselAutomationView | undefined;
  busy: boolean;
  message: string | null;
  onGenerate: (request: { series: "plan" | "brief"; raceId: string } | { series: "week"; weekStart: string }) => void;
}) {
  const [series, setSeries] = useState<CarouselSeriesKey>("plan");
  const [raceId, setRaceId] = useState("");
  const [weekStart, setWeekStart] = useState("");

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Générer un carrousel</CardTitle>
        <CardDescription>Hors calendrier : le rendu part tout de suite et crée un brouillon à relire (rien n’est publié).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <Label htmlFor="carousel-now-series">Série</Label>
          <select id="carousel-now-series" className="h-10 rounded-md border border-border bg-card px-2 text-sm" value={series} onChange={(event) => setSeries(event.target.value as CarouselSeriesKey)}>
            {CAROUSEL_SERIES_KEYS.map((key) => <option key={key} value={key}>{CAROUSEL_SERIES_NAMES[key]}</option>)}
          </select>
        </div>
        {series === "week" ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="carousel-now-week">Semaine</Label>
            <select id="carousel-now-week" className="h-10 rounded-md border border-border bg-card px-2 text-sm" value={weekStart} onChange={(event) => setWeekStart(event.target.value)}>
              <option value="">Choisir…</option>
              {(data?.weeks ?? []).map((monday) => <option key={monday} value={monday}>Semaine du {formatAutomationDay(monday)}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="carousel-now-race">Course</Label>
            <select id="carousel-now-race" className="h-10 rounded-md border border-border bg-card px-2 text-sm" value={raceId} onChange={(event) => setRaceId(event.target.value)}>
              <option value="">Choisir…</option>
              {(data?.races ?? []).map((race) => <option key={race.id} value={race.id}>{formatAutomationDay(race.date)} · {race.label}</option>)}
            </select>
          </div>
        )}
        <Button
          type="button"
          className="self-start"
          disabled={busy || (series === "week" ? !weekStart : !raceId)}
          onClick={() => onGenerate(series === "week" ? { series, weekStart } : { series, raceId })}
        >
          Générer maintenant
        </Button>
        {message ? <p className="text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
