"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Select } from "../../../../components/ui/Select";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { useToast } from "../../../../components/ui/Toast";
import { cn } from "../../../../components/utils";
import {
  AUDIT_FAMILIES,
  AUDIT_STATUS_LABEL,
  AUDIT_STATUSES,
  auditCsvFileName,
  buildAuditCsv,
  formatAuditDate,
  formatAuditRelative,
  readAuditQuery,
  writeAuditQuery,
  type AuditEntry,
  type AuditFamily,
  type AuditQuery,
  type AuditStatus,
} from "../../../../lib/admin-audit";
import { addDays, parisToday } from "../../../../lib/reel-planner";
import { replaceLocationSearch } from "../../admin-tabs";
import { chipClass, InboxSkeletonRows } from "../inbox/InboxQueue";
import { AdminPageHeader } from "../shell/AdminPageHeader";
import { fetchAuditExport, useAdminAudit, useAdminAuditEntry } from "./audit-api";
import { AuditEntryDrawer } from "./AuditEntryDrawer";

const readSearch = () => (typeof window === "undefined" ? "" : window.location.search);

const PERIODS = [
  { id: "24h", label: "Aujourd’hui", days: 0 },
  { id: "7j", label: "7 jours", days: 6 },
  { id: "30j", label: "30 jours", days: 29 },
  { id: "90j", label: "90 jours", days: 89 },
] as const;

const rowLinkClass = "text-xs font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function WhenCell({ entry, now }: { entry: AuditEntry; now: Date }) {
  return (
    <time dateTime={entry.createdAt} title={formatAuditDate(entry.createdAt)} className="flex flex-col">
      <span className="whitespace-nowrap text-sm font-medium text-foreground">{formatAuditRelative(entry.createdAt, now)}</span>
      <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatAuditDate(entry.createdAt).slice(0, 16)}</span>
    </time>
  );
}

function ActionCell({ entry }: { entry: AuditEntry }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge tone={entry.familyTone} dot={false}>{entry.familyLabel}</StatusBadge>
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {entry.actionLabel}
        {entry.status === "error" ? <StatusBadge tone="danger">{AUDIT_STATUS_LABEL.error}</StatusBadge> : null}
      </span>
    </span>
  );
}

function TargetCell({ entry }: { entry: AuditEntry }) {
  const label = `${entry.targetTypeLabel}${entry.targetId ? ` ${entry.targetId.length > 14 ? `${entry.targetId.slice(0, 8)}…` : entry.targetId}` : ""}`;
  return entry.targetHref ? (
    <Link href={entry.targetHref as Route} onClick={(event) => event.stopPropagation()} className={rowLinkClass}>{label}</Link>
  ) : (
    <span className="text-xs text-muted-foreground">{label}</span>
  );
}

/**
 * « Journal » (lot 7): who did what, newest first. Period, family, status, actor, target and search
 * filters live in the URL (`?du&au&action&statut&acteur&cible&recherche&page`), a line opens its side
 * panel (`?entree=<id>`) with the before / after diff, and the filtered view exports to CSV. Table from
 * `md`, cards below.
 */
export function AuditLog({ accessToken }: { accessToken: string }) {
  const toast = useToast();
  const [query, setQuery] = useState<AuditQuery | null>(null);
  const [searchText, setSearchText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const initial = readAuditQuery(new URLSearchParams(readSearch()));
    setQuery(initial);
    setSearchText(initial.search);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const audit = useAdminAudit(accessToken, query);
  const data = audit.data;
  const entries = useMemo(() => data?.entries ?? [], [data]);

  const writeUrl = (next: AuditQuery) => {
    const search = writeAuditQuery(next).toString();
    replaceLocationSearch(search ? `?${search}` : "");
  };
  const update = (patch: Partial<AuditQuery>) => {
    if (!query) return;
    const next = { ...query, page: 1, ...patch };
    setQuery(next);
    writeUrl(next);
  };
  const openEntry = (id: string | null) => {
    if (!query) return;
    const next = { ...query, entryId: id };
    setQuery(next);
    writeUrl(next);
  };

  // The search box writes the URL after a short pause.
  useEffect(() => {
    if (!query || searchText.trim() === query.search) return;
    const timer = window.setTimeout(() => update({ search: searchText.trim() }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const listed = query?.entryId ? entries.find((entry) => entry.id === query.entryId) ?? null : null;
  const fetched = useAdminAuditEntry(accessToken, query?.entryId ?? null, Boolean(query?.entryId) && !listed && Boolean(data));
  const drawerEntry = listed ?? fetched.data?.entries[0] ?? null;
  const drawerMissing = Boolean(query?.entryId && !listed && fetched.isSuccess && !drawerEntry);

  const today = parisToday();
  const activePeriod = query && !query.to ? PERIODS.find((period) => query.from === addDays(today, -period.days))?.id ?? null : null;
  const noFilter = Boolean(query && !query.from && !query.to && !query.actor && !query.actions.length && !query.target && !query.status && !query.search);

  const toggleFamily = (family: AuditFamily) => {
    if (!query) return;
    update({ actions: query.actions.includes(family) ? query.actions.filter((value) => value !== family) : [...query.actions, family] });
  };
  const selectedFamilies = new Set(query?.actions ?? []);

  const exportCsv = async () => {
    if (!query) return;
    setExporting(true);
    try {
      const all = await fetchAuditExport(accessToken, query);
      const blob = new Blob([buildAuditCsv(all.entries)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = auditCsvFileName(query, today);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.show({ message: `${all.entries.length} ligne${all.entries.length > 1 ? "s" : ""} exportée${all.entries.length > 1 ? "s" : ""}.`, tone: "success" });
    } catch (error) {
      toast.show({ message: error instanceof Error ? error.message : "L’export a échoué.", tone: "danger" });
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSearchText("");
    update({ from: null, to: null, actor: null, actions: [], target: null, status: null, search: "" });
  };

  return (
    <>
      <AdminPageHeader
        title="Journal"
        description="Qui a fait quoi : chaque modification faite depuis la console (rôles, Premium, envois, catalogue, facturation, publications, maintenance…). Conservé 365 jours."
        actions={
          <>
            <Button type="button" variant="outline" disabled={exporting || !data || !data.available} onClick={() => void exportCsv()}>{exporting ? "Export…" : "Exporter (CSV)"}</Button>
            <Button type="button" variant="outline" onClick={() => void audit.refetch()}>Actualiser</Button>
          </>
        }
      />

      <section aria-labelledby="audit-title" className="rounded-[14px] border border-[#e6e2d8] bg-card shadow-sm dark:border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
          <h2 id="audit-title" className="text-[15px] font-semibold">
            Actions{data ? <span className="ml-2 font-mono text-sm font-medium text-muted-foreground">{data.pagination.total}</span> : null}
          </h2>
        </div>

        {query ? (
          <div className="space-y-2 px-4 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="audit-search">Rechercher dans le journal</label>
              <input
                id="audit-search"
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Rechercher (résumé, identifiant, admin)…"
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:max-w-sm"
              />
              <label className="sr-only" htmlFor="audit-actor">Filtrer par admin</label>
              <Select id="audit-actor" value={query.actor ?? ""} onChange={(event) => update({ actor: event.target.value || null })} className="w-full sm:w-56">
                <option value="">Tous les admins</option>
                {(data?.actors ?? []).map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
                {query.actor && !(data?.actors ?? []).some((actor) => actor.id === query.actor) ? <option value={query.actor}>Admin {query.actor.slice(0, 8)}</option> : null}
              </Select>
            </div>

            <div role="group" aria-label="Période" className="flex flex-wrap items-center gap-1.5">
              <button type="button" aria-pressed={!query.from && !query.to} className={chipClass(!query.from && !query.to, false)} onClick={() => update({ from: null, to: null })}>Tout</button>
              {PERIODS.map((period) => (
                <button key={period.id} type="button" aria-pressed={activePeriod === period.id} className={chipClass(activePeriod === period.id, false)} onClick={() => update({ from: addDays(today, -period.days), to: null })}>{period.label}</button>
              ))}
              <span className="ml-1 inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <label htmlFor="audit-from">du</label>
                <input id="audit-from" type="date" value={query.from ?? ""} max={query.to ?? undefined} onChange={(event) => update({ from: event.target.value || null })} className="h-8 rounded-md border border-[#e6e2d8] bg-card px-2 text-xs dark:border-border" />
                <label htmlFor="audit-to">au</label>
                <input id="audit-to" type="date" value={query.to ?? ""} min={query.from ?? undefined} onChange={(event) => update({ to: event.target.value || null })} className="h-8 rounded-md border border-[#e6e2d8] bg-card px-2 text-xs dark:border-border" />
              </span>
            </div>

            <div role="group" aria-label="Filtrer par famille d’action" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={selectedFamilies.size === 0} className={chipClass(selectedFamilies.size === 0, false)} onClick={() => update({ actions: [] })}>Toutes les actions</button>
              {(Object.keys(AUDIT_FAMILIES) as AuditFamily[]).map((family) => (
                <button key={family} type="button" aria-pressed={selectedFamilies.has(family)} className={chipClass(selectedFamilies.has(family), false)} onClick={() => toggleFamily(family)}>{AUDIT_FAMILIES[family].label}</button>
              ))}
            </div>

            <div role="group" aria-label="Filtrer par résultat" className="flex flex-wrap items-center gap-1.5">
              <button type="button" aria-pressed={!query.status} className={chipClass(!query.status, false)} onClick={() => update({ status: null })}>Tous les résultats</button>
              {AUDIT_STATUSES.map((status: AuditStatus) => (
                <button key={status} type="button" aria-pressed={query.status === status} className={chipClass(query.status === status, status === "error")} onClick={() => update({ status: query.status === status ? null : status })}>{AUDIT_STATUS_LABEL[status]}</button>
              ))}
              {query.target ? (
                <button type="button" className={chipClass(true, false)} onClick={() => update({ target: null })} aria-label={`Retirer le filtre sur la cible ${query.target}`}>
                  Cible : {query.target.length > 18 ? `${query.target.slice(0, 8)}…` : query.target} ×
                </button>
              ) : null}
              {!noFilter ? <button type="button" className="ml-1 text-xs font-semibold text-brand underline-offset-4 hover:underline" onClick={resetFilters}>Réinitialiser</button> : null}
            </div>
          </div>
        ) : null}

        {data && !data.available ? (
          <p role="status" className="mx-4 mb-3 rounded-lg bg-[#fef1e6] px-3 py-2 text-xs text-[#8a3f0b] dark:bg-orange-950/60 dark:text-orange-100">
            Le journal n’est pas encore activé sur cette base : la migration <span className="font-mono">admin_audit_log</span> n’est pas appliquée. Les actions ne sont pas enregistrées tant qu’elle ne l’est pas.
          </p>
        ) : null}

        <div className="border-t border-[#e6e2d8] dark:border-border">
          {audit.isLoading && !data ? (
            <InboxSkeletonRows count={6} />
          ) : audit.isError && !data ? (
            <div className="p-4">
              <EmptyState title="Le journal n’a pas pu être chargé" description={audit.error instanceof Error ? audit.error.message : undefined} action={<button type="button" className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={() => void audit.refetch()}>Réessayer</button>} />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={noFilter ? "Aucune action enregistrée" : "Aucune action pour ces filtres"}
                description={noFilter ? "Les modifications faites depuis la console apparaîtront ici." : "Élargis la période ou retire un filtre."}
                action={noFilter ? undefined : <button type="button" className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={resetFilters}>Réinitialiser les filtres</button>}
              />
            </div>
          ) : (
            <>
              <table className="hidden w-full text-sm md:table">
                <caption className="sr-only">Actions admin, les plus récentes en premier. Activer une ligne ouvre son détail.</caption>
                <thead>
                  <tr className="border-b border-[#e6e2d8] text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-border">
                    <th scope="col" className="px-4 py-2 font-semibold">Quand</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Qui</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Action</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Cible</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Résumé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e2d8] dark:divide-border">
                  {entries.map((entry) => (
                    <tr key={entry.id} className={cn("cursor-pointer align-top transition hover:bg-muted/50", query?.entryId === entry.id && "bg-muted/60")} onClick={() => openEntry(entry.id)}>
                      <td className="px-4 py-2.5"><WhenCell entry={entry} now={now} /></td>
                      <td className="max-w-[10rem] truncate px-2 py-2.5 text-sm" title={entry.actorName}>{entry.actorName}</td>
                      <td className="px-2 py-2.5"><ActionCell entry={entry} /></td>
                      <td className="max-w-[12rem] px-2 py-2.5"><TargetCell entry={entry} /></td>
                      <td className="max-w-[26rem] px-4 py-2.5">
                        <button type="button" onClick={(event) => { event.stopPropagation(); openEntry(entry.id); }} className="line-clamp-2 text-left text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                          {entry.summary}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-[#e6e2d8] md:hidden dark:divide-border">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => openEntry(entry.id)} className="flex w-full flex-col gap-1.5 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                      <span className="flex items-start justify-between gap-2">
                        <ActionCell entry={entry} />
                        <span className="shrink-0 text-xs text-muted-foreground">{formatAuditRelative(entry.createdAt, now)}</span>
                      </span>
                      <span className="text-sm text-foreground">{entry.summary}</span>
                      <span className="text-xs text-muted-foreground">{entry.actorName} · {entry.targetTypeLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {data && data.pagination.totalPages > 1 ? (
          <nav aria-label="Pagination du journal" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e2d8] px-4 py-3 text-sm dark:border-border">
            <span className="text-muted-foreground">Page {data.pagination.page} sur {data.pagination.totalPages} · {data.pagination.pageSize} actions par page</span>
            <span className="flex gap-2">
              <Button type="button" variant="outline" disabled={data.pagination.page <= 1} onClick={() => update({ page: data.pagination.page - 1 })}>Précédente</Button>
              <Button type="button" variant="outline" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => update({ page: data.pagination.page + 1 })}>Suivante</Button>
            </span>
          </nav>
        ) : null}
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        Une ligne est écrite quand une modification aboutit, ou échoue côté serveur. Les requêtes refusées (droits, formulaire invalide) et les lectures ne sont pas journalisées. L’état « avant » n’est enregistré que lorsque la route le connaît ; les mots de passe, contenus de message et adresses e-mail complètes ne sont jamais conservés.
      </p>

      <AuditEntryDrawer entry={drawerEntry} missing={drawerMissing} loading={Boolean(query?.entryId && !drawerEntry && !drawerMissing)} now={now} onClose={() => openEntry(null)} />
    </>
  );
}
