"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, SVGProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import type { RacePlannerTranslations } from "../../../../locales/types";
import { Button } from "../../../../components/ui/button";
import { getFocusableElements, trapTabKey } from "../../../../components/ui/focus-trap";
import { getFormatLabelWithinEvent } from "../../../courses/_components/catalog-display";
import { RaceCatalogAdminForm } from "./RaceCatalogAdminForm";

const raceEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
});

const raceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location_text: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable().optional(),
  trace_provider: z.string().nullable().optional(),
  trace_id: z.number().nullable().optional(),
  external_site_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  event_id: z.string().uuid().nullable().optional(),
  race_date: z.string().nullable().optional(),
  race_events: raceEventSchema.nullable().optional(),
});

const responseSchema = z.object({
  races: z.array(raceSchema),
});

type CatalogRace = z.infer<typeof raceSchema>;

/** One event of the picker with its formats, like an event card of the app catalog. */
type CatalogEventGroup = {
  key: string;
  /** Null for a format without a readable parent event (shown as its own card). */
  eventName: string | null;
  location: string | null;
  date: string | null;
  thumbnailUrl: string | null;
  races: CatalogRace[];
  hasGpx: boolean;
};

type RaceCatalogModalProps = {
  open: boolean;
  isSubmittingId: string | null;
  accessToken?: string;
  isAdmin?: boolean;
  copy: RacePlannerTranslations["raceCatalog"] & { units: RacePlannerTranslations["units"] };
  onClose: () => void;
  onUseRace: (raceId: string) => void;
};

/** Same distance buckets as the mobile app catalog quick filters (`apps/mobile/app/(app)/catalog.tsx`). */
type QuickFilter = "all" | "short" | "trail" | "ultra";
const QUICK_FILTERS: QuickFilter[] = ["all", "short", "trail", "ultra"];

const matchesQuickFilter = (distanceKm: number, filter: QuickFilter) => {
  if (filter === "short") return distanceKm < 30;
  if (filter === "trail") return distanceKm >= 30 && distanceKm < 60;
  if (filter === "ultra") return distanceKm >= 60;
  return true;
};

const normalizeSearch = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);

const formatEventDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
};

const hasGpx = (race: CatalogRace) => Boolean(race.gpx_storage_path);

/** Today's calendar day (YYYY-MM-DD) in Europe/Paris, the timezone of the races, so "today" is the same for every visitor. */
export const getCatalogToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/**
 * Groups formats under their event and orders the cards: events with at least one usable GPX first, then events
 * without a trace, each block by next date ascending (a race dated today is still upcoming), undated events last.
 * Events dated before `today` are hidden: a picker of finished races is a dead end.
 */
export function groupCatalogRaces(races: CatalogRace[], today = getCatalogToday()): CatalogEventGroup[] {
  const groups = new Map<string, CatalogEventGroup>();
  for (const race of races) {
    const event = race.race_events ?? null;
    const key = event?.id ?? `race:${race.id}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        eventName: event?.name ?? null,
        location: event?.location ?? race.location_text ?? race.location ?? null,
        date: event?.race_date ?? race.race_date ?? null,
        thumbnailUrl: event?.thumbnail_url ?? race.thumbnail_url ?? null,
        races: [],
        hasGpx: false,
      };
      groups.set(key, group);
    }
    group.races.push(race);
  }

  const label = (group: CatalogEventGroup) => group.eventName ?? group.races[0]?.name ?? "";

  // A format repeated across yearly editions of the same event (same name) keeps only its latest edition,
  // like the app catalog which shows the current edition.
  const latestEditionOnly = (list: CatalogRace[]) => {
    const byName = new Map<string, CatalogRace>();
    for (const race of list) {
      const key = normalizeSearch(race.name);
      const kept = byName.get(key);
      if (!kept || (race.race_date ?? "") > (kept.race_date ?? "")) byName.set(key, race);
    }
    return Array.from(byName.values());
  };

  return Array.from(groups.values())
    .filter((group) => !group.date || group.date.slice(0, 10) >= today)
    .map((group) => {
      const races = latestEditionOnly(group.races).sort(
        (a, b) => Number(hasGpx(b)) - Number(hasGpx(a)) || a.distance_km - b.distance_km
      );
      return { ...group, races, hasGpx: races.some(hasGpx) };
    })
    .sort((a, b) => {
      if (a.hasGpx !== b.hasGpx) return a.hasGpx ? -1 : 1;
      if (a.date && b.date) {
        const dateDiff = a.date.slice(0, 10).localeCompare(b.date.slice(0, 10));
        if (dateDiff !== 0) return dateDiff;
      } else if (a.date || b.date) {
        return a.date ? -1 : 1;
      }
      return label(a).localeCompare(label(b));
    });
}

const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const ChevronIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const MountainIcon =(props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    <path d="m3 20 6.5-11 4 6.5 2.5-3.5L21 20H3Z" />
  </svg>
);

function EventCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex gap-3 border-b border-border p-3">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-muted" />
        <div className="flex flex-1 flex-col gap-2 py-1">
          <div className="h-4 w-3/5 rounded bg-muted" />
          <div className="h-3 w-2/5 rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="h-3 w-1/3 rounded bg-muted" />
        <div className="h-11 w-full rounded-xl bg-muted" />
      </div>
    </div>
  );
}

/**
 * Race picker of the planner ("Parcourir les courses"). Mirrors the mobile app catalog: full-screen sheet on
 * phones, centered panel on desktop, search + distance quick filters, one card per event listing its formats
 * with their map cotes (distance, D+) and a full-width primary action. The public catalog (`/courses`) is a
 * separate page and component.
 */
export function RaceCatalogModal({
  open,
  isSubmittingId,
  accessToken,
  isAdmin = false,
  copy,
  onClose,
  onUseRace,
}: RaceCatalogModalProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(normalizeSearch(search));
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [updatingRaceId, setUpdatingRaceId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // The whole live catalog is loaded once and searched client-side, so an event name also finds its formats.
  const query = useQuery({
    queryKey: ["race-catalog"],
    queryFn: async () => {
      const response = await fetch("/api/race-catalog", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load race catalog");
      }
      const payload = await response.json();
      return responseSchema.parse(payload);
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const races = useMemo(() => query.data?.races ?? [], [query.data?.races]);
  const visibleGroups = useMemo(() => {
    const filtered = races.filter((race) => {
      if (!matchesQuickFilter(race.distance_km, quickFilter)) return false;
      if (!deferredSearch) return true;
      const haystack = normalizeSearch(
        [race.name, race.race_events?.name, race.location_text, race.location, race.race_events?.location]
          .filter(Boolean)
          .join(" ")
      );
      return haystack.includes(deferredSearch);
    });
    return groupCatalogRaces(filtered);
  }, [races, quickFilter, deferredSearch]);

  // Modal behaviour: lock page scroll, focus the search field, restore focus on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    if (searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    } else if (panel) {
      (getFocusableElements(panel)[0] ?? panel).focus();
    }
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  const handleAdminCreated = (message?: string) => {
    setAdminError(null);
    setAdminMessage(message ?? copy.admin.messages.created);
    void queryClient.invalidateQueries({ queryKey: ["race-catalog"] });
  };

  const handleAdminError = (message?: string) => {
    setAdminMessage(null);
    setAdminError(message && message.length > 0 ? message : null);
  };
  const handleUpdateMutation = useMutation({
    mutationFn: async ({ raceId, file }: { raceId: string; file: File }) => {
      if (!accessToken) {
        throw new Error(copy.admin.errors.authRequired);
      }
      const formData = new FormData();
      formData.append("gpx", file);
      const response = await fetch(`/api/race-catalog/${raceId}/gpx`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken ?? ""}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? copy.admin.errors.updateFailed);
      }
      return response.json();
    },
    onSuccess: () => {
      setAdminError(null);
      setAdminMessage(copy.admin.messages.updated);
      void queryClient.invalidateQueries({ queryKey: ["race-catalog"] });
      setUpdatingRaceId(null);
    },
    onError: (error) => {
      setAdminMessage(null);
      setAdminError(error instanceof Error ? error.message : copy.admin.errors.updateFailed);
      setUpdatingRaceId(null);
    },
  });

  if (!open) return null;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    trapTabKey(event, event.currentTarget);
  };

  const showSkeleton = query.isLoading;
  const showEmpty = !query.isLoading && !query.isError && visibleGroups.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground shadow-2xl focus:outline-none sm:h-auto sm:max-h-[min(88vh,52rem)] sm:max-w-2xl sm:rounded-3xl sm:border sm:border-border"
      >
        <header className="flex-shrink-0 border-b border-border bg-card px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold leading-tight sm:text-xl">
                {copy.title}
              </h2>
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                {copy.description}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.close}
              className="-mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-3">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
              enterKeyHint="search"
              className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-11 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  searchInputRef.current?.focus();
                }}
                aria-label={copy.clearSearch}
                className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {QUICK_FILTERS.map((filter) => {
              const active = quickFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setQuickFilter(filter)}
                  className={`inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-background text-foreground hover:border-brand hover:text-brand"
                  }`}
                >
                  {copy.quickFilters[filter]}
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {isAdmin ? (
            <div className="mb-4 space-y-2">
              <RaceCatalogAdminForm
                accessToken={accessToken}
                copy={copy.admin}
                onCreated={handleAdminCreated}
                onError={handleAdminError}
              />
              {adminMessage ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{adminMessage}</p> : null}
              {adminError ? <p className="text-sm text-red-500">{adminError}</p> : null}
            </div>
          ) : null}

          {query.isError ? (
            <p className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
              {copy.loadError}
            </p>
          ) : null}

          {showSkeleton ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label={copy.loading}>
              <EventCardSkeleton />
              <EventCardSkeleton />
              <EventCardSkeleton />
            </div>
          ) : null}

          {showEmpty ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
              <MountainIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{copy.empty}</p>
            </div>
          ) : null}

          {!showSkeleton && visibleGroups.length > 0 ? (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground" aria-live="polite">
                {copy.resultsCount.replace("{count}", String(visibleGroups.length))}
              </p>
              <ul className="flex flex-col gap-3">
                {visibleGroups.map((group) => (
                  <li key={group.key}>
                    <EventCard
                      group={group}
                      copy={copy}
                      isAdmin={isAdmin}
                      isSubmittingId={isSubmittingId}
                      updatingRaceId={updatingRaceId}
                      onUseRace={onUseRace}
                      onUpdateGpx={(raceId, file) => {
                        setAdminMessage(null);
                        setAdminError(null);
                        setUpdatingRaceId(raceId);
                        handleUpdateMutation.mutate({ raceId, file });
                      }}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EventCard({
  group,
  copy,
  isAdmin,
  isSubmittingId,
  updatingRaceId,
  onUseRace,
  onUpdateGpx,
}: {
  group: CatalogEventGroup;
  copy: RaceCatalogModalProps["copy"];
  isAdmin: boolean;
  isSubmittingId: string | null;
  updatingRaceId: string | null;
  onUseRace: (raceId: string) => void;
  onUpdateGpx: (raceId: string, file: File) => void;
}) {
  const headingId = useId();
  const title = group.eventName ?? group.races[0]?.name ?? "";
  const meta = [formatEventDate(group.date), group.location].filter(Boolean).join(" · ");

  return (
    <article
      aria-labelledby={headingId}
      className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${group.hasGpx ? "" : "opacity-80"}`}
    >
      <div className="flex items-center gap-3 border-b border-border bg-brand-surface/60 p-3 sm:px-4">
        {group.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote catalog thumbnails, not optimized by Next.
          <img src={group.thumbnailUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-card object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-brand">
            <MountainIcon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-base font-bold leading-snug text-foreground">
            {title}
          </h3>
          {meta ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{meta}</p> : null}
        </div>
      </div>
      <ul className="divide-y divide-border">
        {group.races.map((race) => (
          <li key={race.id}>
            <FormatRow
              race={race}
              eventName={group.eventName}
              label={group.eventName ? getFormatLabelWithinEvent(race.name, group.eventName) : race.name}
              copy={copy}
              isAdmin={isAdmin}
              isSubmittingId={isSubmittingId}
              isUpdating={updatingRaceId === race.id}
              onUseRace={onUseRace}
              onUpdateGpx={(file) => onUpdateGpx(race.id, file)}
            />
          </li>
        ))}
      </ul>
    </article>
  );
}

function FormatRow({
  race,
  label,
  eventName,
  copy,
  isAdmin,
  isSubmittingId,
  isUpdating,
  onUseRace,
  onUpdateGpx,
}: {
  race: CatalogRace;
  label: string;
  eventName: string | null;
  copy: RaceCatalogModalProps["copy"];
  isAdmin: boolean;
  isSubmittingId: string | null;
  isUpdating: boolean;
  onUseRace: (raceId: string) => void;
  onUpdateGpx: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usable = hasGpx(race);
  const isSubmitting = isSubmittingId === race.id;

  const stats = (
    <span className="flex shrink-0 items-baseline gap-3">
      <span className="text-sm font-bold tabular-nums text-foreground">
        {formatNumber(race.distance_km, 1)}
        <span className="ml-0.5 text-xs font-semibold text-muted-foreground">{copy.units.kilometer}</span>
      </span>
      {race.elevation_gain_m !== null ? (
        <span className="text-sm font-bold tabular-nums text-foreground">
          <span className="mr-0.5 text-xs font-semibold text-muted-foreground">D+</span>
          {formatNumber(race.elevation_gain_m)}
          <span className="ml-0.5 text-xs font-semibold text-muted-foreground">{copy.units.meter}</span>
        </span>
      ) : null}
    </span>
  );

  const extras =
    race.trace_id || isAdmin ? (
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2 sm:px-4">
        {race.trace_id ? (
          <a
            href={`https://tracedetrail.fr/fr/trace/${race.trace_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center rounded-xl px-2 text-sm font-semibold text-brand hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.table.openTrace}
          </a>
        ) : null}
        {isAdmin ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                onUpdateGpx(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-xl px-3 text-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUpdating}
            >
              {isUpdating ? copy.admin.updating : copy.admin.updateAction}
            </Button>
          </>
        ) : null}
      </div>
    ) : null;

  return (
    <div>
      {usable ? (
        <button
          type="button"
          onClick={() => onUseRace(race.id)}
          disabled={Boolean(isSubmittingId)}
          aria-label={`${copy.useAction} : ${eventName ? `${eventName} ` : ""}${label}`}
          className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60 sm:px-4"
        >
          <span className="min-w-0 flex-1 break-words text-[15px] font-bold leading-snug text-foreground">{label}</span>
          {stats}
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand">
            {isSubmitting ? copy.using : null}
            <ChevronIcon className="h-4 w-4" />
          </span>
        </button>
      ) : (
        <div className="flex min-h-10 items-center gap-3 px-3 py-2 opacity-70 sm:px-4">
          <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-muted-foreground">{label}</span>
          {stats}
          <span className="shrink-0 text-xs text-muted-foreground">{copy.table.noGpx}</span>
        </div>
      )}
      {extras}
    </div>
  );
}
