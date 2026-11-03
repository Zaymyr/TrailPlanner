import { z } from "zod";

/** Request and response contracts shared by the admin video generator and its narration routes. */

export const narrationBeatInputSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["intro", "start", "climb", "descent", "flat", "aid", "lifeBase", "finish", "outro"]),
  title: z.string().max(160),
  startKm: z.number(),
  endKm: z.number(),
  facts: z.array(z.string().max(120)).max(8),
  services: z.array(z.string().max(40)).max(6),
  cutoffTime: z.string().max(20).nullable(),
  narration: z.string().max(600),
});

export const narrationScriptRequestSchema = z.object({
  race: z.object({
    title: z.string().max(160),
    subtitle: z.string().max(160).nullable(),
    distanceKm: z.number(),
    elevationGainM: z.number().nullable(),
    startDetail: z.string().max(200).nullable(),
  }),
  targetSeconds: z.number().min(10).max(300),
  beats: z.array(narrationBeatInputSchema).min(1).max(40),
});

export const narrationScriptResponseSchema = z.object({
  beats: z.array(z.object({ id: z.string(), narration: z.string() })),
});

export const ELEVENLABS_VOICE_ID_PATTERN = /^[A-Za-z0-9]{10,40}$/;

export const NARRATION_VOICE_MODELS = ["multilingual_v2", "v3"] as const;

export const narrationVoiceRequestSchema = z.object({
  voiceId: z.string().regex(ELEVENLABS_VOICE_ID_PATTERN).nullable(),
  /** multilingual_v2 is steady; v3 is far more expressive. */
  model: z.enum(NARRATION_VOICE_MODELS).default("multilingual_v2"),
  /** 0 = calm and steady, 1 = lively and varied intonation. */
  expressiveness: z.number().min(0).max(1).default(0.6),
  items: z.array(z.object({ id: z.string().min(1).max(80), text: z.string().min(1).max(600) })).min(1).max(40),
});

export const narrationVoiceResponseSchema = z.object({
  clips: z.array(z.object({
    id: z.string(),
    text: z.string(),
    audioBase64: z.string(),
    durationMs: z.number(),
    /** End time of every character of `text`, in ms, to time subtitles exactly. */
    characterEndMs: z.array(z.number()).optional(),
  })),
});

export type NarrationScriptRequest = z.infer<typeof narrationScriptRequestSchema>;
export type NarrationVoiceRequest = z.infer<typeof narrationVoiceRequestSchema>;
