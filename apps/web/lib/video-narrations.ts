import { z } from "zod";

import type { SupabaseServiceConfig } from "./supabase";

/**
 * Saved reel narration per race (table video_narrations + one JSON of voice clips in the private
 * Storage bucket video-narrations), so a race's script and voice are written once and reused.
 */
export const VIDEO_NARRATIONS_BUCKET = "video-narrations";

export const savedVoiceSchema = z.object({
  voiceId: z.string().max(64).nullable(),
  model: z.enum(["multilingual_v2", "v3"]),
  expressiveness: z.number().min(0).max(1),
});

export const savedClipSchema = z.object({
  beatId: z.string().min(1).max(80),
  text: z.string().max(600),
  // A 20 s sentence of MP3 is well under 1 MB of base64.
  audioBase64: z.string().max(2_000_000),
  durationMs: z.number().min(0).max(120_000),
  characterEndMs: z.array(z.number()).max(600).optional(),
});

export const saveNarrationRequestSchema = z.object({
  // Composition settings, parsed by the editor with its own schema so old saves stay readable.
  settings: z.record(z.string(), z.unknown()),
  narrationOverrides: z.record(z.string().max(80), z.string().max(600)),
  voice: savedVoiceSchema,
  // Omitted: the saved clips are kept as they are (a text-only save).
  clips: z.array(savedClipSchema).max(40).optional(),
});

export type SaveNarrationRequest = z.infer<typeof saveNarrationRequestSchema>;

export const savedNarrationSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
  narrationOverrides: z.record(z.string(), z.string()),
  voice: savedVoiceSchema.partial(),
  clips: z.array(savedClipSchema),
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
  updated_at: z.string(),
});

const headers = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  ...extra,
});

const clipsObjectUrl = (supabase: SupabaseServiceConfig, raceId: string) =>
  `${supabase.supabaseUrl}/storage/v1/object/${VIDEO_NARRATIONS_BUCKET}/${raceId}.json`;

export const readNarration = async (supabase: SupabaseServiceConfig, raceId: string, fetcher: typeof fetch = fetch): Promise<SavedNarration | null> => {
  const response = await fetcher(
    `${supabase.supabaseUrl}/rest/v1/video_narrations?race_id=eq.${raceId}&select=race_id,settings,narration_overrides,voice,clip_count,updated_at&limit=1`,
    { headers: headers(supabase), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to read narration: ${await response.text()}`);
  const row = z.array(rowSchema).parse(await response.json())[0];
  if (!row) return null;
  let clips: SavedNarration["clips"] = [];
  if (row.clip_count > 0) {
    const clipsResponse = await fetcher(clipsObjectUrl(supabase, raceId), { headers: headers(supabase), cache: "no-store" });
    // Missing or unreadable clips only cost a voice regeneration: the text is still restored.
    if (clipsResponse.ok) clips = z.array(savedClipSchema).catch([]).parse(await clipsResponse.json().catch(() => []));
  }
  return { settings: row.settings, narrationOverrides: row.narration_overrides, voice: row.voice, clips, updatedAt: row.updated_at };
};

export const saveNarration = async (
  supabase: SupabaseServiceConfig,
  raceId: string,
  userId: string,
  request: SaveNarrationRequest,
  fetcher: typeof fetch = fetch,
) => {
  if (request.clips) {
    const upload = await fetcher(clipsObjectUrl(supabase, raceId), {
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
    settings: request.settings,
    narration_overrides: request.narrationOverrides,
    voice: request.voice,
    updated_by: userId,
    updated_at: updatedAt,
    ...(request.clips ? { clip_count: request.clips.length } : {}),
  };
  const response = await fetcher(`${supabase.supabaseUrl}/rest/v1/video_narrations?on_conflict=race_id`, {
    method: "POST",
    headers: headers(supabase, { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to save narration: ${await response.text()}`);
  return { updatedAt };
};

/** Per race: finished background videos and whether a narration is saved, for the race picker. */
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
    item.voice = row.clip_count > 0;
  });
  return stats;
};
