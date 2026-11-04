"use client";

import dynamic from "next/dynamic";

import type { VideoAidStation, VideoRouteBounds, VideoRoutePoint } from "../../../lib/video-generator";
import type { VideoRaceInfo } from "./VideoCompositionOverlay";
import type { VideoRenderSnapshot } from "./render-snapshot";

const VideoGeneratorMapClient = dynamic(
  () => import("./VideoGeneratorMapClient").then((module) => module.VideoGeneratorMapClient),
  {
    ssr: false,
    loading: () => <div className="h-[calc(100dvh-14rem)] min-h-[26rem] w-full animate-pulse rounded-xl bg-muted" />,
  },
);

export type VideoGeneratorMapProps = {
  aidStations: VideoAidStation[];
  bounds: VideoRouteBounds;
  points: VideoRoutePoint[];
  race: VideoRaceInfo;
  /** Admin session token for the narration routes (script and voice). */
  accessToken: string;
  /** Background render: replay a saved composition, export it at once and hand the MP4 over. */
  render?: VideoRenderHooks;
};

export type VideoRenderHooks = {
  snapshot: VideoRenderSnapshot;
  onProgress: (ratio: number) => void;
  onComplete: (video: Blob) => void;
  onError: (message: string) => void;
};

/** Renders two grid cells: the phone preview with its transport bar, then the composition panel. */
export function VideoGeneratorMap(props: VideoGeneratorMapProps) {
  return <VideoGeneratorMapClient {...props} />;
}
