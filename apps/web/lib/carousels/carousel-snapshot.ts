import { z } from "zod";

import type { BriefSnapshot } from "./carousel-brief";
import type { PlanSnapshot } from "./carousel-plan";
import type { WeekSnapshot } from "./carousel-week";

/** What the carousel render page draws: one of the three series, fully computed on the server. */

export const CAROUSEL_SERIES = ["plan", "brief", "week"] as const;
export type CarouselSeries = (typeof CAROUSEL_SERIES)[number];

export const CAROUSEL_SERIES_LABELS: Record<CarouselSeries, string> = {
  plan: "Le plan chiffré",
  brief: "Le brief",
  week: "La semaine qui vient",
};

export type CarouselSnapshot = PlanSnapshot | BriefSnapshot | WeekSnapshot;

/** Instagram carousel slides: portrait 4:5. */
export const CAROUSEL_SLIDE_WIDTH = 1080;
export const CAROUSEL_SLIDE_HEIGHT = 1350;

const snapshotSchema = z.object({ series: z.enum(CAROUSEL_SERIES) }).passthrough();

/** The stored snapshot (written by the server, so only its series is checked here). */
export const parseCarouselSnapshot = (value: unknown): CarouselSnapshot => snapshotSchema.parse(value) as unknown as CarouselSnapshot;

export const getSlideCount = (snapshot: CarouselSnapshot) => {
  if (snapshot.series === "plan") return snapshot.slideCount;
  return snapshot.series === "brief" ? 3 : 2;
};

/** Cloud Storage object of one slide (1-based), next to the reel objects of the render bucket. */
export const getCarouselSlideObject = (jobId: string, index: number) => `carousels/${jobId}/slide-${index}.jpg`;
