"use client";

import type { Route } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { renderQueueHref } from "../../../lib/admin-renders";
import { formatParisDateTime } from "../../../lib/social-posts";
import { CAROUSEL_MARK } from "./automation-labels";
import type { RenderActivityView } from "./publications-api";
import { summarizeRenderActivity } from "./publication-tabs";

/** « il y a 3 min » from a start time; the page re-renders on each poll. */
export const formatElapsed = (fromIso: string, nowMs: number) => {
  const minutes = Math.max(0, Math.floor((nowMs - Date.parse(fromIso)) / 60_000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `depuis ${minutes} min`;
  return `depuis ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
};

const STATUS_CLASS: Record<RenderActivityView["status"], string> = {
  active: "text-sky-700 dark:text-sky-300",
  done: "text-emerald-700 dark:text-emerald-300",
  failed: "text-red-600 dark:text-red-300",
};

/**
 * « Rendus » summary of the Reels and Carrousels tabs: the renders running now and the failures of the
 * last 24 h with their stage, a progress bar for reels and the elapsed time, plus a link to the single
 * render queue (`/admin/content/renders`) that lists everything, finished renders included. Refreshed
 * every few seconds by the page while one is active.
 */
export function RenderActivityCard({ jobs, title, emptyText, error, nowMs, queueHref = renderQueueHref() }: {
  jobs: RenderActivityView[];
  title: string;
  emptyText: string;
  error: string | null;
  nowMs: number;
  /** The queue, optionally filtered on the type of this tab. */
  queueHref?: string;
}) {
  const { shown, doneCount } = summarizeRenderActivity(jobs);
  return (
    <Card className="h-fit min-w-0">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Rendus en cours et échecs des dernières 24 h. Mise à jour automatique pendant un rendu.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {error ? <p className="text-red-600 dark:text-red-300">{error}</p> : null}
        {shown.length === 0 ? <p className="text-muted-foreground">{jobs.length === 0 ? emptyText : "Aucun rendu en cours ni en échec."}</p> : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {shown.map((job) => (
              <li key={job.id} className="flex flex-col gap-1 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={renderQueueHref(job.id) as Route} className="min-w-0 truncate font-medium text-foreground underline-offset-4 hover:underline">{job.kind === "carousel" ? `${CAROUSEL_MARK} ` : ""}{job.title}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {job.status === "active" ? formatElapsed(job.startedAt ?? job.createdAt, nowMs) : formatParisDateTime(job.finishedAt ?? job.createdAt)}
                  </span>
                </div>
                <p className={`flex min-w-0 items-center gap-2 break-words text-xs ${STATUS_CLASS[job.status]}`}>
                  {job.status === "active" ? <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500" /> : null}
                  {job.stage}
                </p>
                {job.status === "active" && job.progress !== null ? (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progress * 100)}>
                    <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.max(2, Math.round(job.progress * 100))}%` }} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{doneCount ? `${doneCount} terminé${doneCount > 1 ? "s" : ""} sur les dernières 24 h.` : ""}</span>
          <Link href={queueHref as Route} className="font-semibold text-brand underline-offset-4 hover:underline">Voir tous les rendus →</Link>
        </p>
      </CardContent>
    </Card>
  );
}
