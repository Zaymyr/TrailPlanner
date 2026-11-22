"use client";

import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../../../../components/ui/EmptyState";
import { cn } from "../../../../components/utils";
import {
  countInboxByType,
  filterInboxItems,
  INBOX_TYPE_CONFIG,
  INBOX_TYPES,
  readInboxFilter,
  writeInboxFilter,
  type InboxType,
} from "../../../../lib/admin-inbox";
import { replaceLocationSearch } from "../../admin-tabs";
import { InboxRow } from "./InboxRow";
import { useAdminInbox } from "./useAdminInbox";

export const chipClass = (selected: boolean, hot: boolean) =>
  cn(
    "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    selected
      ? "bg-[#1f2a12] text-white dark:bg-lime-200 dark:text-[#1f2a12]"
      : hot
        ? "bg-[#fdecec] text-[#9b2c2c] hover:bg-[#fbd9d9] dark:bg-red-950/60 dark:text-red-100"
        : "bg-[#f1efe8] text-[#4a5140] hover:bg-[#e8e5dc] dark:bg-muted dark:text-muted-foreground",
  );

/** Organizer requests and system failures are the « hot » chips (red), like the mock-up. */
export const isHotType = (type: InboxType) => INBOX_TYPE_CONFIG[type].group === "organizers" || (INBOX_TYPE_CONFIG[type].group === "system" && type !== "post_draft");

const readSearch = () => (typeof window === "undefined" ? "" : window.location.search);

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="divide-y divide-[#e6e2d8] dark:divide-border">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3">
          <span className="h-[30px] w-[30px] animate-pulse rounded-[9px] bg-muted" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
            <span className="block h-2.5 w-1/3 animate-pulse rounded bg-muted" />
          </span>
          <span className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
        </li>
      ))}
    </ul>
  );
}
export { SkeletonRows as InboxSkeletonRows };

/**
 * The single « À traiter » queue: every pending item oldest first, filter chips by type and search,
 * both kept in the URL (`?filtre=bugs,survols&recherche=…`). Each row opens the screen where it is handled.
 */
export function InboxQueue({ accessToken }: { accessToken: string }) {
  const inbox = useAdminInbox(accessToken);
  const [types, setTypes] = useState<InboxType[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(readSearch());
    setTypes(readInboxFilter(params.get("filtre")));
    setSearch(params.get("recherche") ?? "");
  }, []);
  const updateUrl = (nextTypes: InboxType[], nextSearch: string) => {
    const params = new URLSearchParams(readSearch());
    const filter = writeInboxFilter(nextTypes);
    if (filter) params.set("filtre", filter);
    else params.delete("filtre");
    if (nextSearch.trim()) params.set("recherche", nextSearch.trim());
    else params.delete("recherche");
    const next = params.toString();
    replaceLocationSearch(next ? `?${next}` : "");
  };
  const toggleType = (type: InboxType) => {
    const next = types.includes(type) ? types.filter((candidate) => candidate !== type) : [...types, type];
    setTypes(next);
    updateUrl(next, search);
  };

  const data = inbox.data;
  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(() => countInboxByType(items), [items]);
  const visible = useMemo(() => filterInboxItems(items, { types, search }), [items, types, search]);
  const failedSources = data?.sources.filter((source) => !source.ok) ?? [];
  const nowMs = data ? Date.parse(data.generatedAt) : Date.now();

  return (
    <section aria-labelledby="inbox-queue-title" className="rounded-[14px] border border-[#e6e2d8] bg-card shadow-sm dark:border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
        <h2 id="inbox-queue-title" className="text-[15px] font-semibold">
          File unique{data ? <span className="ml-2 font-mono text-sm font-medium text-muted-foreground">{visible.length === items.length ? items.length : `${visible.length} / ${items.length}`}</span> : null}
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="inbox-search" className="sr-only">Rechercher dans la file</label>
          <input
            id="inbox-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              updateUrl(types, event.target.value);
            }}
            placeholder="Rechercher (course, e-mail…)"
            className="h-9 w-[min(260px,60vw)] rounded-[10px] border border-[#e6e2d8] bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border"
          />
          <button type="button" onClick={() => inbox.refetch()} className="inline-flex h-9 items-center rounded-[10px] border border-[#e6e2d8] bg-card px-3 text-sm font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:border-border">
            Actualiser
          </button>
        </div>
      </div>
      <div role="group" aria-label="Filtrer par type" className="flex flex-wrap gap-1.5 px-4 pb-3">
        <button type="button" aria-pressed={types.length === 0} onClick={() => { setTypes([]); updateUrl([], search); }} className={chipClass(types.length === 0, false)}>
          Tout <b className="font-mono">{items.length}</b>
        </button>
        {INBOX_TYPES.filter((type) => counts[type] > 0 || types.includes(type)).map((type) => (
          <button key={type} type="button" aria-pressed={types.includes(type)} onClick={() => toggleType(type)} className={chipClass(types.includes(type), isHotType(type))}>
            {INBOX_TYPE_CONFIG[type].label} <b className="font-mono">{counts[type]}</b>
            {INBOX_TYPE_CONFIG[type].counted ? null : <span className="font-normal opacity-80">(hors compteur)</span>}
          </button>
        ))}
      </div>
      {failedSources.length ? (
        <p role="status" className="mx-4 mb-3 rounded-lg bg-[#fef1e6] px-3 py-2 text-xs text-[#8a3f0b] dark:bg-orange-950/60 dark:text-orange-100">
          Sources non lues : {failedSources.map((source) => source.label).join(", ")}. Les autres éléments sont à jour.
        </p>
      ) : null}
      <div className="border-t border-[#e6e2d8] dark:border-border">
        {inbox.isLoading && !data ? (
          <SkeletonRows count={6} />
        ) : inbox.isError && !data ? (
          <div className="p-4">
            <EmptyState title="La file n’a pas pu être chargée" description={inbox.error instanceof Error ? inbox.error.message : undefined} action={<button type="button" className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={() => inbox.refetch()}>Réessayer</button>} />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={items.length ? "Aucun élément pour ce filtre" : "Rien à traiter"}
              description={items.length ? "Change de filtre ou efface la recherche." : "Tout est à jour : aucune demande ni aucun échec en attente."}
            />
          </div>
        ) : (
          <ul aria-label="Éléments à traiter">
            {visible.map((item) => <InboxRow key={item.id} item={item} nowMs={nowMs} today={data?.today ?? ""} />)}
          </ul>
        )}
      </div>
    </section>
  );
}
