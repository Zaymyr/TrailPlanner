import { z } from "zod";

import {
  videoAidStationSchema,
  videoRouteBoundsSchema,
  videoRoutePointSchema,
} from "../../../lib/video-generator";
import type { VideoRaceInfo } from "./VideoCompositionOverlay";
import { videoCompositionSettingsSchema, type VideoCompositionSettings } from "./video-composition";
import type { NarrationClip } from "./narration-player";
import type { StoryLandmarks } from "./route-story";
import type { VideoAidStation, VideoRouteBounds, VideoRoutePoint } from "../../../lib/video-generator";

/**
 * Everything the background renderer needs to replay the exact composition the admin sees: the
 * route data, the settings, the edited narration, the summit names and the generated voice clips.
 * The timeline is a pure function of these, so the render matches the preview frame for frame.
 */
export type VideoRenderSnapshot = {
  version: 1;
  race: VideoRaceInfo;
  aidStations: VideoAidStation[];
  bounds: VideoRouteBounds;
  points: VideoRoutePoint[];
  settings: VideoCompositionSettings;
  narrationOverrides: Record<string, string>;
  landmarks: StoryLandmarks;
  voiceClips: NarrationClip[];
};

const narrationClipSchema = z.object({
  beatId: z.string(),
  text: z.string(),
  audioBase64: z.string(),
  durationMs: z.number(),
  characterEndMs: z.array(z.number()).optional(),
});

const snapshotSchema = z.object({
  version: z.literal(1),
  race: z.record(z.string(), z.unknown()),
  aidStations: z.array(videoAidStationSchema),
  bounds: videoRouteBoundsSchema,
  points: z.array(videoRoutePointSchema).min(2),
  settings: videoCompositionSettingsSchema,
  narrationOverrides: z.record(z.string(), z.string()),
  landmarks: z.record(z.string(), z.string()),
  voiceClips: z.array(narrationClipSchema),
});

export const parseRenderSnapshot = (value: unknown): VideoRenderSnapshot => {
  const parsed = snapshotSchema.parse(value);
  return { ...parsed, race: parsed.race as VideoRaceInfo };
};
