"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useI18n } from "../../app/i18n-provider";
import { traceKeys } from "../../lib/queryKeys";
import type { TraceDetailView, TraceSummaryView } from "../../lib/trace/traceRepo";
import { fetchTraceLists } from "../../lib/trace/traceRepo";

type TraceSidebarProps = {
  accessToken: string;
  currentUserId?: string;
  activeTraceId?: string;
  onLoadTrace: (id: string) => void | Promise<void>;
  onDuplicate: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onCreateNew: () => void | Promise<void>;
  lastSavedTrace?: TraceDetailView | null;
};

type TraceSectionProps = {
  title: string;
  traces: TraceSummaryView[];
  variant?: "my" | "public";
  currentUserId?: string;
  activeTraceId?: string;
  onLoad: (id: string) => void | Promise<void>;
  onDuplicate: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
};

export function TraceSidebar({
  accessToken,
  currentUserId,
  activeTraceId,
  onLoadTrace,
  onDuplicate,
  onDelete,
  onCreateNew,
  lastSavedTrace,
}: TraceSidebarProps) {
  const [search, setSearch] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const traceQuery = useQuery({
    queryKey: [...traceKeys.lists(search), accessToken] as const,
    queryFn: () => fetchTraceLists(accessToken, search),
    staleTime: 1000 * 30,
  });

  const invalidateLists = () => {
    void queryClient.invalidateQueries({ queryKey: traceKeys.all });
  };

  const handleDuplicate = async (id: string) => {
    await onDuplicate(id);
    invalidateLists();
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
    invalidateLists();
  };

  const content = (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-emerald-300/40 bg-slate-900/80 p-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-emerald-100">{t.trace.title}</h2>
        <button
          type="button"
          className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          onClick={onCreateNew}
        >
          {t.trace.newTrace}
        </button>
      </div>

      <input
        type="search"
        placeholder={t.trace.searchPlaceholder}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-emerald-50 outline-none focus:border-emerald-400"
      />

      {traceQuery.isLoading ? (
        <p className="text-sm text-slate-300">{t.trace.loading}</p>
      ) : traceQuery.error ? (
        <p className="text-sm text-amber-400">{t.trace.error}</p>
      ) : traceQuery.data ? (
        <div className="flex flex-col gap-6 overflow-y-auto">
          <TraceSection
            title={t.trace.myTraces}
            variant="my"
            currentUserId={currentUserId}
            traces={traceQuery.data.myTraces}
            onLoad={onLoadTrace}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            activeTraceId={activeTraceId}
          />
          <TraceSection
            title={t.trace.publicTraces}
            variant="public"
            currentUserId={currentUserId}
            traces={traceQuery.data.publicTraces}
            onLoad={onLoadTrace}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            activeTraceId={activeTraceId}
          />
        </div>
      ) : (
        <p className="text-sm text-slate-300">No traces yet.</p>
      )}

      {lastSavedTrace ? (
        <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 p-3 text-sm text-emerald-50">
          <p className="font-semibold">{t.trace.lastSaved}</p>
          <p>{lastSavedTrace.trace.name}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="hidden md:block">{content}</div>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="mb-3 w-full rounded-md border border-emerald-400 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300"
        >
          {t.trace.drawerOpen}
        </button>
        {isDrawerOpen ? (
          <div className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur">
            <div className="absolute inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl border border-emerald-400/40 bg-slate-900 p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-emerald-100">{t.trace.title}</h2>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-md bg-slate-800 px-3 py-1 text-sm text-emerald-50"
                >
                  {t.trace.drawerClose}
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">{content}</div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function TraceSection({
  title,
  traces,
  variant = "my",
  currentUserId,
    activeTraceId,
    onLoad,
    onDuplicate,
    onDelete,
  }: TraceSectionProps) {
  const { t } = useI18n();
  const emptyLabel = useMemo(() => {
    if (variant === "my") return t.trace.noMyTraces;
    return t.trace.noPublicTraces;
  }, [t.trace.noMyTraces, t.trace.noPublicTraces, variant]);

  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">{title}</h3>
      </div>
      {traces.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {traces.map((trace) => {
            const isOwner = currentUserId === trace.ownerId;
            return (
              <li
                key={trace.id}
                className={`rounded-lg border px-3 py-2 transition ${
                  activeTraceId === trace.id
                    ? "border-emerald-400 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-900/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-emerald-50">{trace.name}</span>
                    <span className="text-[11px] text-slate-400">
                      {isOwner ? t.trace.ownerYou : `${t.trace.ownerLabel}: ${trace.ownerId.slice(0, 8)}…`} •{" "}
                      {new Date(trace.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      trace.isPublic ? "bg-emerald-500/20 text-emerald-50" : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {trace.isPublic ? t.trace.publicBadge : t.trace.privateBadge}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => onLoad(trace.id)}
                    className="rounded-md bg-emerald-500 px-3 py-1 font-semibold text-slate-950 transition hover:bg-emerald-400"
                  >
                    {t.trace.load}
                  </button>
                  {!isOwner ? (
                    <button
                      type="button"
                      onClick={() => onDuplicate(trace.id)}
                      className="rounded-md border border-emerald-400 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-500/10"
                    >
                      {t.trace.duplicate}
                    </button>
                  ) : null}
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => onDelete(trace.id)}
                      className="rounded-md border border-red-400 px-3 py-1 font-semibold text-red-200 transition hover:bg-red-500/10"
                    >
                      {t.trace.delete}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
