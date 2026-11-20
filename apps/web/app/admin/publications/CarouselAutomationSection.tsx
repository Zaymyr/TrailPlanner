"use client";

import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { CAROUSEL_MARK, CAROUSEL_SERIES_NAMES, carouselSubject, describeCarouselItem, formatAutomationDay } from "./automation-labels";
import { AutomationSwitch, AUTOMATION_TONE_CLASS } from "./AutomationCard";
import { CAROUSEL_SERIES_KEYS, type CarouselAutomationView, type CarouselItemView, type CarouselSeriesKey } from "./publications-api";

const SERIES_HELP: Record<CarouselSeriesKey, string> = {
  plan: "Mardi : glucides, eau et sodium pour 3 objectifs, puis les grammes tronçon par tronçon, d’une course 2 à 4 semaines plus tard.",
  brief: "Jeudi : barrières horaires ou ravitos, puis le livret coureur (si l’organisation l’a acheté) ou le plan de course, d’une course 7 à 14 jours plus tard.",
  week: "Dimanche soir : les courses du lundi au dimanche qui vient.",
};

const canExclude = (item: CarouselItemView) =>
  item.status === "planned" || item.status === "failed" || item.status === "generating" || (item.status === "skipped" && item.reason !== "excluded");

const isFinished = (item: CarouselItemView) =>
  item.status === "scheduled" || item.status === "failed" || (item.status === "skipped" && item.reason !== "too_late");

/**
 * Carousel part of « Automatisation »: one switch per series (generation and publication follow the
 * two reel switches), the weekly slots, and « Générer maintenant » for a chosen race or week.
 */
export function CarouselAutomationSection({ data, publishTime, busy, message, highlightedItemId, onSeries, onItemAction, onRefresh, onGenerate }: {
  data: CarouselAutomationView | undefined;
  publishTime: string;
  busy: boolean;
  message: string | null;
  highlightedItemId: string | null;
  onSeries: (patch: Partial<Record<CarouselSeriesKey, boolean>>) => void;
  onItemAction: (itemId: string, action: "exclude" | "include") => void;
  onRefresh: () => void;
  onGenerate: (request: { series: "plan" | "brief"; raceId: string } | { series: "week"; weekStart: string }) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [series, setSeries] = useState<CarouselSeriesKey>("plan");
  const [raceId, setRaceId] = useState("");
  const [weekStart, setWeekStart] = useState("");
  if (!data) return null;
  const visible = showAll ? data.items : data.items.filter((item) => !isFinished(item));

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <h3 className="font-medium text-foreground">{CAROUSEL_MARK} Carrousels</h3>
      <div className="flex flex-col gap-3">
        {CAROUSEL_SERIES_KEYS.map((key) => (
          <div key={key} className="flex items-start gap-3">
            <AutomationSwitch id={`carousel-${key}`} label={CAROUSEL_SERIES_NAMES[key]} checked={data.series[key]} disabled={busy} onChange={(next) => onSeries({ [key]: next })} />
            <div>
              <label htmlFor={`carousel-${key}`} className="font-medium text-foreground">{CAROUSEL_SERIES_NAMES[key]}</label>
              <p className="text-xs text-muted-foreground">{SERIES_HELP[key]} Publication à {publishTime}. Les reels évitent ce jour.</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground">Prochains carrousels</h4>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setShowAll((value) => !value)}>{showAll ? "Masquer les terminés" : "Tout afficher"}</Button>
          <Button type="button" variant="outline" className="h-8 px-2 text-xs" disabled={busy} onClick={onRefresh}>Recalculer</Button>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="text-muted-foreground">Aucun carrousel prévu : active une série.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {visible.map((item) => {
            const status = describeCarouselItem(item);
            return (
              <li key={item.id} id={`automation-${item.id}`} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 ${highlightedItemId === item.id ? "bg-brand/10" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{CAROUSEL_MARK} {CAROUSEL_SERIES_NAMES[item.series]} · {carouselSubject(item)}</p>
                  <p className="text-xs text-muted-foreground">{formatAutomationDay(item.plannedPublishDate)} à {publishTime}</p>
                  <p className={`text-xs ${AUTOMATION_TONE_CLASS[status.tone]}`}>{status.label}</p>
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

      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <h4 className="text-sm font-medium text-foreground">Générer maintenant</h4>
        <p className="text-xs text-muted-foreground">Hors calendrier : le rendu part tout de suite et crée un brouillon à relire (rien n’est publié).</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="carousel-now-series">Série</Label>
            <select id="carousel-now-series" className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={series} onChange={(event) => setSeries(event.target.value as CarouselSeriesKey)}>
              {CAROUSEL_SERIES_KEYS.map((key) => <option key={key} value={key}>{CAROUSEL_SERIES_NAMES[key]}</option>)}
            </select>
          </div>
          {series === "week" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="carousel-now-week">Semaine</Label>
              <select id="carousel-now-week" className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={weekStart} onChange={(event) => setWeekStart(event.target.value)}>
                <option value="">Choisir…</option>
                {data.weeks.map((monday) => <option key={monday} value={monday}>Semaine du {formatAutomationDay(monday)}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="carousel-now-race">Course</Label>
              <select id="carousel-now-race" className="h-9 max-w-[22rem] rounded-md border border-border bg-card px-2 text-sm" value={raceId} onChange={(event) => setRaceId(event.target.value)}>
                <option value="">Choisir…</option>
                {data.races.map((race) => <option key={race.id} value={race.id}>{formatAutomationDay(race.date)} · {race.label}</option>)}
              </select>
            </div>
          )}
          <Button
            type="button"
            disabled={busy || (series === "week" ? !weekStart : !raceId)}
            onClick={() => onGenerate(series === "week" ? { series, weekStart } : { series, raceId })}
          >
            Générer maintenant
          </Button>
        </div>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
