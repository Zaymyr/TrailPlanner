import { z } from "zod";

import type { SupabaseServiceConfig } from "./supabase";

/**
 * Shared pool of ElevenLabs voices of the admin reel generator (table video_voices, service role
 * only): each new reel picks one active voice at random. Same id rule as the editor's voice
 * library and the table check.
 */
export const VOICE_POOL_ID_PATTERN = /^[A-Za-z0-9]{8,64}$/;
export const VOICE_POOL_NAME_MAX = 40;

export const voicePoolNameSchema = z.string().trim().min(1).max(VOICE_POOL_NAME_MAX);

export const addVoiceRequestSchema = z.object({
  voiceId: z.string().trim().regex(VOICE_POOL_ID_PATTERN),
  /** Optional: the ElevenLabs name of the voice is used when it can be read. */
  name: voicePoolNameSchema.optional(),
});

export const updateVoiceRequestSchema = z.object({
  name: voicePoolNameSchema.optional(),
  active: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.active !== undefined, { message: "Rien à modifier." });

export const poolVoiceSchema = z.object({
  id: z.string(),
  voiceId: z.string(),
  name: z.string(),
  active: z.boolean(),
});

export const poolVoicesResponseSchema = z.object({ voices: z.array(poolVoiceSchema) });

export type PoolVoice = z.infer<typeof poolVoiceSchema>;

const rowSchema = z.object({
  id: z.string(),
  elevenlabs_voice_id: z.string(),
  name: z.string(),
  active: z.boolean(),
});

export const VIDEO_VOICE_COLUMNS = "id,elevenlabs_voice_id,name,active";

const toPoolVoice = (row: z.infer<typeof rowSchema>): PoolVoice => ({
  id: row.id,
  voiceId: row.elevenlabs_voice_id,
  name: row.name,
  active: row.active,
});

const serviceHeaders = (supabase: SupabaseServiceConfig) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
});

const baseUrl = (supabase: SupabaseServiceConfig) => `${supabase.supabaseUrl}/rest/v1/video_voices`;

export const listPoolVoices = async (supabase: SupabaseServiceConfig): Promise<PoolVoice[]> => {
  const response = await fetch(`${baseUrl(supabase)}?select=${VIDEO_VOICE_COLUMNS}&order=created_at.asc`, {
    headers: serviceHeaders(supabase),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to list voices: ${await response.text()}`);
  return z.array(rowSchema).parse(await response.json()).map(toPoolVoice);
};

/** `duplicate` when the ElevenLabs id is already in the pool (unique violation, HTTP 409). */
export const insertPoolVoice = async (
  supabase: SupabaseServiceConfig,
  row: { elevenlabs_voice_id: string; name: string; created_by: string },
): Promise<{ voice: PoolVoice } | { duplicate: true }> => {
  const response = await fetch(`${baseUrl(supabase)}?select=${VIDEO_VOICE_COLUMNS}`, {
    method: "POST",
    headers: { ...serviceHeaders(supabase), Prefer: "return=representation" },
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (response.status === 409) return { duplicate: true };
  if (!response.ok) throw new Error(`Unable to add voice: ${await response.text()}`);
  return { voice: toPoolVoice(z.array(rowSchema).parse(await response.json())[0]) };
};

/** The updated voice, or null when it does not exist. */
export const updatePoolVoice = async (
  supabase: SupabaseServiceConfig,
  id: string,
  patch: { name?: string; active?: boolean },
): Promise<PoolVoice | null> => {
  const response = await fetch(`${baseUrl(supabase)}?id=eq.${id}&select=${VIDEO_VOICE_COLUMNS}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(supabase), Prefer: "return=representation" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to update voice: ${await response.text()}`);
  const row = z.array(rowSchema).parse(await response.json())[0];
  return row ? toPoolVoice(row) : null;
};

/** True when a voice was removed. */
export const deletePoolVoice = async (supabase: SupabaseServiceConfig, id: string) => {
  const response = await fetch(`${baseUrl(supabase)}?id=eq.${id}&select=id`, {
    method: "DELETE",
    headers: { ...serviceHeaders(supabase), Prefer: "return=representation" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to delete voice: ${await response.text()}`);
  return z.array(z.object({ id: z.string() })).parse(await response.json()).length > 0;
};

export type VoiceCheck = { name: string | null; warning: string | null };

/**
 * Looks the voice up in ElevenLabs to suggest its name. Never blocks: any failure (no key,
 * unknown voice, network) is only a warning. The key is sent as a header and never logged.
 */
export const checkElevenLabsVoice = async (voiceId: string, fetcher: typeof fetch = fetch): Promise<VoiceCheck> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { name: null, warning: "Voix non vérifiée : ELEVENLABS_API_KEY est absente côté serveur." };
  try {
    const response = await fetcher(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 404) return { name: null, warning: "Cet identifiant n’a pas été trouvé chez ElevenLabs : vérifie-le." };
    if (!response.ok) return { name: null, warning: `Voix non vérifiée (ElevenLabs a répondu ${response.status}).` };
    const parsed = z.object({ name: z.string() }).safeParse(await response.json().catch(() => null));
    const name = parsed.success ? parsed.data.name.trim().slice(0, VOICE_POOL_NAME_MAX) : "";
    return { name: name || null, warning: null };
  } catch {
    return { name: null, warning: "Voix non vérifiée : ElevenLabs est injoignable." };
  }
};
