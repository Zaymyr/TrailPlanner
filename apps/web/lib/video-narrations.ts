import { z } from "zod";

import { reelContentSchema } from "./reel-content";
import type { SupabaseServiceConfig } from "./supabase";
import { VIDEO_STORY_MODES, type VideoStoryMode } from "./video-narration";

/**
 * Saved reel narration per race and story mode (table video_narrations keyed by race_id + mode,
 * plus one JSON of voice clips per mode in the private Storage bucket video-narrations), so a
 * race's script and voice are written once per mode and reused.
 */
export const VIDEO_NARRATIONS_BUCKET = "video-narrations";

/** `?mode=` of the narration routes: "full" when absent (older editors), 400 when unknown. */
export const narrationModeSchema = z.enum(VIDEO_STORY_MODES).default("full");

export const savedVoiceSchema = z.object({
  voiceId: z.string().max(64).nullable(),
  // Name of the pool voice (shown as « Voix : … »); absent from narrations saved before the pool.
  voiceName: z.string().max(40).nullable().optional(),
  model: z.enum(["multilingual_v2", "v3", "v4"]),
  expressiveness: z.number().min(0).max(1),
});

export const savedClipSchema = z.object({
  beatId: z.string().min(1).max(80),
  text: z.string().max(600),
  // A 20 s sentence of MP3 is well under 1 MB of base64.
  audioBase64: z.string().max(2_000_000),
  durationMs: z.number().min(0).max(120_000),
  characterEndMs: z.array(z.number()).max(600).optional(),
  // Absent from clips saved before the subtitles used word timing.
  characterStartMs: z.array(z.number()).max(600).optional(),
});

export const saveNarrationRequestSchema = z.object({
  // Composition settings, parsed by the editor with its own schema so old saves stay readable.
  settings: z.record(z.string(), z.unknown()),
  narrationOverrides: z.record(z.string().max(80), z.string().max(600)),
  voice: savedVoiceSchema,
  // Omitted: the saved clips are kept as they are (a text-only save).
  clips: z.array(savedClipSchema).max(40).optional(),
  // Highlights reel text (script, hook, caption, hashtags...): omitted keeps the saved content, null clears it.
  content: reelContentSchema.nullable().optional(),
});

export type SaveNarrationRequest = z.infer<typeof saveNarrationRequestSchema>;

export const savedNarrationSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
  narrationOverrides: z.record(z.string(), z.string()),
  voice: savedVoiceSchema.partial(),
  clips: z.array(savedClipSchema),
  /** Highlights reel text; null for full narrations and for saves made before it existed. */
  content: reelContentSchema.nullable().default(null),
  updatedAt: z.string(),
});

export type SavedNarration = z.infer<typeof savedNarrationSchema>;

export const savedNarrationResponseSchema = z.object({ narration: savedNarrationSchema.nullable() });

const rowSchema = z.object({
  race_id: z.string(),
  settings: z.record(z.string(), z.unknown()).catch({}),
  narration_overrides: z.record(z.string(), z.string()).catch({}),
  voice: savedVoiceSchema.partial().catch({}),
  clip_count: z.number(),
  // An unreadable content only costs the caption: the narration itself is restored.
  content: reelContentSchema.nullable().catch(null),
  updated_at: z.string(),
});

const headers = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  ...extra,
});

/** Voice clips object: `<race_id>.json` for the full narration (as before), `<race_id>.<mode>.json` otherwise. */
export const getClipsObjectName = (raceId: string, mode: VideoStoryMode = "full") =>
  mode === "full" ? `${raceId}.json` : `${raceId}.${mode}.json`;

const clipsObjectUrl = (supabase: SupabaseServiceConfig, raceId: string, mode: VideoStoryMode) =>
  `${supabase.supabaseUrl}/storage/v1/object/${VIDEO_NARRATIONS_BUCKET}/${getClipsObjectName(raceId, mode)}`;

export const readNarration = async (
  supabase: SupabaseServiceConfig,
  raceId: string,
  mode: VideoStoryMode = "full",
  fetcher: typeof fetch = fetch,
): Promise<SavedNarration | null> => {
  const response = await fetcher(
    `${supabase.supabaseUrl}/rest/v1/video_narrations?race_id=eq.${raceId}&mode=eq.${mode}&select=race_id,settings,narration_overrides,voice,clip_count,content,updated_at&limit=1`,
    { headers: headers(supabase), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to read narration: ${await response.text()}`);
  const row = z.array(rowSchema).parse(await response.json())[0];
  if (!row) return null;
  let clips: SavedNarration["clips"] = [];
  if (row.clip_count > 0) {
    const clipsResponse = await fetcher(clipsObjectUrl(supabase, raceId, mode), { headers: headers(supabase), cache: "no-store" });
    // Missing or unreadable clips only cost a voice regeneration: the text is still restored.
    if (clipsResponse.ok) clips = z.array(savedClipSchema).catch([]).parse(await clipsResponse.json().catch(() => []));
  }
  return { settings: row.settings, narrationOverrides: row.narration_overrides, voice: row.voice, clips, content: row.content, updatedAt: row.updated_at };
};

export const saveNarration = async (
  supabase: SupabaseServiceConfig,
  raceId: string,
  userId: string,
  request: SaveNarrationRequest,
  mode: VideoStoryMode = "full",
  fetcher: typeof fetch = fetch,
) => {
  if (request.clips) {
    const upload = await fetcher(clipsObjectUrl(supabase, raceId, mode), {
      method: "POST",
      headers: headers(supabase, { "Content-Type": "application/json", "x-upsert": "true" }),
      body: JSON.stringify(request.clips),
      cache: "no-store",
    });
    if (!upload.ok) throw new Error(`Unable to store voice clips: ${await upload.text()}`);
  }
  const updatedAt = new Date().toISOString();
  const row: Record<string, unknown> = {
    race_id: raceId,
    mode,
    settings: request.settings,
    narration_overrides: request.narrationOverrides,
    voice: request.voice,
    updated_by: userId,
    updated_at: updatedAt,
    ...(request.clips ? { clip_count: request.clips.length } : {}),
    // Only a highlights reel has content: a full narration never stores one.
    ...(mode === "highlights" && request.content !== undefined ? { content: request.content } : {}),
  };
  const response = await fetcher(`${supabase.supabaseUrl}/rest/v1/video_narrations?on_conflict=race_id,mode`, {
    method: "POST",
    headers: headers(supabase, { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to save narration: ${await response.text()}`);
  return { updatedAt };
};

/** Per race: finished background videos and whether a narration (any mode) is saved, for the race picker. */
export const readVideoRaceStats = async (supabase: SupabaseServiceConfig, fetcher: typeof fetch = fetch) => {
  const [jobs, narrations] = await Promise.all([
    fetcher(`${supabase.supabaseUrl}/rest/v1/video_render_jobs?status=eq.done&select=race_id`, { headers: headers(supabase), cache: "no-store" }),
    fetcher(`${supabase.supabaseUrl}/rest/v1/video_narrations?select=race_id,clip_count`, { headers: headers(supabase), cache: "no-store" }),
  ]);
  if (!jobs.ok || !narrations.ok) throw new Error("Unable to read video stats.");
  const stats: Record<string, { videos: number; narration: boolean; voice: boolean }> = {};
  const entry = (raceId: string) => (stats[raceId] ??= { videos: 0, narration: false, voice: false });
  z.array(z.object({ race_id: z.string() })).parse(await jobs.json()).forEach((row) => { entry(row.race_id).videos += 1; });
  z.array(z.object({ race_id: z.string(), clip_count: z.number() })).parse(await narrations.json()).forEach((row) => {
    const item = entry(row.race_id);
    item.narration = true;
    // One row per story mode: a voice in either counts.
    item.voice ||= row.clip_count > 0;
  });
  return stats;
};
