import type { ChangeEvent, FormEvent } from "react";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { OrganizerModuleId } from "../completion";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import { ADD_FORMAT_TAB_ID } from "./constants";
import { formatKm } from "./helpers";
import type { EventFormValues, GpxPreview, RaceFormat, RaceFormValues } from "./types";
import { NumberField, TextField } from "./controls";

export function EventInfoEditor({
  eventForm,
  onChange,
  onUploadImage,
  status,
}: {
  eventForm: EventFormValues;
  onChange: (next: Partial<EventFormValues>, moduleId?: OrganizerModuleId) => void;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  const dateRange = eventForm.organizerDetails.dateRange;
  const missingName = !eventForm.name.trim();
  const missingLocation = !eventForm.location.trim();
  const missingStartDate = !eventForm.raceDate.trim();
  const missingEndDate = !dateRange.endDate?.trim();

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_170px_170px]">
      <TextField label="Nom" value={eventForm.name} onChange={(value) => onChange({ name: value })} required invalid={missingName} />
      <AddressAutocompleteField
        label="Lieu"
        value={eventForm.location}
        location={eventForm.organizerDetails.eventLocation}
        biasLocation={eventForm.organizerDetails.eventLocation}
        onChange={(value) => onChange({ location: value })}
        onLocationChange={(eventLocation) =>
          onChange(
            {
              organizerDetails: {
                ...eventForm.organizerDetails,
                eventLocation,
              },
            },
            "event"
          )
        }
        invalid={missingLocation}
      />
      <TextField label="Date début" type="date" value={eventForm.raceDate} onChange={(value) => onChange({ raceDate: value })} invalid={missingStartDate} />
      <TextField
        label="Date fin"
        type="date"
        value={dateRange.endDate ?? ""}
        onChange={(value) =>
          onChange(
            {
              organizerDetails: {
                ...eventForm.organizerDetails,
                dateRange: { ...dateRange, endDate: value || null },
              },
            },
            "event"
          )
        }
        invalid={missingEndDate}
      />
      <div className="space-y-2 lg:col-span-4">
        <Label>Image événement (PNG)</Label>
        {eventForm.thumbnailUrl ? (
          <div className="h-28 w-full overflow-hidden rounded-md border border-border bg-muted sm:w-56">
            <img src={eventForm.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-20 w-full items-center rounded-md border border-dashed border-border bg-muted px-3 text-sm text-muted-foreground sm:w-56">
            Aucune image
          </div>
        )}
        <Input type="file" accept="image/png" onChange={onUploadImage} disabled={status === "uploading"} className="max-w-sm" />
        <p className="text-xs text-muted-foreground">PNG uniquement, 5 Mo maximum.</p>
      </div>
    </div>
  );
}

export function FormatsEditor({
  activeTab,
  activeRace,
  raceForm,
  newRaceForm,
  newRaceImageName,
  newRaceGpxName,
  showRaceDetails,
  onToggleRaceDetails,
  onRaceFormChange,
  onNewRaceFormChange,
  onCreateRace,
  onUploadRaceImage,
  onSelectNewRaceImage,
  onSelectNewRaceGpx,
  onUploadGpx,
  onDuplicateRace,
  onDeleteRace,
  onPreviewRace,
  gpxPreview,
  status,
}: {
  activeTab: string;
  activeRace: RaceFormat | null;
  raceForm: RaceFormValues;
  newRaceForm: RaceFormValues;
  newRaceImageName: string | null;
  newRaceGpxName: string | null;
  showRaceDetails: boolean;
  onToggleRaceDetails: () => void;
  onRaceFormChange: (next: Partial<RaceFormValues>) => void;
  onNewRaceFormChange: (next: RaceFormValues) => void;
  onCreateRace: (event: FormEvent<HTMLFormElement>) => void;
  onUploadRaceImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectNewRaceImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectNewRaceGpx: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadGpx: (event: ChangeEvent<HTMLInputElement>) => void;
  onDuplicateRace: () => void;
  onDeleteRace: () => void;
  onPreviewRace: () => void;
  gpxPreview: GpxPreview | null;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  return (
    <div className="space-y-5">
      {activeTab === ADD_FORMAT_TAB_ID ? (
        <RaceForm
          title="Ajouter un format"
          values={newRaceForm}
          biasLocation={null}
          pendingImageName={newRaceImageName}
          pendingGpxName={newRaceGpxName}
          onChange={(values) => onNewRaceFormChange(values)}
          onSubmit={onCreateRace}
          onImageChange={onSelectNewRaceImage}
          onGpxChange={onSelectNewRaceGpx}
          submitLabel="Ajouter"
          disabled={status === "saving" || status === "uploading"}
          requireRaceDate
        />
      ) : activeRace ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onDuplicateRace} disabled={status === "saving"}>
              Dupliquer ce format
            </Button>
            <Button type="button" variant="outline" onClick={onPreviewRace}>
              Prévisualiser ce format
            </Button>
            <Button type="button" variant="ghost" onClick={onToggleRaceDetails}>
              {showRaceDetails ? "Masquer les détails" : "Afficher les détails"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDeleteRace}
              disabled={status === "saving" || status === "uploading"}
              className="border-red-300 text-red-700 hover:border-red-400 hover:bg-red-50 hover:text-red-800"
            >
              Supprimer ce format
            </Button>
          </div>
          {showRaceDetails ? (
            <RaceForm
              title="Détails du format"
              values={raceForm}
              biasLocation={raceForm.organizerDetails.raceLocation}
              onChange={(values) => onRaceFormChange(values)}
              onSubmit={(event) => event.preventDefault()}
              onImageChange={onUploadRaceImage}
              submitLabel=""
              disabled={status === "saving" || status === "uploading"}
              hideSubmit
            />
          ) : null}
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">GPX</p>
                <p className="text-sm text-muted-foreground">{activeRace.gpx_storage_path ? "GPX source présent." : "Aucun GPX source pour ce format."}</p>
              </div>
              <Input type="file" accept=".gpx,application/gpx+xml" onChange={onUploadGpx} disabled={status === "uploading"} className="max-w-sm" />
            </div>
            <MiniElevationProfile preview={gpxPreview} activeRace={activeRace} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sélectionne ou ajoute un format.</p>
      )}
    </div>
  );
}

function RaceForm({
  title,
  values,
  biasLocation,
  onChange,
  onSubmit,
  onImageChange,
  onGpxChange,
  submitLabel,
  disabled,
  pendingImageName,
  pendingGpxName,
  hideSubmit = false,
  requireRaceDate = false,
}: {
  title: string;
  values: RaceFormValues;
  biasLocation: RaceFormValues["organizerDetails"]["raceLocation"] | null;
  onChange: (values: RaceFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGpxChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  submitLabel: string;
  disabled?: boolean;
  pendingImageName?: string | null;
  pendingGpxName?: string | null;
  hideSubmit?: boolean;
  requireRaceDate?: boolean;
}) {
  const missingName = !values.name.trim();
  const missingDistance = !Number.isFinite(values.distanceKm) || values.distanceKm <= 0;
  const missingElevationGain = !Number.isFinite(values.elevationGainM) || values.elevationGainM < 0;
  const missingRaceDate = requireRaceDate && !values.raceDate.trim();

  return (
    <form className="rounded-lg border border-border bg-background p-4" onSubmit={onSubmit}>
      <div className="mb-3">
        <p className="font-semibold text-foreground">{title}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <TextField label="Nom" value={values.name} onChange={(value) => onChange({ ...values, name: value })} required invalid={missingName} />
        </div>
        <NumberField label="Distance km" value={values.distanceKm} onChange={(value) => onChange({ ...values, distanceKm: value })} step="0.1" invalid={missingDistance} />
        <NumberField label="D+" value={values.elevationGainM} onChange={(value) => onChange({ ...values, elevationGainM: value })} step="1" invalid={missingElevationGain} />
        <TextField label="D-" type="number" value={values.elevationLossM} onChange={(value) => onChange({ ...values, elevationLossM: value })} />
        <TextField
          label={requireRaceDate ? "Date de course" : "Date du format"}
          type="date"
          value={values.raceDate}
          onChange={(value) => onChange({ ...values, raceDate: value })}
          required={requireRaceDate}
          invalid={missingRaceDate}
        />
        <div className="lg:col-span-2">
          <AddressAutocompleteField
            label="Lieu du format"
            value={values.locationText}
            location={values.organizerDetails.raceLocation}
            biasLocation={biasLocation ?? undefined}
            onChange={(value) => onChange({ ...values, locationText: value })}
            onLocationChange={(raceLocation) =>
              onChange({
                ...values,
                organizerDetails: {
                  ...values.organizerDetails,
                  raceLocation,
                },
              })
            }
          />
        </div>
        <div className="space-y-2 lg:col-span-3">
          <Label>Image format</Label>
          {values.thumbnailUrl ? (
            <div className="h-28 w-full overflow-hidden rounded-md border border-border bg-muted sm:w-56">
              <img src={values.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-20 w-full items-center rounded-md border border-dashed border-border bg-muted px-3 text-sm text-muted-foreground sm:w-56">
              {pendingImageName ? pendingImageName : "Aucune image"}
            </div>
          )}
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={onImageChange}
            disabled={disabled}
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP ou AVIF, 5 Mo maximum.
            {pendingImageName && !values.thumbnailUrl ? " L'image sera envoyée après la création du format." : ""}
          </p>
        </div>
        {onGpxChange ? (
          <div className="space-y-2 lg:col-span-3">
            <Label>GPX format</Label>
            <div className="flex h-20 w-full items-center rounded-md border border-dashed border-border bg-muted px-3 text-sm text-muted-foreground">
              {pendingGpxName ? pendingGpxName : "Aucun GPX"}
            </div>
            <Input type="file" accept=".gpx,application/gpx+xml" onChange={onGpxChange} disabled={disabled} className="max-w-sm" />
            <p className="text-xs text-muted-foreground">
              GPX uniquement.
              {pendingGpxName ? " Le GPX sera importe juste apres la creation du format." : ""}
            </p>
          </div>
        ) : null}
        {!hideSubmit ? (
          <div className="flex items-end">
            <Button type="submit" disabled={disabled}>
              {submitLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  );
}

function MiniElevationProfile({ preview, activeRace }: { preview: GpxPreview | null; activeRace: RaceFormat }) {
  const profile = preview?.elevationProfile ?? [];
  const hasProfile = profile.length >= 2;
  const distanceKm = preview?.stats?.distanceKm ?? activeRace.distance_km;
  const gainM = preview?.stats?.gainM ?? activeRace.elevation_gain_m;
  const lossM = preview?.stats?.lossM ?? activeRace.elevation_loss_m ?? 0;

  if (!activeRace.gpx_storage_path) {
    return <div className="mt-4 rounded-md border border-dashed border-border bg-card p-3 text-sm text-muted-foreground">La courbe apparaîtra après l&apos;ajout d&apos;un GPX.</div>;
  }

  if (!hasProfile) {
    return <div className="mt-4 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">GPX présent. Courbe de niveau indisponible pour ce fichier.</div>;
  }

  const width = 720;
  const height = 180;
  const paddingX = 28;
  const paddingTop = 18;
  const paddingBottom = 34;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxDistance = Math.max(distanceKm, profile.at(-1)?.distanceKm ?? 0, 1);
  const elevations = profile.map((point) => point.elevationM);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const xScale = (distance: number) => paddingX + (Math.min(Math.max(distance, 0), maxDistance) / maxDistance) * (width - paddingX * 2);
  const yScale = (elevation: number) => paddingTop + chartHeight - ((elevation - minElevation) / elevationRange) * chartHeight;
  const path = profile
    .map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.distanceKm).toFixed(1)},${yScale(point.elevationM).toFixed(1)}`)
    .join(" ");
  const firstProfilePoint = profile[0];
  const lastProfilePoint = profile.at(-1);
  const areaPath = `${path} L${xScale(lastProfilePoint?.distanceKm ?? 0).toFixed(1)},${height - paddingBottom} L${xScale(firstProfilePoint?.distanceKm ?? 0).toFixed(1)},${height - paddingBottom} Z`;

  return (
    <div className="mt-4 rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold text-foreground">Courbe de niveau</p>
        <p className="text-xs font-medium text-muted-foreground">
          {formatKm(distanceKm)} - D+ {Math.round(gainM)} m - D- {Math.round(lossM)} m
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Courbe de niveau GPX">
        <defs>
          <linearGradient id="organizerElevationGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2f5d1e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2f5d1e" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <line x1={paddingX} x2={width - paddingX} y1={height - paddingBottom} y2={height - paddingBottom} stroke="#d6d3cc" />
        <path d={areaPath} fill="url(#organizerElevationGradient)" />
        <path d={path} fill="none" stroke="#2f5d1e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x={paddingX} y={height - 10} fontSize="11" fill="#6b655c">
          0 km
        </text>
        <text x={width - paddingX} y={height - 10} fontSize="11" fill="#6b655c" textAnchor="end">
          {maxDistance.toFixed(1)} km
        </text>
        <text x={paddingX} y={paddingTop + 4} fontSize="11" fill="#6b655c">
          {Math.round(maxElevation)} m
        </text>
        <text x={paddingX} y={height - paddingBottom - 6} fontSize="11" fill="#6b655c">
          {Math.round(minElevation)} m
        </text>
        {preview?.detectedAidStations.map((station) => {
          const x = xScale(station.distanceKm);
          return (
            <g key={`${station.name}-${station.distanceKm}`}>
              <line x1={x} x2={x} y1={paddingTop} y2={height - paddingBottom} stroke="#d89b22" strokeDasharray="3 4" />
              <circle cx={x} cy={height - paddingBottom} r="4" fill="#d89b22" />
            </g>
          );
        })}
      </svg>
      {preview?.detectedAidStations.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {preview.detectedAidStations.length} waypoint{preview.detectedAidStations.length > 1 ? "s" : ""} ravito détecté{preview.detectedAidStations.length > 1 ? "s" : ""}.
        </p>
      ) : null}
    </div>
  );
}
