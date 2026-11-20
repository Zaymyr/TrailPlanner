import { z } from "zod";

import type { SupabaseServiceConfig } from "./supabase";

/**
 * « Rendus en cours » of the Publications admin: the recent reel renders (`video_render_jobs`) and
 * carousel renders (`carousel_render_jobs`) with a readable stage, so a launched render never looks
 * idle. Read-only, service role, light columns (no snapshot, no reel content).
 */

export const RENDER_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const LIST_LIMIT = 12;

export type RenderActivityStatus = "active" | "done" | "failed";
export type RenderActivity = {
  id: string;
  kind: "reel" | "carousel";
  title: string;
  status: RenderActivityStatus;
  /** 0..1 for a reel render that reports progress, else null. */
  progress: number | null;
  stage: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export const reelRenderActivityRowSchema = z.object({
  id: z.string(),
  race_title: z.string(),
  status: z.enum(["uploading", "queued", "running", "done", "failed"]),
  progress: z.number(),
  message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
export type ReelRenderActivityRow = z.infer<typeof reelRenderActivityRowSchema>;

export const carouselRenderActivityRowSchema = z.object({
  id: z.string(),
  series: z.enum(["plan", "brief", "week"]),
  title: z.string(),
  status: z.enum(["queued", "running", "done", "failed"]),
  slide_count: z.number().int(),
  message: z.string().nullable(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
export type CarouselRenderActivityRow = z.infer<typeof carouselRenderActivityRowSchema>;

const SERIES_NAMES = { plan: "Le plan chiffré", brief: "Le brief", week: "La semaine qui vient" } as const;

const failedStage = (message: string | null) => `Échec : ${message?.trim() || "raison inconnue"}`;

export const toReelRenderActivity = (row: ReelRenderActivityRow): RenderActivity => {
  const base = { id: row.id, kind: "reel" as const, title: row.race_title, createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at };
  switch (row.status) {
    case "uploading":
      return { ...base, status: "active", progress: null, stage: "Préparation de la scène" };
    case "queued":
      return { ...base, status: "active", progress: null, stage: "En attente du serveur de rendu (1 à 2 min)" };
    case "running": {
      const progress = Math.min(1, Math.max(0, row.progress));
      return { ...base, status: "active", progress, stage: progress >= 0.99 ? "Envoi de la vidéo" : `Rendu vidéo · ${Math.round(progress * 100)} %` };
    }
    case "done":
      return { ...base, status: "done", progress: 1, stage: "Terminé" };
    default:
      return { ...base, status: "failed", progress: null, stage: failedStage(row.message) };
  }
};

export const toCarouselRenderActivity = (row: CarouselRenderActivityRow): RenderActivity => {
  const base = { id: row.id, kind: "carousel" as const, title: `${SERIES_NAMES[row.series]} · ${row.title}`, progress: null, createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at };
  switch (row.status) {
    case "queued":
      return { ...base, status: "active", stage: "En attente du serveur de rendu (1 à 2 min)" };
    case "running":
      return { ...base, status: "active", stage: `Capture et envoi des ${row.slide_count} images` };
    case "done":
      return { ...base, status: "done", stage: `Terminé · ${row.slide_count} images` };
    default:
      return { ...base, status: "failed", stage: failedStage(row.message) };
  }
};

/** Active renders first, then the most recent; finished ones only within the last 24 h. */
export const selectRenderActivity = (items: RenderActivity[], nowMs: number) =>
  items
    .filter((item) => item.status === "active" || nowMs - Date.parse(item.finishedAt ?? item.createdAt) <= RENDER_ACTIVITY_WINDOW_MS)
    .sort((left, right) => Number(right.status === "active") - Number(left.status === "active") || right.createdAt.localeCompare(left.createdAt));

const read = async <T>(supabase: SupabaseServiceConfig, path: string, schema: z.ZodType<T>) => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: supabase.supabaseServiceRoleKey, Authorization: `Bearer ${supabase.supabaseServiceRoleKey}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to read render activity (${response.status}).`);
  return z.array(schema).parse(await response.json());
};

export const listReelRenderActivityRows = (supabase: SupabaseServiceConfig) =>
  read(supabase, `video_render_jobs?select=${Object.keys(reelRenderActivityRowSchema.shape).join(",")}&order=created_at.desc&limit=${LIST_LIMIT}`, reelRenderActivityRowSchema);

export const listCarouselRenderActivityRows = (supabase: SupabaseServiceConfig) =>
  read(supabase, `carousel_render_jobs?select=${Object.keys(carouselRenderActivityRowSchema.shape).join(",")}&order=created_at.desc&limit=${LIST_LIMIT}`, carouselRenderActivityRowSchema);
