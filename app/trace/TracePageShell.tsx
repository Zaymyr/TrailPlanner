"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { TraceMap } from "../../components/trace/TraceMap";
import { TraceSidebar } from "../../components/trace/TraceSidebar";
import { useI18n } from "../i18n-provider";
import { useTraceEditor } from "../hooks/useTraceEditor";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { copyGpxToClipboard, downloadGpx } from "../../lib/trace/gpx";
import { traceKeys } from "../../lib/queryKeys";
import {
  deleteTrace as deleteTraceApi,
  duplicateTrace as duplicateTraceApi,
  fetchTraceById,
  saveTrace as saveTraceApi,
} from "../../lib/trace/traceRepo";
import { requestRoutedPath } from "../../lib/trace/routingProvider";

type TracePageShellProps = {
  initialAccessToken: string | null;
};

type Status = { type: "success" | "error"; message: string } | null;

export function TracePageShell({ initialAccessToken }: TracePageShellProps) {
  const router = useRouter();
  const { session, isLoading } = useVerifiedSession();
  const accessToken = session?.accessToken ?? initialAccessToken;
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>(null);
  const [activeTraceId, setActiveTraceId] = useState<string | undefined>(undefined);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  const {
    state,
    isValid,
    payload,
    loadTrace,
    updateName,
    updateVisibility,
    addPoint,
    undoPoint,
    clearPoints,
    addAidStation,
    reset,
  } = useTraceEditor();

  useEffect(() => {
    if (!isLoading && !accessToken) {
      router.replace("/sign-in");
    }
  }, [accessToken, isLoading, router]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error(t.trace.statuses.missingSession);
      }
      return saveTraceApi(accessToken, payload);
    },
    onSuccess: (detail) => {
      loadTrace(detail);
      setActiveTraceId(detail.trace.id);
      setStatus({ type: "success", message: t.trace.statuses.saved });
      void queryClient.invalidateQueries({ queryKey: traceKeys.all });
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : t.trace.statuses.loadFailed,
      });
    },
  });

  const loadTraceById = async (id: string) => {
    if (!accessToken) {
      setStatus({ type: "error", message: t.trace.statuses.missingSession });
      return;
    }
    try {
      const detail = await fetchTraceById(accessToken, id);
      loadTrace(detail);
      setActiveTraceId(id);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : t.trace.statuses.loadFailed,
      });
    }
  };

  const duplicateTrace = async (id: string) => {
    if (!accessToken) {
      setStatus({ type: "error", message: t.trace.statuses.missingSession });
      return;
    }
    try {
      const detail = await duplicateTraceApi(accessToken, id);
      loadTrace(detail);
      setActiveTraceId(detail.trace.id);
      setStatus({ type: "success", message: t.trace.statuses.duplicated });
      void queryClient.invalidateQueries({ queryKey: traceKeys.all });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : t.trace.statuses.duplicateFailed,
      });
    }
  };

  const deleteTrace = async (id: string) => {
    if (!accessToken) {
      setStatus({ type: "error", message: t.trace.statuses.missingSession });
      return;
    }
    try {
      await deleteTraceApi(accessToken, id);
      void queryClient.invalidateQueries({ queryKey: traceKeys.all });
      reset();
      setActiveTraceId(undefined);
      setStatus({ type: "success", message: t.trace.statuses.deleted });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : t.trace.statuses.deleteFailed,
      });
    }
  };

  const handleAddPoint = async (coords: { lat: number; lng: number; elevation?: number | null }) => {
    if (isRouting) return;
    setRoutingError(null);
    setIsRouting(true);

    try {
      if (state.points.length === 0) {
        addPoint(coords);
      } else {
        const last = state.points[state.points.length - 1];
        const route = await requestRoutedPath([
          { lat: last.lat, lng: last.lng },
          { lat: coords.lat, lng: coords.lng },
        ]);

        const newCoords = route.coordinates.length > 0 ? route.coordinates : [coords];
        newCoords.slice(1).forEach((point) => addPoint({ lat: point.lat, lng: point.lng, elevation: null }));
      }
    } catch (error) {
      console.error("Unable to add routed point", error);
      setRoutingError(t.trace.statuses.routingError);
      addPoint(coords);
    } finally {
      setIsRouting(false);
    }
  };

  const handleAddAidStation = (coords: { lat: number; lng: number }) => {
    const name = `Aid ${state.aidStations.length + 1}`;
    addAidStation({ ...coords, name });
  };

  const handleDownloadGpx = () => {
    try {
      downloadGpx({ name: state.name || "Trace", points: state.points, aidStations: state.aidStations });
      setStatus({ type: "success", message: t.trace.statuses.downloaded });
    } catch (error) {
      console.error("Unable to download GPX", error);
      setStatus({ type: "error", message: t.trace.statuses.gpxError });
    }
  };

  const handleCopyGpx = async () => {
    try {
      await copyGpxToClipboard({ name: state.name || "Trace", points: state.points, aidStations: state.aidStations });
      setStatus({ type: "success", message: t.trace.statuses.copied });
    } catch (error) {
      console.error("Unable to copy GPX", error);
      setStatus({ type: "error", message: t.trace.statuses.gpxError });
    }
  };

  const disableActions = !accessToken || !isValid || saveMutation.isPending;

  const statusBanner = status ? (
    <div
      className={`rounded-md px-3 py-2 text-sm ${
        status.type === "success" ? "bg-emerald-500/10 text-emerald-50" : "bg-red-500/10 text-red-200"
      }`}
    >
      {status.message}
    </div>
  ) : null;

  const summary = useMemo(
    () => ({
      totalPoints: state.points.length,
      totalAid: state.aidStations.length,
    }),
    [state.aidStations.length, state.points.length]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      {accessToken ? (
        <TraceSidebar
          accessToken={accessToken}
          currentUserId={session?.id}
          activeTraceId={activeTraceId}
          onLoadTrace={loadTraceById}
          onDuplicate={duplicateTrace}
          onDelete={deleteTrace}
          onCreateNew={() => {
            reset();
            setActiveTraceId(undefined);
          }}
          lastSavedTrace={null}
        />
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-emerald-400/40 bg-slate-900/80 p-4 shadow-lg">
          <div className="grid gap-3 md:grid-cols-[2fr,1fr] md:items-center">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-emerald-100" htmlFor="trace-name">
                {t.trace.form.nameLabel}
              </label>
              <input
                id="trace-name"
                type="text"
                value={state.name}
                onChange={(event) => updateName(event.target.value)}
                placeholder={t.trace.form.namePlaceholder}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-emerald-50 outline-none focus:border-emerald-400"
              />
              <label className="flex items-center gap-2 text-sm text-emerald-50">
                <input
                  type="checkbox"
                  checked={state.isPublic}
                  onChange={(event) => updateVisibility(event.target.checked)}
                  className="h-4 w-4 rounded border border-slate-500 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                />
                <span>{t.trace.form.publicToggle}</span>
              </label>
              <p className="text-xs text-slate-400">
                {t.trace.form.statsLabel
                  .replace("{points}", summary.totalPoints.toString())
                  .replace("{aid}", summary.totalAid.toString())}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={disableActions}
                onClick={() => saveMutation.mutate()}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveMutation.isPending ? t.trace.form.saving : t.trace.form.save}
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadGpx}
                  className="rounded-md border border-emerald-400 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/10"
                >
                  {t.trace.form.downloadGpx}
                </button>
                <button
                  type="button"
                  onClick={handleCopyGpx}
                  className="rounded-md border border-emerald-400 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/10"
                >
                  {t.trace.form.copyGpx}
                </button>
              </div>
            </div>
          </div>
          {statusBanner}
          {!isValid ? <p className="mt-2 text-sm text-amber-400">{t.trace.form.validationMissing}</p> : null}
        </div>

        <TraceMap
          points={state.points}
          aidStations={state.aidStations}
          onAddPoint={handleAddPoint}
          onUndo={undoPoint}
          onClear={clearPoints}
          onAddAidStation={handleAddAidStation}
          isRouting={isRouting}
          routingError={routingError}
        />
      </div>
    </div>
  );
}
