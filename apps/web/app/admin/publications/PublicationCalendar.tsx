"use client";

import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import type { PublicSocialPost } from "../../../lib/social-posts";
import { buildMonthGrid, currentParisMonth, formatMonthTitle, getCalendarTime, shiftMonth, toParisDay } from "./publication-calendar";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const chipClass = (post: PublicSocialPost) => {
  if (post.status === "published") {
    return post.dryRun
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100";
  }
  return "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100";
};

const timeOf = (post: PublicSocialPost) => {
  const time = getCalendarTime(post);
  return time ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(time)) : "";
};

/** Month view of what was published (green, amber in simulation) and what is scheduled (blue). */
export function PublicationCalendar({ posts, onSelect }: { posts: PublicSocialPost[]; onSelect: (postId: string) => void }) {
  const [month, setMonth] = useState(() => currentParisMonth());
  const weeks = useMemo(() => buildMonthGrid(month.year, month.month, posts), [month, posts]);
  const today = toParisDay(new Date().toISOString());
  const inMonthCount = weeks.flat().filter((day) => day.inMonth).reduce((sum, day) => sum + day.posts.length, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base capitalize">{formatMonthTitle(month)}</CardTitle>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" className="h-8 px-2" aria-label="Mois précédent" onClick={() => setMonth((value) => shiftMonth(value, -1))}>‹</Button>
          <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => setMonth(currentParisMonth())}>Aujourd’hui</Button>
          <Button type="button" variant="ghost" className="h-8 px-2" aria-label="Mois suivant" onClick={() => setMonth((value) => shiftMonth(value, 1))}>›</Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
        <div className="grid grid-cols-7 gap-1 text-center font-medium text-muted-foreground">
          {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((day) => (
            <div
              key={day.day}
              className={`flex min-h-[4.5rem] flex-col gap-1 rounded-md border p-1 ${day.inMonth ? "border-border bg-card" : "border-transparent bg-muted/30 text-muted-foreground"} ${day.day === today ? "ring-1 ring-brand" : ""}`}
            >
              <span className="text-[11px] tabular-nums">{Number(day.day.slice(8))}</span>
              {day.posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => onSelect(post.id)}
                  title={`${post.raceTitle ?? "Vidéo supprimée"} · ${timeOf(post)}`}
                  className={`truncate rounded border px-1 py-0.5 text-left text-[11px] leading-tight ${chipClass(post)}`}
                >
                  {timeOf(post)} {post.raceTitle ?? "Vidéo supprimée"}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Publiée</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Simulation</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Programmée</span>
          <span className="ml-auto">{inMonthCount === 0 ? "Rien ce mois-ci" : `${inMonthCount} ce mois-ci`}</span>
        </div>
      </CardContent>
    </Card>
  );
}
