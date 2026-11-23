"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { KpiTile } from "../../../../components/ui/KpiTile";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { useToast } from "../../../../components/ui/Toast";
import { cn } from "../../../../components/utils";
import {
  describeRenderDuration,
  isActiveRender,
  readRendersQuery,
  RENDER_FILTER_STATUS_LABEL,
  RENDER_FILTER_STATUSES,
  RENDER_PERIOD_LABEL,
  RENDER_PERIODS,
  RENDER_STATUS_LABEL,
  RENDER_TYPE_LABEL,
  RENDER_TYPES,
  renderStatusTone,
  writeRendersQuery,
  type AdminRenderEntry,
  type RenderFilterStatus,
  type RendersQuery,
  type RenderType,
} from "../../../../lib/admin-renders";
import { formatParisDateTime } from "../../../../lib/social-posts";
import { replaceLocationSearch } from "../../admin-tabs";
import { chipClass, InboxSkeletonRows } from "../inbox/InboxQueue";
import { AdminPageHeader } from "../shell/AdminPageHeader";
import { RenderDrawer } from "./RenderDrawer";
import { useAdminRenders } from "./useAdminRenders";

const readSearch = () => (typeof window === "undefined" ? "" : window.location.search);

const toggle = <T,>(values: T[], value: T) => (values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value]);

const TYPE_TONE: Record<RenderType, string> = {
  manuel: "bg-stone-100 text-stone-700 dark:bg-slate-800 dark:text-slate-200",
  auto: "bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-100",
  survol: "bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-100",
  carrousel: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-100",
};

function TypeTag({ type }: { type: RenderType }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold", TYPE_TONE[type])}>{RENDER_TYPE_LABEL[type]}</span>;
}

function StatusCell({ entry }: { entry: AdminRenderEntry }) {
  const active = isActiveRender(entry);
  return (
    <span className="flex min-w-[8rem] flex-col gap-1">
      <StatusBadge tone={renderStatusTone(entry.status)} pulse={entry.status === "en_cours"} title={entry.stage}>
        {RENDER_STATUS_LABEL[entry.status]}{entry.status === "en_cours" && entry.progress !== null ? ` · ${Math.round(entry.progress * 100)} %` : ""}
      </StatusBadge>
      {active && entry.progress !== null ? (
        <span className="block h-1 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Avancement de ${entry.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(entry.progress * 100)}>
          <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(2, Math.round(entry.progress * 100))}%` }} />
        </span>
      ) : null}
      {entry.status === "echec" && entry.message ? <span className="line-clamp-2 text-xs text-red-700 dark:text-red-300">{entry.message}</span> : null}
    </span>
  );
}

const rowLinkClass = "text-xs font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function OriginCell({ entry }: { entry: AdminRenderEntry }) {
  if (!entry.origin && !entry.post) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {entry.origin ? <Link href={entry.origin.href as Route} onClick={(event) => event.stopPropagation()} className={rowLinkClass}>{entry.origin.label}</Link> : null}
      {entry.post ? <Link href={entry.post.href as Route} onClick={(event) => event.stopPropagation()} className={rowLinkClass}>{entry.post.label}</Link> : null}
    </span>
  );
}

/**
 * « Rendus » (lot 6): the single render queue. Manual and automatic reels, flyovers and carousels in one
 * list with period / type / status chips kept in the URL (`?periode`, `?type`, `?statut`, `?page`), the
 * side panel of the open render (`?rendu=<id>`), refreshed every 5 s while a render is active and once
 * a minute otherwise. Table from `md`, cards below.
 */
export function RendersQueue({ accessToken }: { accessToken: string }) {
  const toast = useToast();
  const [query, setQuery] = useState<RendersQuery | null>(null);
  // The render named by the URL when the page opens: the server returns it even when the period hides it.
  const [loadFocusId, setLoadFocusId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const initial = readRendersQuery(new URLSearchParams(readSearch()));
    setQuery(initial);
    setLoadFocusId(initial.focusId);
  }, []);

  // Fetch key without the open panel: opening a row never reloads the list.
  const fetchQuery = useMemo(() => (query ? { ...query, focusId: loadFocusId } : null), [query, loadFocusId]);
  const renders = useAdminRenders(accessToken, fetchQuery);
  const data = renders.data;
  const entries = useMemo(() => data?.entries ?? [], [data]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const writeUrl = (next: RendersQuery) => {
    const search = writeRendersQuery(next).toString();
    replaceLocationSearch(search ? `?${search}` : "");
  };
  const update = (patch: Partial<RendersQuery>) => {
    if (!query) return;
    const next = { ...query, page: 1, ...patch };
    setQuery(next);
    writeUrl(next);
  };
  const openRender = (id: string | null) => update({ focusId: id, page: query?.page ?? 1 });

  const openEntry = query?.focusId ? entries.find((entry) => entry.id === query.focusId) ?? (data?.focus?.id === query.focusId ? data.focus : null) : null;
  const missing = Boolean(query?.focusId && data && !openEntry);
  const counts = data?.counts;

  const emptyAction = (
    <button type="button" className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={() => update({ period: "tout", types: [], statuses: [] })}>Tout afficher</button>
  );

  return (
    <>
      <AdminPageHeader
        title="Rendus"
        description="Une seule file : reels manuels et automatiques, vidéos de survol et carrousels. Actualisée toutes les 5 s pendant un rendu."
        actions={
          <>
            <Link href="/admin/content/studio" className="inline-flex h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Studio vidéo</Link>
            <Button type="button" variant="outline" onClick={() => void renders.refetch()}>Actualiser</Button>
          </>
        }
      />

      <section aria-label="Rendus de la période" className="mb-4 grid grid-cols-3 gap-3">
        <KpiTile label="En cours" value={counts ? String(counts.byStatus.actif) : "…"} hint="en attente ou en cours de calcul" />
        <KpiTile label="Échecs" value={counts ? String(counts.byStatus.echec) : "…"} hint="à relancer ou à supprimer" />
        <KpiTile label="Terminés" value={counts ? String(counts.byStatus.termine) : "…"} hint="sur la période choisie" />
      </section>

      <section aria-labelledby="renders-title" className="rounded-[14px] border border-[#e6e2d8] bg-card shadow-sm dark:border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
          <h2 id="renders-title" className="text-[15px] font-semibold">
            File des rendus{data ? <span className="ml-2 font-mono text-sm font-medium text-muted-foreground">{data.total}</span> : null}
          </h2>
        </div>

        {query ? (
          <div className="space-y-2 px-4 pb-3">
            <div role="group" aria-label="Période" className="flex flex-wrap items-center gap-1.5">
              {RENDER_PERIODS.map((period) => (
                <button key={period} type="button" aria-pressed={query.period === period} className={chipClass(query.period === period, false)} onClick={() => update({ period })}>
                  {RENDER_PERIOD_LABEL[period]}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Filtrer par type" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={query.types.length === 0} className={chipClass(query.types.length === 0, false)} onClick={() => update({ types: [] })}>Tous les types</button>
              {RENDER_TYPES.map((type) => (
                <button key={type} type="button" aria-pressed={query.types.includes(type)} className={chipClass(query.types.includes(type), false)} onClick={() => update({ types: toggle(query.types, type) })}>
                  {RENDER_TYPE_LABEL[type]}{counts ? <span className="font-mono opacity-70">{counts.byType[type]}</span> : null}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={query.statuses.length === 0} className={chipClass(query.statuses.length === 0, false)} onClick={() => update({ statuses: [] })}>Tous les statuts</button>
              {RENDER_FILTER_STATUSES.map((status: RenderFilterStatus) => (
                <button key={status} type="button" aria-pressed={query.statuses.includes(status)} className={chipClass(query.statuses.includes(status), status === "echec")} onClick={() => update({ statuses: toggle(query.statuses, status) })}>
                  {RENDER_FILTER_STATUS_LABEL[status]}{counts ? <span className="font-mono opacity-70">{counts.byStatus[status]}</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {data && !data.downloadsAvailable ? (
          <p role="status" className="mx-4 mb-3 rounded-lg bg-[#fef1e6] px-3 py-2 text-xs text-[#8a3f0b] dark:bg-orange-950/60 dark:text-orange-100">
            Google Cloud n’est pas disponible : les rendus s’affichent, mais les liens de téléchargement du MP4 sont absents.{" "}
            <Link href="/admin/system/integrations" className="font-semibold underline underline-offset-4">Voir les intégrations</Link>
          </p>
        ) : null}

        <div className="border-t border-[#e6e2d8] dark:border-border">
          {renders.isLoading && !data ? (
            <InboxSkeletonRows count={6} />
          ) : renders.isError && !data ? (
            <div className="p-4">
              <EmptyState title="Les rendus n’ont pas pu être chargés" description={renders.error instanceof Error ? renders.error.message : undefined} action={<button type="button" className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={() => void renders.refetch()}>Réessayer</button>} />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Aucun rendu pour ces filtres"
                description={query?.period === "tout" && query.types.length === 0 && query.statuses.length === 0 ? "Les rendus lancés depuis le studio, l’automatisation, les survols ou les carrousels apparaîtront ici." : "Élargis la période ou retire un filtre."}
                action={query?.period === "tout" && query.types.length === 0 && query.statuses.length === 0 ? <Link href="/admin/content/studio" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">Ouvrir le studio vidéo</Link> : emptyAction}
              />
            </div>
          ) : (
            <>
              <table className="hidden w-full text-sm md:table">
                <caption className="sr-only">Rendus, les plus récents en premier, ceux en cours d’abord. Activer une ligne ouvre son détail.</caption>
                <thead>
                  <tr className="border-b border-[#e6e2d8] text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-border">
                    <th scope="col" className="px-4 py-2 font-semibold">Rendu</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Type</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Statut</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Durée</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Origine</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Fichier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e2d8] dark:divide-border">
                  {entries.map((entry) => (
                    <tr key={entry.id} className={cn("cursor-pointer align-top transition hover:bg-muted/50", query?.focusId === entry.id && "bg-muted/60")} onClick={() => openRender(entry.id)}>
                      <td className="max-w-[18rem] px-4 py-2.5">
                        <button type="button" onClick={(event) => { event.stopPropagation(); openRender(entry.id); }} className="block max-w-full truncate text-left font-medium text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                          {entry.title}
                        </button>
                        <span className="block text-xs text-muted-foreground">{formatParisDateTime(entry.createdAt)}{entry.width && entry.height ? ` · ${entry.width}×${entry.height}` : entry.slideCount ? ` · ${entry.slideCount} images` : ""}</span>
                      </td>
                      <td className="px-2 py-2.5"><TypeTag type={entry.type} /></td>
                      <td className="px-2 py-2.5"><StatusCell entry={entry} /></td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono text-xs text-muted-foreground">{describeRenderDuration(entry, nowMs) ?? "—"}</td>
                      <td className="max-w-[14rem] px-2 py-2.5"><OriginCell entry={entry} /></td>
                      <td className="px-4 py-2.5 text-right">
                        {entry.downloadUrl ? <a href={entry.downloadUrl} onClick={(event) => event.stopPropagation()} className={rowLinkClass}>Télécharger le MP4</a> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-[#e6e2d8] md:hidden dark:divide-border">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => openRender(entry.id)} className="flex w-full flex-col gap-1.5 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{entry.title}</span>
                        <TypeTag type={entry.type} />
                      </span>
                      <StatusCell entry={entry} />
                      <span className="text-xs text-muted-foreground">
                        {formatParisDateTime(entry.createdAt)}{describeRenderDuration(entry, nowMs) ? ` · ${describeRenderDuration(entry, nowMs)}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {data && data.pageCount > 1 ? (
          <nav aria-label="Pagination des rendus" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e2d8] px-4 py-3 text-sm dark:border-border">
            <span className="text-muted-foreground">Page {data.page} sur {data.pageCount} · {data.pageSize} rendus par page</span>
            <span className="flex gap-2">
              <Button type="button" variant="outline" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>Précédente</Button>
              <Button type="button" variant="outline" disabled={data.page >= data.pageCount} onClick={() => update({ page: data.page + 1 })}>Suivante</Button>
            </span>
          </nav>
        ) : null}
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        Le type vient de l’origine du rendu : un reel lié à un élément du plan automatique est « automatique », une commande de survol est « survol », les autres reels sont « manuels » (le bouton « Générer le reel » du studio crée aussi son brouillon, mais reste un rendu manuel). Un rendu qui ne donne plus de nouvelles depuis 15 minutes passe en échec. Les MP4 sont conservés 30 jours ; seuls les reels terminés ou en échec peuvent être supprimés.
      </p>

      <RenderDrawer
        accessToken={accessToken}
        entry={openEntry}
        missing={missing}
        nowMs={nowMs}
        downloadsAvailable={data?.downloadsAvailable ?? true}
        onClose={() => openRender(null)}
        onDeleted={(message) => {
          openRender(null);
          toast.show({ message, tone: "success" });
          void renders.refetch();
        }}
      />
    </>
  );
}
