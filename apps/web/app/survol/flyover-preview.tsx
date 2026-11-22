"use client";

import { useMemo } from "react";

import { buildReelSettings, getReelStoryInput, isReadyDetail } from "../admin/video-generator/reel-composition";
import { VideoGeneratorMap } from "../admin/video-generator/VideoGeneratorMap";
import { buildVideoRaceInfo } from "../admin/video-generator/video-race-info";
import { applyFlyoverSettings, buildFlyoverDetail, type FlyoverMapPreset, type FlyoverStoryMode } from "../../lib/flyover-shared";
import type { ParsedGpx } from "../../lib/gpx/parseGpx";

/** Stands for the race id in the preview (music pick, overlay): never stored. */
const PREVIEW_ID = "00000000-0000-4000-8000-000000000000";

export type PreviewStation = { id: string; name: string; km: number };

/**
 * Live preview of the organizer flyover video: the very composition the paid render replays (same
 * reel settings, basemap and relief), played in the browser with the editor's viewer, without the
 * voice-over (written and recorded after the order).
 */
export function FlyoverPreview({ gpx, raceName, raceDate, stations, preset, terrain, storyMode }: {
  gpx: ParsedGpx;
  raceName: string;
  raceDate: string;
  stations: PreviewStation[];
  preset: FlyoverMapPreset;
  terrain: number;
  storyMode: FlyoverStoryMode;
}) {
  // The route (points, bounds) depends on the GPX only, so typing a name or editing a station never
  // restarts the 3D viewer; the stations and the title follow on their own.
  const route = useMemo(() => {
    const detail = buildFlyoverDetail({ id: PREVIEW_ID, race_name: "", race_date: null, aid_stations: [] }, gpx);
    return isReadyDetail(detail) ? { bounds: detail.gpx.bounds, points: getReelStoryInput(detail).points } : null;
  }, [gpx]);
  const detail = useMemo(() => buildFlyoverDetail({
    id: PREVIEW_ID,
    race_name: raceName.trim() || "Votre course",
    race_date: raceDate || null,
    aid_stations: stations,
  }, gpx), [gpx, raceName, raceDate, stations]);
  const race = useMemo(() => buildVideoRaceInfo(detail), [detail]);

  const settings = useMemo(
    () => applyFlyoverSettings(buildReelSettings(storyMode), { map_preset: preset, terrain_exaggeration: terrain }),
    [preset, terrain, storyMode],
  );
  const preview = useMemo(() => ({ settings }), [settings]);

  if (!route) return null;
  return (
    <div className="flex w-full flex-col items-center gap-2 [&>section]:w-full [&>section]:items-center">
      <VideoGeneratorMap
        accessToken=""
        aidStations={detail.aidStations}
        bounds={route.bounds}
        points={route.points}
        race={race}
        preview={preview}
      />
    </div>
  );
}
