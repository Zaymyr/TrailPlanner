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
  // Organizer free text ("Samedi 14h30 au plus tard"), not only a clock time.
  cutoffTime: z.string().max(120).nullable(),
  narration: z.string().max(600),
  /** Stations flown over inside the leg, with the share of the leg's screen time when reached. */
  passages: z.array(z.object({ name: z.string().max(120), km: z.number(), moment: z.number().min(0).max(1) })).max(8).default([]),
});

export const NARRATION_STYLES = ["pote", "coach", "commentateur", "suspense", "chambreur"] as const;
export type NarrationStyle = (typeof NARRATION_STYLES)[number];

export const NARRATION_STYLE_LABELS: Record<NarrationStyle, string> = {
  pote: "Pote traileur",
  coach: "Coach",
  commentateur: "Commentateur en direct",
  suspense: "Suspense",
  chambreur: "Chambreur",
};

export const narrationScriptRequestSchema = z.object({
  race: z.object({
    title: z.string().max(160),
    subtitle: z.string().max(160).nullable(),
    distanceKm: z.number(),
    elevationGainM: z.number().nullable(),
    startDetail: z.string().max(200).nullable(),
  }),
  targetSeconds: z.number().min(10).max(300),
  /** Measured pace of the chosen voice (shown words per second of audio), when known. */
  wordsPerSecond: z.number().min(1).max(4).optional(),
  /** With the expressive v3 voice, the script may carry performance tags such as [excited]. */
  voiceModel: z.enum(["multilingual_v2", "v3"]).default("multilingual_v2"),
  beats: z.array(narrationBeatInputSchema).min(1).max(40),
  /** Admin instructions for this race ("bâtons interdits"), applied before every other rule. */
  notes: z.string().max(1_000).optional(),
  /** Storytelling style; omitted, the route picks one at random so reels do not all sound alike. */
  style: z.enum(NARRATION_STYLES).optional(),
});

export const narrationScriptResponseSchema = z.object({
  beats: z.array(z.object({ id: z.string(), narration: z.string() })),
  /** The style actually used (the random pick when none was asked). */
  style: z.enum(NARRATION_STYLES).optional(),
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

/** Instagram Reel description: a short story of the race plus hashtags, written by Claude. */
export const instagramCaptionRequestSchema = z.object({
  race: narrationScriptRequestSchema.shape.race.extend({
    raceDate: z.string().max(20).nullable(),
  }),
  legs: z.array(z.object({
    kind: narrationBeatInputSchema.shape.kind,
    title: z.string().max(160),
    facts: z.array(z.string().max(120)).max(8),
    narration: z.string().max(600),
  })).min(1).max(40),
});

export const instagramCaptionResponseSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
});

export type InstagramCaptionRequest = z.infer<typeof instagramCaptionRequestSchema>;

/** Instagram limits: 2,200 characters per caption, 30 hashtags. */
export const INSTAGRAM_CAPTION_MAX_CHARS = 2_200;
export const INSTAGRAM_MAX_HASHTAGS = 30;
