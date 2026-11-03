import { z } from "zod";

/** Request and response contracts shared by the admin video generator and its narration routes. */

export const narrationBeatInputSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["intro", "start", "climb", "descent", "flat", "aid", "lifeBase", "finish", "outro"]),
  title: z.string().max(160),
  startKm: z.number(),
  endKm: z.number(),
  facts: z.array(z.string().max(80)).max(8),
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
  beats: z.array(narrationBeatInputSchema).min(1).max(20),
});

export const narrationScriptResponseSchema = z.object({
  beats: z.array(z.object({ id: z.string(), narration: z.string() })),
});

export const ELEVENLABS_VOICE_ID_PATTERN = /^[A-Za-z0-9]{10,40}$/;

export const narrationVoiceRequestSchema = z.object({
  voiceId: z.string().regex(ELEVENLABS_VOICE_ID_PATTERN).nullable(),
  items: z.array(z.object({ id: z.string().min(1).max(80), text: z.string().min(1).max(600) })).min(1).max(20),
});

export const narrationVoiceResponseSchema = z.object({
  clips: z.array(z.object({
    id: z.string(),
    text: z.string(),
    audioBase64: z.string(),
    durationMs: z.number(),
  })),
});

export type NarrationScriptRequest = z.infer<typeof narrationScriptRequestSchema>;
export type NarrationVoiceRequest = z.infer<typeof narrationVoiceRequestSchema>;
