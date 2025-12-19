import { z } from "zod";

import { aidStationSchema, tracePointSchema } from "./traceSchemas";

const gpxPointSchema = tracePointSchema.pick({ lat: true, lng: true, elevation: true });
const gpxAidStationSchema = aidStationSchema.pick({ name: true, lat: true, lng: true, type: true, notes: true });

const gpxPayloadSchema = z.object({
  name: z.string().trim().min(1),
  points: z.array(gpxPointSchema).min(1),
  aidStations: z.array(gpxAidStationSchema).optional().default([]),
});

export type GpxPayload = z.infer<typeof gpxPayloadSchema>;

const escapeXml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/\"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const buildGpx = (input: unknown): string => {
  const parsed = gpxPayloadSchema.parse(input);

  const trackPoints = parsed.points
    .map((point) => {
      const elevation = typeof point.elevation === "number" ? `<ele>${point.elevation.toFixed(2)}</ele>` : "";
      return `<trkpt lat="${point.lat}" lon="${point.lng}">${elevation}</trkpt>`;
    })
    .join("");

  const waypoints = parsed.aidStations
    .map(
      (station) =>
        `<wpt lat="${station.lat}" lon="${station.lng}"><name>${escapeXml(station.name)}</name>${
          station.type ? `<type>${escapeXml(station.type)}</type>` : ""
        }${station.notes ? `<desc>${escapeXml(station.notes)}</desc>` : ""}</wpt>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailPlanner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(parsed.name)}</name>
  </metadata>
  ${waypoints}
  <trk>
    <name>${escapeXml(parsed.name)}</name>
    <trkseg>${trackPoints}</trkseg>
  </trk>
</gpx>`;
};

export const downloadGpx = (payload: unknown, filename = "trace.gpx") => {
  const gpx = buildGpx(payload);
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const copyGpxToClipboard = async (payload: unknown): Promise<void> => {
  const gpx = buildGpx(payload);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(gpx);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = gpx;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};
