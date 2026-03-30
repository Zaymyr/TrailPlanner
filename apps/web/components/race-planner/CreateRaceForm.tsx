"use client";

import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export type CreateRaceFormValues = {
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m?: number | null;
  location_text?: string | null;
  race_date?: string | null;
  aid_stations: Array<{ name: string; distanceKm: number; waterRefill: boolean }>;
  gpx_content?: string | null;
};

type ParsedGpxPreview = {
  distanceKm: number;
  gainM: number;
  lossM: number;
  aidStationCount: number;
};

type Props = {
  onSubmit: (values: CreateRaceFormValues) => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
};

export function CreateRaceForm({ onSubmit, isSubmitting, error }: Props) {
  const [mode, setMode] = useState<"manual" | "gpx">("manual");
  const [name, setName] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [elevationGain, setElevationGain] = useState("");
  const [elevationLoss, setElevationLoss] = useState("");
  const [locationText, setLocationText] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [aidStations, setAidStations] = useState<Array<{ name: string; distanceKm: string; waterRefill: boolean }>>([]);
  const [gpxContent, setGpxContent] = useState<string | null>(null);
  const [gpxFileName, setGpxFileName] = useState<string | null>(null);
  const [gpxPreview, setGpxPreview] = useState<ParsedGpxPreview | null>(null);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGpxChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setGpxError(null);
    setGpxFileName(file.name);
    const text = await file.text();
    setGpxContent(text);

    // Basic client-side parse preview using regex to estimate stats
    try {
      const eleValues = Array.from(text.matchAll(/<ele>([\d.]+)<\/ele>/g)).map((m) => parseFloat(m[1]));
      const trkpts = text.matchAll(/<trkpt\s+lat="([\d.-]+)"\s+lon="([\d.-]+)"/g);
      const coords: Array<[number, number]> = [];
      for (const m of trkpts) {
        coords.push([parseFloat(m[1]), parseFloat(m[2])]);
      }

      // Approximate distance
      let totalKm = 0;
      for (let i = 1; i < coords.length; i++) {
        const [lat1, lng1] = coords[i - 1];
        const [lat2, lng2] = coords[i];
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        totalKm += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      let gainM = 0;
      let lossM = 0;
      for (let i = 1; i < eleValues.length; i++) {
        const diff = eleValues[i] - eleValues[i - 1];
        if (diff > 0) gainM += diff;
        else lossM += Math.abs(diff);
      }

      const wptCount = (text.match(/<wpt\b/g) ?? []).length;

      setGpxPreview({
        distanceKm: Math.round(totalKm * 10) / 10,
        gainM: Math.round(gainM),
        lossM: Math.round(lossM),
        aidStationCount: wptCount,
      });

      if (totalKm > 0) setDistanceKm(String(Math.round(totalKm * 10) / 10));
      if (gainM > 0) setElevationGain(String(Math.round(gainM)));
      if (lossM > 0) setElevationLoss(String(Math.round(lossM)));
    } catch (error) {
      const details = error instanceof Error ? ` (${error.message})` : "";
      setGpxError(`Unable to preview GPX${details}. The file will still be sent to the server for parsing.`);
    }
  };

  const handleAddAidStation = () => {
    setAidStations((prev) => [...prev, { name: "", distanceKm: "", waterRefill: true }]);
  };

  const handleRemoveAidStation = (index: number) => {
    setAidStations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAidStationChange = (
    index: number,
    field: "name" | "distanceKm" | "waterRefill",
    value: string | boolean
  ) => {
    setAidStations((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsedDist = parseFloat(distanceKm);
    const parsedGain = parseFloat(elevationGain);

    if (!name.trim() || isNaN(parsedDist) || isNaN(parsedGain)) return;

    const validAidStations = aidStations
      .filter((s) => s.name.trim() && !isNaN(parseFloat(s.distanceKm)))
      .map((s) => ({
        name: s.name.trim(),
        distanceKm: parseFloat(s.distanceKm),
        waterRefill: s.waterRefill,
      }));

    await onSubmit({
      name: name.trim(),
      distance_km: parsedDist,
      elevation_gain_m: parsedGain,
      elevation_loss_m: elevationLoss ? parseFloat(elevationLoss) : null,
      location_text: locationText.trim() || null,
      race_date: raceDate || null,
      aid_stations: validAidStations,
      gpx_content: gpxContent,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-2 rounded-lg border border-border bg-background p-1">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === "manual"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Manuel
        </button>
        <button
          type="button"
          onClick={() => setMode("gpx")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === "gpx"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Importer GPX
        </button>
      </div>

      {/* GPX upload */}
      {mode === "gpx" && (
        <div className="space-y-2">
          <Label>Fichier GPX</Label>
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition hover:border-[hsl(var(--brand))]"
            onClick={() => fileInputRef.current?.click()}
          >
            {gpxFileName ? (
              <p className="text-sm font-medium text-foreground">{gpxFileName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Cliquer pour sélectionner un fichier .gpx</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml"
              className="hidden"
              onChange={handleGpxChange}
            />
          </div>
          {gpxError && <p className="text-xs text-amber-400">{gpxError}</p>}
          {gpxPreview && (
            <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground dark:text-slate-400">
              <span className="font-medium text-foreground">Aperçu GPX :</span>{" "}
              {gpxPreview.distanceKm} km · D+ {gpxPreview.gainM}m · D- {gpxPreview.lossM}m
              {gpxPreview.aidStationCount > 0 && ` · ${gpxPreview.aidStationCount} waypoints`}
            </div>
          )}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="race-name">Nom de la course *</Label>
        <Input
          id="race-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : UTMB, Trail du Vercors…"
          required
        />
      </div>

      {/* Distance + Gain */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="race-dist">Distance (km) *</Label>
          <Input
            id="race-dist"
            type="number"
            min="0"
            step="0.1"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            placeholder="50"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="race-gain">D+ (m) *</Label>
          <Input
            id="race-gain"
            type="number"
            min="0"
            step="1"
            value={elevationGain}
            onChange={(e) => setElevationGain(e.target.value)}
            placeholder="2200"
            required
          />
        </div>
      </div>

      {/* D- + Location */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="race-loss">D- (m)</Label>
          <Input
            id="race-loss"
            type="number"
            min="0"
            step="1"
            value={elevationLoss}
            onChange={(e) => setElevationLoss(e.target.value)}
            placeholder="2100"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="race-date">Date</Label>
          <Input
            id="race-date"
            type="date"
            value={raceDate}
            onChange={(e) => setRaceDate(e.target.value)}
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label htmlFor="race-location">Lieu</Label>
        <Input
          id="race-location"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder="Chamonix, France"
        />
      </div>

      {/* Aid stations */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Ravitaillements</Label>
          <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={handleAddAidStation}>
            + Ajouter
          </Button>
        </div>
        {aidStations.length === 0 && (
          <p className="text-xs text-muted-foreground dark:text-slate-500">Aucun ravitaillement ajouté</p>
        )}
        {aidStations.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={s.name}
              onChange={(e) => handleAidStationChange(i, "name", e.target.value)}
              placeholder="Nom"
              className="flex-1 text-xs"
            />
            <Input
              type="number"
              min="0"
              step="0.1"
              value={s.distanceKm}
              onChange={(e) => handleAidStationChange(i, "distanceKm", e.target.value)}
              placeholder="km"
              className="w-20 text-xs"
            />
            <button
              type="button"
              onClick={() => handleRemoveAidStation(i)}
              className="shrink-0 text-xs text-muted-foreground hover:text-red-400"
              aria-label="Supprimer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <Button type="submit" className="w-full" disabled={isSubmitting || !name.trim() || !distanceKm || !elevationGain}>
        {isSubmitting ? "Création…" : "Créer la course"}
      </Button>
    </form>
  );
}
