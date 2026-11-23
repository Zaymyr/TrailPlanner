"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { parseGpx } from "../../../../lib/gpx/parseGpx";
import type { AdminTranslations } from "../../../../locales/types";
import {
  aidStationPayload,
  aidStationRowSchema,
  aidStationRowsToDrafts,
  appendAidStationDraft,
  canEnrichFromTraceDeTrail,
  editFormSchema,
  hasInvalidAidStation,
  imageFileProblem,
  normalizeAidStationDrafts,
  raceEditDefaults,
  racePatchBody,
  type AidStationDraft,
  type AidStationRow,
  type EditFormValues,
  type ParsedPreview,
  type RaceEventRow,
  type RaceRow,
} from "./race-catalog-model";
import type { TraceDeTrailCredentials } from "./TraceDeTrailImportDialog";

/**
 * « Modifier la course » (opened from a row or `?course=<id>`): metadata (PATCH `/api/race-catalog/[id]`),
 * GPX replacement (PUT `…/gpx`) or Trace de Trail re-import (`enrich`, with the shared session), aid
 * stations (GET / PUT `…/aid-stations`), image (PUT `…/thumbnail`). Same requests and messages as before
 * lot 5; messages and errors are shown by the section.
 */
export function EditRaceDialog({ accessToken, t, race, eventRows, credentials, onClose, onMessage, onError, onSaved }: {
  accessToken?: string;
  t: AdminTranslations["raceCatalog"];
  race: RaceRow | null;
  eventRows: RaceEventRow[];
  credentials: TraceDeTrailCredentials;
  onClose: () => void;
  onMessage: (message: string) => void;
  /** `clearMessage`: a failed save also hides the last success message (as the former mutation did). */
  onError: (message: string | null, clearMessage?: boolean) => void;
  /** A save that closes the dialog (metadata or Trace de Trail import): message, then refresh the list. */
  onSaved: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editRace, setEditRace] = useState<RaceRow | null>(race);
  const [editGpxFile, setEditGpxFile] = useState<File | null>(null);
  const [editGpxPreview, setEditGpxPreview] = useState<ParsedPreview | null>(null);
  const [editGpxError, setEditGpxError] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageError, setEditImageError] = useState<string | null>(null);
  const [isUploadingGpx, setIsUploadingGpx] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editAidStations, setEditAidStations] = useState<AidStationDraft[]>([]);
  const [editAidStationsError, setEditAidStationsError] = useState<string | null>(null);
  const [isSavingAidStations, setIsSavingAidStations] = useState(false);

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
  });

  // Opening on a race resets the form and every file / aid-station draft (former `handleOpenEdit`).
  useEffect(() => {
    setEditRace(race);
    if (race) editForm.reset(raceEditDefaults(race));
    setEditGpxFile(null);
    setEditGpxPreview(null);
    setEditGpxError(null);
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditImageError(null);
    setEditAidStations([]);
    setEditAidStationsError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race]);

  const invalidateCatalog = () => queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });

  const editAidStationsQuery = useQuery({
    queryKey: ["admin", "race-catalog", editRace?.id, "aid-stations"],
    enabled: Boolean(editRace?.id),
    queryFn: async () => {
      if (!editRace) return [];
      const response = await fetch(`/api/race-catalog/${editRace.id}/aid-stations`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.errors.loadFailed);
      }
      const parsed = z.object({ aidStations: z.array(aidStationRowSchema) }).safeParse(data);
      if (!parsed.success) throw new Error(t.errors.loadFailed);
      return parsed.data.aidStations;
    },
  });

  useEffect(() => {
    if (!editAidStationsQuery.data) return;
    setEditAidStations(aidStationRowsToDrafts(editAidStationsQuery.data));
    setEditAidStationsError(null);
  }, [editAidStationsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string } & Partial<EditFormValues>) => {
      const { id, ...fields } = payload;
      const response = await fetch(`/api/race-catalog/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(racePatchBody(fields)),
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.errors.updateFailed);
      }
    },
    onSuccess: () => onSaved(t.messages.updated),
    onError: (err) => onError(err instanceof Error ? err.message : t.errors.updateFailed, true),
  });

  const traceDeTrailEnrichMutation = useMutation({
    mutationFn: async (raceId: string) => {
      const response = await fetch("/api/admin/race-catalog/tracedetrail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ raceId, action: "enrich", credentials: credentials.credentials }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; race?: RaceRow }
        | null;

      if (!response.ok || !data?.race) {
        throw new Error(data?.message ?? t.errors.traceDeTrailImportFailed);
      }

      return data;
    },
    onSuccess: () => {
      setEditGpxError(null);
      onSaved(t.messages.imported);
    },
    onError: (err) => {
      setEditGpxError(err instanceof Error ? err.message : t.errors.traceDeTrailImportFailed);
    },
  });

  const handleEditGpxChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditGpxFile(file);
    setEditGpxError(null);
    try {
      const content = await file.text();
      const parsed = parseGpx(content);
      setEditGpxPreview({
        distanceKm: parsed.stats.distanceKm,
        gainM: parsed.stats.gainM,
        lossM: parsed.stats.lossM,
        waypointCount: parsed.waypoints.length,
      });
    } catch (error) {
      setEditGpxPreview(null);
      setEditGpxError(error instanceof Error ? `${t.errors.invalidGpx} (${error.message})` : t.errors.invalidGpx);
    }
  };

  const handleEditImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditImageError(null);

    const problem = imageFileProblem(file);
    if (problem) {
      setEditImageError(problem === "type" ? t.errors.imageInvalidType : t.errors.imageTooLarge);
      return;
    }

    setEditImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setEditImagePreview(objectUrl);
  };

  const handleUploadGpx = async () => {
    if (!editRace || !editGpxFile) return;
    setIsUploadingGpx(true);
    onError(null);
    try {
      const formData = new FormData();
      formData.append("gpx", editGpxFile);
      const response = await fetch(`/api/race-catalog/${editRace.id}/gpx`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? t.errors.gpxUploadFailed);
      onMessage(t.messages.updated);
      setEditGpxFile(null);
      setEditGpxPreview(null);
      void invalidateCatalog();
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", editRace.id, "aid-stations"] });
    } catch (err) {
      onError(err instanceof Error ? err.message : t.errors.gpxUploadFailed);
    } finally {
      setIsUploadingGpx(false);
    }
  };

  const handleSaveEditAidStations = async () => {
    if (!editRace) return;

    const aidStations = normalizeAidStationDrafts(editAidStations);
    if (hasInvalidAidStation(aidStations)) {
      setEditAidStationsError(t.errors.invalidAidStations);
      return;
    }

    setIsSavingAidStations(true);
    setEditAidStationsError(null);
    onError(null);

    try {
      const response = await fetch(`/api/race-catalog/${editRace.id}/aid-stations`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ aidStations: aidStationPayload(aidStations) }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; aidStations?: AidStationRow[] }
        | null;
      if (!response.ok) {
        throw new Error(data?.message ?? t.errors.aidStationsUpdateFailed);
      }

      onMessage(t.messages.updated);
      setEditAidStations(data?.aidStations ? aidStationRowsToDrafts(data.aidStations) : editAidStations);
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", editRace.id, "aid-stations"] });
    } catch (err) {
      setEditAidStationsError(err instanceof Error ? err.message : t.errors.aidStationsUpdateFailed);
    } finally {
      setIsSavingAidStations(false);
    }
  };

  const handleUploadImage = async () => {
    if (!editRace || !editImageFile) return;
    setIsUploadingImage(true);
    onError(null);
    try {
      const formData = new FormData();
      formData.append("image", editImageFile);
      const response = await fetch(`/api/race-catalog/${editRace.id}/thumbnail`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { message?: string; thumbnail_url?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? t.errors.imageUploadFailed);
      onMessage(t.messages.updated);
      setEditImageFile(null);
      if (editImagePreview) URL.revokeObjectURL(editImagePreview);
      setEditImagePreview(null);
      // Update the local race state so the current thumbnail refreshes
      if (data?.thumbnail_url && editRace) {
        setEditRace({ ...editRace, thumbnail_url: data.thumbnail_url });
      }
      void invalidateCatalog();
    } catch (err) {
      onError(err instanceof Error ? err.message : t.errors.imageUploadFailed);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleEditSubmit = editForm.handleSubmit((values) => {
    if (!editRace) return;
    updateMutation.mutate({ id: editRace.id, ...values });
  });

  const updateEditAidStation = (index: number, patch: Partial<AidStationDraft>) => {
    setEditAidStations((stations) =>
      stations.map((station, stationIndex) => (stationIndex === index ? { ...station, ...patch } : station))
    );
  };

  const removeEditAidStation = (index: number) => {
    setEditAidStations((stations) => stations.filter((_, stationIndex) => stationIndex !== index));
  };

  return (
    <Dialog open={race !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.editTitle}</DialogTitle>
          <DialogDescription>{editRace?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Metadata form */}
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.name}</Label>
                <Input className="h-9 text-sm" {...editForm.register("name")} />
                {editForm.formState.errors.name ? (
                  <p className="text-xs text-red-500">{editForm.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.location}</Label>
                <Input className="h-9 text-sm" {...editForm.register("location_text")} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">{t.fields.event}</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...editForm.register("event_id")}
                >
                  <option value="">{t.fields.noEvent}</option>
                  {eventRows.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                      {event.race_date ? ` - ${event.race_date}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.elevationGain}</Label>
                <Input className="h-9 text-sm" inputMode="numeric" {...editForm.register("elevation_gain_m")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.elevationLoss}</Label>
                <Input className="h-9 text-sm" inputMode="numeric" {...editForm.register("elevation_loss_m")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.traceId}</Label>
                <Input className="h-9 text-sm" {...editForm.register("trace_id")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.externalUrl}</Label>
                <Input className="h-9 text-sm" {...editForm.register("external_site_url")} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">{t.fields.thumbnailUrl}</Label>
                <Input className="h-9 text-sm" placeholder="https://…" {...editForm.register("thumbnail_url")} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                {...editForm.register("is_live")}
              />
              {t.fields.isLive}
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t.actions.cancel}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t.actions.saving : t.actions.save}
              </Button>
            </div>
          </form>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* GPX replacement */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t.gpxSection}
              {editRace?.gpx_storage_path ? (
                <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">✓</span>
              ) : null}
            </p>
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.replaceGpx}</Label>
              <Input
                type="file"
                accept=".gpx,application/gpx+xml"
                className="h-9 text-sm"
                onChange={handleEditGpxChange}
              />
            </div>
            {editRace && canEnrichFromTraceDeTrail(editRace) ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-4 text-xs"
                  disabled={traceDeTrailEnrichMutation.isPending || isUploadingGpx}
                  onClick={() => traceDeTrailEnrichMutation.mutate(editRace.id)}
                >
                  {traceDeTrailEnrichMutation.isPending ? t.actions.importing : t.actions.import}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-3 text-xs"
                  onClick={() => credentials.setDialogOpen(true)}
                >
                  {t.actions.connectTraceDeTrail}
                </Button>
                {credentials.hasCredentials ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">
                    {t.traceDeTrailCredentialsSaved}
                  </span>
                ) : null}
              </div>
            ) : null}
            {editGpxPreview ? (
              <p className="text-xs text-muted-foreground">
                {t.preview}
                <span className="ml-2">{editGpxPreview.distanceKm.toFixed(1)} km</span>
                <span className="ml-2">D+ {Math.round(editGpxPreview.gainM)} m</span>
                <span className="ml-2">D- {Math.round(editGpxPreview.lossM)} m</span>
                <span className="ml-2">
                  {t.gpxWaypoints.replace("{count}", String(editGpxPreview.waypointCount))}
                </span>
              </p>
            ) : null}
            {editGpxError ? <p className="text-xs text-red-500">{editGpxError}</p> : null}
            {editGpxFile ? (
              <Button
                type="button"
                className="h-8 px-4 text-xs"
                disabled={isUploadingGpx || Boolean(editGpxError)}
                onClick={() => void handleUploadGpx()}
              >
                {isUploadingGpx ? t.uploadingGpx : t.actions.save}
              </Button>
            ) : null}
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Aid stations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t.aidStationsEditTitle}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.aidStationsEditDescription}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-xs"
                onClick={() => setEditAidStations(appendAidStationDraft)}
              >
                {t.actions.addAidStation}
              </Button>
            </div>

            {editAidStationsQuery.isLoading ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.aidStationsLoading}</p>
            ) : null}
            {editAidStationsQuery.error ? (
              <p className="text-xs text-red-500">
                {editAidStationsQuery.error instanceof Error ? editAidStationsQuery.error.message : t.errors.loadFailed}
              </p>
            ) : null}
            {!editAidStationsQuery.isLoading && editAidStations.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {t.aidStationsEmpty}
              </p>
            ) : null}
            <div className="space-y-2">
              {editAidStations.map((station, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_auto_auto]">
                  <Input
                    className="h-9 text-sm"
                    placeholder={t.fields.aidStationName}
                    value={station.name}
                    onChange={(event) => updateEditAidStation(index, { name: event.target.value })}
                  />
                  <Input
                    className="h-9 text-sm"
                    inputMode="decimal"
                    placeholder={t.fields.aidStationDistance}
                    value={station.distanceKm}
                    onChange={(event) => updateEditAidStation(index, { distanceKm: event.target.value })}
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={station.waterRefill}
                      onChange={(event) => updateEditAidStation(index, { waterRefill: event.target.checked })}
                    />
                    {t.fields.aidStationWater}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-red-600 hover:text-red-600"
                    onClick={() => removeEditAidStation(index)}
                  >
                    {t.actions.remove}
                  </Button>
                </div>
              ))}
            </div>
            {editAidStationsError ? <p className="text-xs text-red-500">{editAidStationsError}</p> : null}
            <div className="flex justify-end">
              <Button
                type="button"
                className="h-8 px-4 text-xs"
                disabled={isSavingAidStations || editAidStationsQuery.isLoading}
                onClick={() => void handleSaveEditAidStations()}
              >
                {isSavingAidStations ? t.actions.saving : t.actions.save}
              </Button>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Image replacement */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.imageSection}</p>
            {editRace?.thumbnail_url && !editImagePreview ? (
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.currentThumbnail}</p>
                <Image
                  src={editRace.thumbnail_url}
                  alt={editRace.name}
                  width={120}
                  height={80}
                  className="h-20 w-auto rounded border border-slate-200 object-cover dark:border-slate-700"
                  unoptimized
                />
              </div>
            ) : null}
            {editImagePreview ? (
              <div className="space-y-1">
                <Image
                  src={editImagePreview}
                  alt="preview"
                  width={120}
                  height={80}
                  className="h-20 w-auto rounded border border-slate-200 object-cover dark:border-slate-700"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.replaceImage}</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="h-9 text-sm"
                onChange={handleEditImageChange}
              />
              <p className="text-xs text-slate-400">JPEG, PNG, WebP, AVIF — max 5 MB</p>
            </div>
            {editImageError ? <p className="text-xs text-red-500">{editImageError}</p> : null}
            {editImageFile && !editImageError ? (
              <Button
                type="button"
                className="h-8 px-4 text-xs"
                disabled={isUploadingImage}
                onClick={() => void handleUploadImage()}
              >
                {isUploadingImage ? t.uploadingImage : t.actions.save}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
