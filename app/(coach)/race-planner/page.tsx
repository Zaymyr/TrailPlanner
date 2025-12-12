"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import React, { useRef, useState } from "react";

const aidStationSchema = z.object({
  name: z.string().min(1, "Required"),
  distanceKm: z.coerce.number().nonnegative({ message: "Distance must be positive" }),
});

const formSchema = z
  .object({
    raceDistanceKm: z.coerce.number().positive("Enter a distance in km"),
    paceType: z.enum(["pace", "speed"]),
    paceMinutes: z.coerce.number().nonnegative(),
    paceSeconds: z.coerce.number().min(0).max(59),
    speedKph: z.coerce.number().positive(),
    targetIntakePerHour: z.coerce.number().positive("Enter grams per hour"),
    aidStations: z.array(aidStationSchema).min(1, "Add at least one aid station"),
  })
  .superRefine((values, ctx) => {
    if (values.paceType === "pace" && values.paceMinutes === 0 && values.paceSeconds === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pace cannot be 0",
        path: ["paceMinutes"],
      });
    }
    if (values.paceType === "speed" && values.speedKph <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Speed must be positive",
        path: ["speedKph"],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

type Segment = {
  checkpoint: string;
  distanceKm: number;
  segmentKm: number;
  etaMinutes: number;
  segmentMinutes: number;
  fuelGrams: number;
};

type ParsedGpx = {
  distanceKm: number;
  aidStations: { name: string; distanceKm: number }[];
};

const DEFAULT_VALUES: FormValues = {
  raceDistanceKm: 50,
  paceType: "pace",
  paceMinutes: 6,
  paceSeconds: 30,
  speedKph: 9.2,
  targetIntakePerHour: 70,
  aidStations: [
    { name: "Aid 1", distanceKm: 10 },
    { name: "Aid 2", distanceKm: 20 },
    { name: "Aid 3", distanceKm: 30 },
    { name: "Aid 4", distanceKm: 40 },
    { name: "Final Bottles", distanceKm: 45 },
  ],
};

function minutesPerKm(values: FormValues) {
  if (values.paceType === "speed") {
    return 60 / values.speedKph;
  }
  return values.paceMinutes + values.paceSeconds / 60;
}

function buildSegments(values: FormValues): Segment[] {
  const minPerKm = minutesPerKm(values);
  const stations = [...values.aidStations].sort((a, b) => a.distanceKm - b.distanceKm);
  const checkpoints = [...stations.filter((s) => s.distanceKm < values.raceDistanceKm)];
  checkpoints.push({ name: "Finish", distanceKm: values.raceDistanceKm });

  let elapsedMinutes = 0;
  let previousDistance = 0;

  return checkpoints.map((station) => {
    const segmentKm = Math.max(0, station.distanceKm - previousDistance);
    const segmentMinutes = segmentKm * minPerKm;
    elapsedMinutes += segmentMinutes;
    const fuelGrams = (segmentMinutes / 60) * values.targetIntakePerHour;
    const segment: Segment = {
      checkpoint: station.name,
      distanceKm: station.distanceKm,
      segmentKm,
      etaMinutes: elapsedMinutes,
      segmentMinutes,
      fuelGrams,
    };
    previousDistance = station.distanceKm;
    return segment;
  });
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseGpx(content: string): ParsedGpx {
  const parser = new DOMParser();
  const xml = parser.parseFromString(content, "text/xml");
  const trkpts = Array.from(xml.getElementsByTagName("trkpt"));

  if (trkpts.length === 0) {
    throw new Error("No track points found in the GPX file.");
  }

  const cumulativeTrack: { lat: number; lon: number; distance: number }[] = [];
  trkpts.forEach((pt, index) => {
    const lat = parseFloat(pt.getAttribute("lat") ?? "");
    const lon = parseFloat(pt.getAttribute("lon") ?? "");
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      throw new Error("Invalid coordinates in track points.");
    }

    if (index === 0) {
      cumulativeTrack.push({ lat, lon, distance: 0 });
      return;
    }

    const prev = cumulativeTrack[index - 1];
    const distance = haversineDistanceMeters(prev.lat, prev.lon, lat, lon);
    cumulativeTrack.push({ lat, lon, distance: prev.distance + distance });
  });

  const totalMeters = cumulativeTrack.at(-1)?.distance ?? 0;
  const wpts = Array.from(xml.getElementsByTagName("wpt"));

  const aidStations = wpts
    .map((wpt) => {
      const lat = parseFloat(wpt.getAttribute("lat") ?? "");
      const lon = parseFloat(wpt.getAttribute("lon") ?? "");
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return null;
      }

      let closest = cumulativeTrack[0];
      let minDistance = Infinity;

      cumulativeTrack.forEach((point) => {
        const d = haversineDistanceMeters(lat, lon, point.lat, point.lon);
        if (d < minDistance) {
          minDistance = d;
          closest = point;
        }
      });

      const name =
        wpt.getElementsByTagName("name")[0]?.textContent?.trim() ||
        wpt.getElementsByTagName("desc")[0]?.textContent?.trim() ||
        "Aid station";

      return { name, distanceKm: +(closest?.distance ?? 0) / 1000 };
    })
    .filter(Boolean) as ParsedGpx["aidStations"];

  aidStations.push({ name: "Finish", distanceKm: totalMeters / 1000 });

  const uniqueStations = aidStations
    .filter((station, index, self) =>
      index === self.findIndex((s) => s.name === station.name && Math.abs(s.distanceKm - station.distanceKm) < 0.01)
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { distanceKm: totalMeters / 1000, aidStations: uniqueStations };
}

export default function RacePlannerPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "aidStations" });
  const watchedValues = form.watch();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const parsed = formSchema.safeParse(watchedValues);
  const segments = parsed.success ? buildSegments(parsed.data) : [];

  const handleImportGpx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsedGpx = parseGpx(content);
      form.setValue("raceDistanceKm", Number(parsedGpx.distanceKm.toFixed(1)));
      form.setValue(
        "aidStations",
        parsedGpx.aidStations.length > 0
          ? parsedGpx.aidStations
          : [{ name: "Finish", distanceKm: Number(parsedGpx.distanceKm.toFixed(1)) }]
      );
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to import GPX file.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Race inputs</CardTitle>
              <CardDescription>Adjust distance, pacing, fueling and aid-station layout.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,application/gpx+xml"
                className="hidden"
                onChange={handleImportGpx}
              />
              <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
                Import GPX
              </Button>
            </div>
          </div>
          {importError && <p className="text-xs text-red-400">{importError}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="raceDistanceKm">Race distance (km)</Label>
              <Input
                id="raceDistanceKm"
                type="number"
                step="0.5"
                {...form.register("raceDistanceKm", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetIntakePerHour">Target intake (g/hr)</Label>
              <Input
                id="targetIntakePerHour"
                type="number"
                step="1"
                {...form.register("targetIntakePerHour", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paceType">Pacing input</Label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  id="paceType"
                  className="h-10 rounded-md border border-slate-800 bg-slate-900/80 px-3 text-sm text-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                  {...form.register("paceType")}
                >
                  <option value="pace">Pace (min/km)</option>
                  <option value="speed">Speed (km/h)</option>
                </select>
              </div>
            </div>
            {form.watch("paceType") === "pace" ? (
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="paceMinutes">Minutes / km</Label>
                  <Input
                    id="paceMinutes"
                    type="number"
                    min="0"
                    {...form.register("paceMinutes", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paceSeconds">Seconds</Label>
                  <Input
                    id="paceSeconds"
                    type="number"
                    min="0"
                    max="59"
                    {...form.register("paceSeconds", { valueAsNumber: true })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="speedKph">Speed (km/h)</Label>
                <Input
                  id="speedKph"
                  type="number"
                  step="0.1"
                  min="0"
                  {...form.register("speedKph", { valueAsNumber: true })}
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-100">Aid stations</p>
                <p className="text-xs text-slate-400">Edit the checkpoints where you plan to refuel.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ name: `Aid ${fields.length + 1}`, distanceKm: 0 })}
              >
                Add station
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr,1fr,auto] items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`aidStations.${index}.name`}>Name</Label>
                    <Input
                      id={`aidStations.${index}.name`}
                      type="text"
                      {...form.register(`aidStations.${index}.name` as const)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`aidStations.${index}.distanceKm`}>Distance (km)</Label>
                    <Input
                      id={`aidStations.${index}.distanceKm`}
                      type="number"
                      step="0.5"
                      {...form.register(`aidStations.${index}.distanceKm` as const, { valueAsNumber: true })}
                    />
                  </div>
                  <Button type="button" variant="ghost" onClick={() => remove(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Segment breakdown</CardTitle>
            <CardDescription>
              Fuel required per segment and ETA based on your current pacing and intake target.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {segments.length === 0 ? (
              <p className="text-sm text-slate-400">Complete the form to see your plan.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checkpoint</TableHead>
                    <TableHead className="text-right">Dist. (km)</TableHead>
                    <TableHead className="text-right">Segment (km)</TableHead>
                    <TableHead className="text-right">Segment time</TableHead>
                    <TableHead className="text-right">ETA</TableHead>
                    <TableHead className="text-right">Fuel (g)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments.map((segment) => (
                    <TableRow key={segment.checkpoint}>
                      <TableCell className="font-medium text-slate-50">{segment.checkpoint}</TableCell>
                      <TableCell className="text-right text-slate-300">
                        {segment.distanceKm.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right text-slate-300">
                        {segment.segmentKm.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right text-slate-300">
                        {formatMinutes(segment.segmentMinutes)}
                      </TableCell>
                      <TableCell className="text-right text-slate-300">
                        {formatMinutes(segment.etaMinutes)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-200">
                        {segment.fuelGrams.toFixed(0)} g
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>A compact view of where you expect to be on course.</CardDescription>
          </CardHeader>
          <CardContent>
            {segments.length === 0 ? (
              <p className="text-sm text-slate-400">Add your pacing details to preview the course timeline.</p>
            ) : (
              <div className="space-y-4">
                {segments.map((segment, index) => (
                  <div key={segment.checkpoint} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-50">{segment.checkpoint}</p>
                          <p className="text-xs text-slate-400">
                            {segment.distanceKm.toFixed(1)} km · ETA {formatMinutes(segment.etaMinutes)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-300">
                        <p>{segment.segmentKm.toFixed(1)} km segment</p>
                        <p>{segment.fuelGrams.toFixed(0)} g fuel</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        style={{
                          width: `${Math.min((segment.distanceKm / watchedValues.raceDistanceKm) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
