"use client";

import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";

import { parseGpx, type GpxPoint } from "../lib/gpx/parseGpx";
import { Button } from "./ui/button";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Race = {
  id: string;
  name: string;
  distance_km: number;
};

export type RaceAidStation = {
  id: string;
  race_id: string;
  name: string;
  km: number;
  water_available: boolean;
  notes: string | null;
  order_index: number;
  needs_review: boolean;
  last_gpx_import_at: string | null;
};

type MergeAction = "insert" | "update" | "delete";

type MergedStation = {
  /** DB id — present for update / delete rows */
  existingId?: string;
  name: string;
  km: number;
  water_available: boolean;
  notes: string | null;
  order_index: number;
  action: MergeAction;
  /** Whether this row is included in the save */
  included: boolean;
  /** True when a delete-action station has linked plan_aid_stations */
  hasLinkedPlans: boolean;
};

type Props = {
  race: Race;
  existingStations: RaceAidStation[];
  onDone: () => void;
  /** Supabase access token for authenticated writes */
  accessToken?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6_371_000;
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Returns the cumulative km of the track point closest to the given coordinates. */
const findNearestKm = (lat: number, lng: number, points: GpxPoint[]): number => {
  let minDist = Infinity;
  let nearestKm = 0;
  for (const p of points) {
    const d = haversineMeters(lat, lng, p.lat, p.lng);
    if (d < minDist) {
      minDist = d;
      nearestKm = p.distKmCum;
    }
  }
  return nearestKm;
};

const KM_TOLERANCE = 1.5;

/**
 * Merges GPX waypoints with existing DB stations.
 *  - Same name (case-insensitive) OR km within ±1.5 km  → action "update"
 *  - GPX waypoint not matched                           → action "insert"
 *  - Existing station not matched by any GPX waypoint   → action "delete"
 */
const mergeStations = (
  gpxStations: Array<{ name: string; km: number }>,
  existing: RaceAidStation[],
): MergedStation[] => {
  const usedExistingIds = new Set<string>();
  const merged: MergedStation[] = [];

  for (let i = 0; i < gpxStations.length; i++) {
    const gpx = gpxStations[i];

    // Name match takes priority, then km proximity
    let match = existing.find(
      (e) => !usedExistingIds.has(e.id) && e.name.toLowerCase() === gpx.name.toLowerCase(),
    );
    if (!match) {
      match = existing.find(
        (e) => !usedExistingIds.has(e.id) && Math.abs(e.km - gpx.km) <= KM_TOLERANCE,
      );
    }

    if (match) {
      usedExistingIds.add(match.id);
      merged.push({
        existingId: match.id,
        name: gpx.name,
        km: gpx.km,
        water_available: match.water_available,
        notes: match.notes,
        order_index: i,
        action: "update",
        included: true,
        hasLinkedPlans: false,
      });
    } else {
      merged.push({
        name: gpx.name,
        km: gpx.km,
        water_available: false,
        notes: null,
        order_index: i,
        action: "insert",
        included: true,
        hasLinkedPlans: false,
      });
    }
  }

  // Unmatched existing stations → delete
  for (const e of existing) {
    if (!usedExistingIds.has(e.id)) {
      merged.push({
        existingId: e.id,
        name: e.name,
        km: e.km,
        water_available: e.water_available,
        notes: e.notes,
        order_index: e.order_index,
        action: "delete",
        included: true,
        hasLinkedPlans: false,
      });
    }
  }

  return merged;
};

const createSupabaseClient = (accessToken?: string) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, key, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
};

// ─── Subcomponents ───────────────────────────────────────────────────────────

const ACTION_BADGE: Record<MergeAction, ReactNode> = {
  insert: (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
      Nouveau
    </span>
  ),
  update: (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-400/20 dark:text-blue-300">
      Mise à jour
    </span>
  ),
  delete: (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-400/20 dark:text-red-300">
      Suppression
    </span>
  ),
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function GpxAidStationImporter({ race, existingStations, onDone, accessToken }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [stations, setStations] = useState<MergedStation[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1 & 2: parse GPX + merge ──────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      setParseError(null);
      setSaveError(null);
      try {
        const content = await file.text();
        const parsed = parseGpx(content);

        if (parsed.waypoints.length === 0) {
          setParseError("Aucun waypoint (<wpt>) trouvé dans ce fichier GPX. Vérifiez que votre fichier contient bien des points de passage.");
          return;
        }

        // Map each waypoint to its km on the track
        const gpxStations = parsed.waypoints
          .map((wpt) => ({
            name: wpt.name?.trim() || wpt.desc?.trim() || "Station sans nom",
            km: findNearestKm(wpt.lat, wpt.lng, parsed.points),
          }))
          .sort((a, b) => a.km - b.km);

        const merged = mergeStations(gpxStations, existingStations);

        // Check which delete-action stations have linked user plans
        const deleteIds = merged
          .filter((m) => m.action === "delete" && m.existingId)
          .map((m) => m.existingId as string);

        if (deleteIds.length > 0) {
          try {
            const supabase = createSupabaseClient(accessToken);
            const { data } = await supabase
              .from("plan_aid_stations")
              .select("race_aid_station_id")
              .in("race_aid_station_id", deleteIds);

            const linkedIds = new Set(
              (data ?? []).map((r: { race_aid_station_id: string }) => r.race_aid_station_id),
            );

            setStations(
              merged.map((m) => ({
                ...m,
                hasLinkedPlans: m.existingId ? linkedIds.has(m.existingId) : false,
              })),
            );
            return;
          } catch {
            // If the check fails, proceed without linked-plan info
          }
        }

        setStations(merged);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Erreur lors du parsing du fichier GPX.");
      }
    },
    [existingStations, accessToken],
  );

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  // ── Step 3: editable table helpers ────────────────────────────────────────

  const updateStation = (index: number, patch: Partial<MergedStation>) => {
    setStations((prev: MergedStation[] | null) => (prev ? prev.map((s: MergedStation, i: number) => (i === index ? { ...s, ...patch } : s)) : prev));
  };

  // ── Step 4: save to Supabase ───────────────────────────────────────────────

  const handleSave = async () => {
    if (!stations) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      setSaveError("Configuration Supabase manquante (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    const supabase = createSupabaseClient(accessToken);
    const now = new Date().toISOString();

    try {
      const included = stations.filter((s: MergedStation) => s.included);

      for (const s of included) {
        if (s.action === "insert") {
          const { error } = await supabase.from("race_aid_stations").insert({
            race_id: race.id,
            name: s.name,
            km: s.km,
            water_available: s.water_available,
            notes: s.notes,
            order_index: s.order_index,
            needs_review: false,
            last_gpx_import_at: now,
          });
          if (error) throw new Error(error.message);
        } else if (s.action === "update" && s.existingId) {
          const { error } = await supabase
            .from("race_aid_stations")
            .update({
              name: s.name,
              km: s.km,
              water_available: s.water_available,
              notes: s.notes,
              order_index: s.order_index,
              needs_review: false,
              last_gpx_import_at: now,
            })
            .eq("id", s.existingId);
          if (error) throw new Error(error.message);
        } else if (s.action === "delete" && s.existingId) {
          if (s.hasLinkedPlans) {
            // Keep the row but flag it for admin review
            const { error } = await supabase
              .from("race_aid_stations")
              .update({ needs_review: true })
              .eq("id", s.existingId);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await supabase.from("race_aid_stations").delete().eq("id", s.existingId);
            if (error) throw new Error(error.message);
          }
        }
      }

      onDone();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render: validation table ───────────────────────────────────────────────

  if (stations) {
    const includedCount = stations.filter((s: MergedStation) => s.included).length;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Validation des ravitaillements — {race.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stations.length} station(s) détectée(s) · {includedCount} sélectionnée(s)
            </p>
          </div>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => {
              setStations(null);
              setParseError(null);
            }}
          >
            Recommencer
          </Button>
        </div>

        {/* Editable table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                <th className="w-8 px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400" />
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Nom</th>
                <th className="w-28 px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">km</th>
                <th className="w-16 px-3 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">Eau</th>
                <th className="w-32 px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s: MergedStation, i: number) => (
                <tr
                  key={i}
                  className={[
                    "border-b border-slate-100 last:border-0 dark:border-slate-800",
                    s.action === "delete"
                      ? "bg-red-50 dark:bg-red-950/20"
                      : "bg-white dark:bg-slate-900/10",
                    !s.included ? "opacity-40" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {/* Include checkbox */}
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={s.included}
                      onChange={(e) => updateStation(i, { included: e.target.checked })}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-500 dark:border-slate-600"
                    />
                  </td>

                  {/* Name */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => updateStation(i, { name: e.target.value })}
                      className="w-full rounded bg-transparent text-sm text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 dark:text-slate-50"
                    />
                    {s.action === "delete" && s.hasLinkedPlans && (
                      <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                        Plans utilisateurs liés — sera marquée pour révision au lieu d&apos;être supprimée
                      </p>
                    )}
                  </td>

                  {/* km */}
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={s.km.toFixed(2)}
                      onChange={(e) => updateStation(i, { km: parseFloat(e.target.value) || 0 })}
                      className="w-24 rounded bg-transparent text-sm text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 dark:text-slate-50"
                    />
                  </td>

                  {/* Water */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={s.water_available}
                      onChange={(e) => updateStation(i, { water_available: e.target.checked })}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-500 dark:border-slate-600"
                    />
                  </td>

                  {/* Action badge */}
                  <td className="px-3 py-2">{ACTION_BADGE[s.action]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Errors & actions */}
        {saveError ? <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="h-9 px-4 text-sm"
            disabled={isSaving}
            onClick={() => setStations(null)}
          >
            Annuler
          </Button>
          <Button
            className="h-9 px-4 text-sm"
            disabled={isSaving || includedCount === 0}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Enregistrement…" : `Confirmer (${includedCount} station${includedCount > 1 ? "s" : ""})`}
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: drop zone ──────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Zone de dépôt de fichier GPX"
        className={[
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500",
          isDragging
            ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/20"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900/30 dark:hover:border-slate-500",
        ].join(" ")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => void handleDrop(e)}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
      >
        {/* Upload icon */}
        <svg
          className="mb-3 h-10 w-10 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Glisser-déposer un fichier GPX
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ou cliquer pour choisir</p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className="sr-only"
          onChange={(e) => void handleFileChange(e)}
        />
      </div>

      {parseError ? <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p> : null}
    </div>
  );
}
