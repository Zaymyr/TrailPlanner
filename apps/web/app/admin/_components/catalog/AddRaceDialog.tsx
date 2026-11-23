"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { parseGpx } from "../../../../lib/gpx/parseGpx";
import type { AdminTranslations } from "../../../../locales/types";
import {
  ADD_FORM_DEFAULTS,
  addFormSchema,
  aidStationPayload,
  appendAidStationDraft,
  hasInvalidAidStation,
  imageFileProblem,
  normalizeAidStationDrafts,
  type AddFormValues,
  type AidStationDraft,
  type EventMode,
  type ParsedPreview,
  type RaceEventRow,
} from "./race-catalog-model";

/**
 * « Ajouter une course » (manual creation): GPX (parsed in the browser for a preview and to pre-fill
 * name and D+/D-), optional image, event (none, existing, new), aid stations, then
 * `POST /api/race-catalog` (multipart). The form keeps its values when « Annuler » is pressed and is
 * reset when the dialog is dismissed, as before lot 5. Errors of the submission are the section's.
 */
export function AddRaceDialog({ accessToken, t, open, eventRows, onOpenChange, onError, onCreated }: {
  accessToken?: string;
  t: AdminTranslations["raceCatalog"];
  open: boolean;
  eventRows: RaceEventRow[];
  onOpenChange: (open: boolean) => void;
  onError: (message: string | null) => void;
  onCreated: () => void;
}) {
  const [addGpxFile, setAddGpxFile] = useState<File | null>(null);
  const [addGpxPreview, setAddGpxPreview] = useState<ParsedPreview | null>(null);
  const [addGpxError, setAddGpxError] = useState<string | null>(null);
  const [addEventMode, setAddEventMode] = useState<EventMode>("none");
  const [addAidStations, setAddAidStations] = useState<AidStationDraft[]>([]);
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [addImagePreview, setAddImagePreview] = useState<string | null>(null);
  const [addImageError, setAddImageError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const addForm = useForm<AddFormValues>({
    resolver: zodResolver(addFormSchema),
    defaultValues: ADD_FORM_DEFAULTS,
  });

  const resetAddDialog = () => {
    addForm.reset();
    setAddEventMode("none");
    setAddAidStations([]);
    setAddGpxFile(null);
    setAddGpxPreview(null);
    setAddGpxError(null);
    setAddImageFile(null);
    if (addImagePreview) URL.revokeObjectURL(addImagePreview);
    setAddImagePreview(null);
    setAddImageError(null);
  };

  const handleAddGpxChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAddGpxFile(file);
    setAddGpxError(null);
    try {
      const content = await file.text();
      const parsed = parseGpx(content);
      setAddGpxPreview({
        distanceKm: parsed.stats.distanceKm,
        gainM: parsed.stats.gainM,
        lossM: parsed.stats.lossM,
        waypointCount: parsed.waypoints.length,
      });
      if (!addForm.getValues("name") && parsed.name) {
        addForm.setValue("name", parsed.name, { shouldDirty: true });
      }
      if (!addForm.getValues("elevation_gain_m")) {
        addForm.setValue("elevation_gain_m", Math.round(parsed.stats.gainM).toString(), { shouldDirty: true });
      }
      if (!addForm.getValues("elevation_loss_m")) {
        addForm.setValue("elevation_loss_m", Math.round(parsed.stats.lossM).toString(), { shouldDirty: true });
      }
    } catch (error) {
      setAddGpxPreview(null);
      setAddGpxError(error instanceof Error ? `${t.errors.invalidGpx} (${error.message})` : t.errors.invalidGpx);
    }
  };

  const handleAddImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAddImageError(null);

    const problem = imageFileProblem(file);
    if (problem) {
      setAddImageError(problem === "type" ? t.errors.imageInvalidType : t.errors.imageTooLarge);
      return;
    }

    setAddImageFile(file);
    if (addImagePreview) URL.revokeObjectURL(addImagePreview);
    setAddImagePreview(URL.createObjectURL(file));
  };

  const updateAddAidStation = (index: number, patch: Partial<AidStationDraft>) => {
    setAddAidStations((stations) =>
      stations.map((station, stationIndex) => (stationIndex === index ? { ...station, ...patch } : station))
    );
  };

  const removeAddAidStation = (index: number) => {
    setAddAidStations((stations) => stations.filter((_, stationIndex) => stationIndex !== index));
  };

  const handleAddSubmit = addForm.handleSubmit(async (values) => {
    if (!addGpxFile) {
      setAddGpxError(t.errors.missingGpx);
      return;
    }
    if (addImageError) {
      return;
    }
    if (addEventMode === "existing" && !values.event_id) {
      onError(t.errors.missingEvent);
      return;
    }
    if (addEventMode === "new" && !values.event_name?.trim()) {
      onError(t.errors.missingEvent);
      return;
    }
    const aidStations = normalizeAidStationDrafts(addAidStations);

    if (hasInvalidAidStation(aidStations)) {
      setAddGpxError(t.errors.invalidAidStations);
      return;
    }

    setIsSubmittingAdd(true);
    onError(null);
    try {
      const formData = new FormData();
      formData.append("gpx", addGpxFile);
      if (addImageFile) formData.append("image", addImageFile);
      if (values.name) formData.append("name", values.name);
      if (addEventMode === "existing" && values.event_id) formData.append("event_id", values.event_id);
      if (addEventMode === "new" && values.event_name) formData.append("event_name", values.event_name);
      if (addEventMode === "new" && values.event_location) formData.append("event_location", values.event_location);
      if (addEventMode === "new" && values.event_race_date) formData.append("event_race_date", values.event_race_date);
      if (addEventMode === "new" && values.event_thumbnail_url) {
        formData.append("event_thumbnail_url", values.event_thumbnail_url);
      }
      if (values.race_date) formData.append("race_date", values.race_date);
      if (values.location_text) formData.append("location_text", values.location_text);
      if (values.elevation_gain_m) formData.append("elevation_gain_m", values.elevation_gain_m);
      if (values.elevation_loss_m) formData.append("elevation_loss_m", values.elevation_loss_m);
      if (values.trace_id) formData.append("trace_id", values.trace_id);
      if (values.external_site_url) formData.append("external_site_url", values.external_site_url);
      if (values.thumbnail_url) formData.append("thumbnail_url", values.thumbnail_url);
      if (aidStations.length > 0) {
        formData.append("aid_stations", JSON.stringify(aidStationPayload(aidStations)));
      }
      formData.append("is_live", String(values.is_live));

      const response = await fetch("/api/race-catalog", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? t.errors.createFailed);
      onOpenChange(false);
      resetAddDialog();
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : t.errors.createFailed);
    } finally {
      setIsSubmittingAdd(false);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          resetAddDialog();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.addTitle}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.name}</Label>
              <Input className="h-9 text-sm" {...addForm.register("name")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.location}</Label>
              <Input className="h-9 text-sm" {...addForm.register("location_text")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.raceDate}</Label>
              <Input type="date" className="h-9 text-sm" {...addForm.register("race_date")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.elevationGain}</Label>
              <Input className="h-9 text-sm" inputMode="numeric" {...addForm.register("elevation_gain_m")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.elevationLoss}</Label>
              <Input className="h-9 text-sm" inputMode="numeric" {...addForm.register("elevation_loss_m")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.traceId}</Label>
              <Input className="h-9 text-sm" {...addForm.register("trace_id")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.externalUrl}</Label>
              <Input className="h-9 text-sm" {...addForm.register("external_site_url")} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{t.fields.thumbnailUrl}</Label>
              <Input className="h-9 text-sm" placeholder="https://…" {...addForm.register("thumbnail_url")} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{t.fields.thumbnailFile}</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="h-9 text-sm"
                onChange={handleAddImageChange}
              />
              {addImagePreview ? (
                <Image
                  src={addImagePreview}
                  alt="preview"
                  width={120}
                  height={80}
                  className="h-20 w-auto rounded border border-slate-200 object-cover dark:border-slate-700"
                  unoptimized
                />
              ) : null}
              {addImageError ? <p className="text-xs text-red-500">{addImageError}</p> : null}
            </div>
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:col-span-2">
              <Label className="text-xs">{t.fields.eventMode}</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["none", "existing", "new"] as EventMode[]).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="radio"
                      name="add-event-mode"
                      checked={addEventMode === mode}
                      onChange={() => setAddEventMode(mode)}
                    />
                    {mode === "none" ? t.fields.noEvent : mode === "existing" ? t.fields.existingEvent : t.fields.newEvent}
                  </label>
                ))}
              </div>
              {addEventMode === "existing" ? (
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...addForm.register("event_id")}
                >
                  <option value="">{t.fields.event}</option>
                  {eventRows.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                      {event.race_date ? ` - ${event.race_date}` : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              {addEventMode === "new" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t.fields.eventName}</Label>
                    <Input className="h-9 text-sm" {...addForm.register("event_name")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.fields.eventLocation}</Label>
                    <Input className="h-9 text-sm" {...addForm.register("event_location")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.fields.eventDate}</Label>
                    <Input type="date" className="h-9 text-sm" {...addForm.register("event_race_date")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.fields.eventThumbnailUrl}</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="https://..."
                      {...addForm.register("event_thumbnail_url")}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">{t.fields.gpxFile}</Label>
              <Input
                type="file"
                accept=".gpx,application/gpx+xml"
                className="h-9 text-sm"
                onChange={handleAddGpxChange}
              />
              {addGpxPreview ? (
                <p className="text-xs text-muted-foreground">
                  {t.preview}
                  <span className="ml-2">{addGpxPreview.distanceKm.toFixed(1)} km</span>
                  <span className="ml-2">D+ {Math.round(addGpxPreview.gainM)} m</span>
                  <span className="ml-2">D- {Math.round(addGpxPreview.lossM)} m</span>
                  <span className="ml-2">
                    {t.gpxWaypoints.replace("{count}", String(addGpxPreview.waypointCount))}
                  </span>
                </p>
              ) : null}
              {addGpxPreview?.waypointCount === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-300">{t.noGpxWaypoints}</p>
              ) : null}
              {addGpxError ? <p className="text-xs text-red-500">{addGpxError}</p> : null}
            </div>
            <div className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-800 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t.aidStationsTitle}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.aidStationsDescription}</p>
                </div>
                <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setAddAidStations(appendAidStationDraft)}>
                  {t.actions.addAidStation}
                </Button>
              </div>
              {addAidStations.map((station, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_auto_auto]">
                  <Input
                    className="h-9 text-sm"
                    placeholder={t.fields.aidStationName}
                    value={station.name}
                    onChange={(event) => updateAddAidStation(index, { name: event.target.value })}
                  />
                  <Input
                    className="h-9 text-sm"
                    inputMode="decimal"
                    placeholder={t.fields.aidStationDistance}
                    value={station.distanceKm}
                    onChange={(event) => updateAddAidStation(index, { distanceKm: event.target.value })}
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={station.waterRefill}
                      onChange={(event) => updateAddAidStation(index, { waterRefill: event.target.checked })}
                    />
                    {t.fields.aidStationWater}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-red-600 hover:text-red-600"
                    onClick={() => removeAddAidStation(index)}
                  >
                    {t.actions.remove}
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-500 dark:border-slate-700 dark:bg-slate-950"
              {...addForm.register("is_live")}
            />
            {t.fields.isLive}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.actions.cancel}
            </Button>
            <Button type="submit" disabled={isSubmittingAdd}>
              {isSubmittingAdd ? t.creating : t.actions.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
