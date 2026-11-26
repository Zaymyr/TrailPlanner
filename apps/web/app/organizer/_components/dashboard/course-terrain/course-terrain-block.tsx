"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CourseTerrain, CourseTerrainOverride, OrganizerCourseTerrain } from "@trailplanner/shared";
import { Button } from "../../../../../components/ui/button";
import {
  fetchOrganizerCourseTerrain,
  saveOrganizerCourseTerrainOverrides,
} from "../../../../../lib/organizer-course-terrain-client";
import { TerrainSegmentsEditor } from "./terrain-editor";
import { TerrainAttribution, TerrainBand, TerrainSummaryList } from "./terrain-band";
import {
  formatPct,
  overridesEqual,
  previewTerrain,
  selectTerrainViewState,
  validateOverrides,
} from "./terrain-editing";

type Props = {
  raceId: string | null;
  headers: Record<string, string>;
  /** Locked editor (save in progress, upload…): the block stays visible but cannot be edited. */
  readOnly?: boolean;
  /** Changes when the GPX is replaced or removed, to refetch the terrain. */
  gpxKey?: string | null;
  onNotify?: (type: "success" | "error", message: string) => void;
};

const STATUS_MESSAGES = {
  pending: "Analyse du terrain en cours, revenez dans quelques minutes.",
  no_route: "Ajoutez un GPX pour obtenir le terrain.",
  failed: "Le terrain n’a pas pu être déduit pour ce parcours pour le moment.",
  error: "Terrain indisponible pour le moment.",
} as const;

export function CourseTerrainBlock({ raceId, headers, readOnly = false, gpxKey = null, onNotify }: Props) {
  const [data, setData] = useState<OrganizerCourseTerrain | null>(null);
  const [load, setLoad] = useState<"loading" | "error" | "idle">("loading");
  const [draft, setDraft] = useState<CourseTerrainOverride[]>([]);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  useEffect(() => {
    if (!raceId) return;
    const controller = new AbortController();
    setLoad("loading");
    setData(null);
    fetchOrganizerCourseTerrain(raceId, headersRef.current, { signal: controller.signal })
      .then((payload) => {
        setData(payload);
        setDraft(payload.overrides);
        setLoad("idle");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoad("error");
      });
    return () => controller.abort();
  }, [raceId, gpxKey, reloadToken]);

  const view = selectTerrainViewState(data, load);
  const terrain: CourseTerrain | null = data && data.terrain.status === "ready" ? data.terrain : null;
  const distanceKm = terrain?.distanceKm ?? 0;
  const preview = useMemo(
    () => (data && terrain ? previewTerrain(data.osmSegments, draft, distanceKm) : null),
    [data, terrain, draft, distanceKm],
  );
  const dirty = data ? !overridesEqual(draft, data.overrides) : false;
  const locked = readOnly || saving;

  const save = useCallback(async () => {
    if (!raceId || !data || !terrain || saving) return;
    const validation = validateOverrides(draft, terrain.distanceKm);
    if (!validation.ok) {
      notifyRef.current?.("error", validation.errors[0]);
      return;
    }
    const previous = data;
    setSaving(true);
    setData({ ...data, overrides: draft }); // optimistic: the saved state follows the draft immediately
    try {
      const saved = await saveOrganizerCourseTerrainOverrides(raceId, { overrides: draft }, headersRef.current);
      setData(saved);
      setDraft(saved.overrides);
      notifyRef.current?.("success", "Terrain enregistré.");
    } catch {
      setData(previous); // rollback; the draft is kept so no edit is lost
      notifyRef.current?.("error", "Le terrain n’a pas pu être enregistré. Réessayez.");
    } finally {
      setSaving(false);
    }
  }, [data, draft, raceId, saving, terrain]);

  if (!raceId) return null;

  return (
    <section aria-labelledby="course-terrain-title" className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 id="course-terrain-title" className="font-semibold text-foreground">Terrain du parcours</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Les coureurs voient le terrain corrigé dans le Livret coureur. Le terrain est informatif : il ne modifie pas les temps estimés.
        </p>
      </div>

      {view === "loading" ? (
        <div role="status" aria-label="Chargement du terrain" className="h-16 animate-pulse rounded-md bg-muted" />
      ) : null}

      {view === "error" || view === "pending" || view === "no_route" || view === "failed" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          <p role="status">{STATUS_MESSAGES[view]}</p>
          {view !== "no_route" ? (
            <Button type="button" variant="ghost" className="!min-h-9 !px-2" onClick={() => setReloadToken((token) => token + 1)}>
              Actualiser
            </Button>
          ) : null}
        </div>
      ) : null}

      {view === "ready" && terrain && data && preview ? (
        <div className="space-y-4">
          {data.overridesNeedReview ? (
            <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Le GPX a changé depuis vos corrections : vérifiez les kilomètres.
            </p>
          ) : null}
          <TerrainBand segments={preview.segments} distanceKm={distanceKm} />
          <TerrainSummaryList summary={preview.summary} />
          <p className="text-xs text-muted-foreground">
            Terrain déduit d’OpenStreetMap ; {formatPct(terrain.coverage.matchedPct)} du tracé retrouvé sur un chemin cartographié.{" "}
            <TerrainAttribution />
          </p>
          <TerrainSegmentsEditor
            segments={preview.segments}
            osmSegments={data.osmSegments}
            overrides={draft}
            distanceKm={distanceKm}
            readOnly={locked}
            onOverridesChange={setDraft}
          />
          {!readOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? "Enregistrement…" : "Enregistrer le terrain"}
              </Button>
              {dirty && !saving ? (
                <Button type="button" variant="ghost" onClick={() => setDraft(data.overrides)}>Annuler les modifications</Button>
              ) : null}
              {dirty && !saving ? <span className="text-xs text-muted-foreground">Modifications non enregistrées.</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
