"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { poolVoiceSchema, poolVoicesResponseSchema, type PoolVoice } from "../../../lib/video-voices";
import type { SavedVoice } from "./voice-library";
import { getImportableVoices } from "./voice-pool";

const ENDPOINT = "/api/admin/video-generator/voices";

const readMessage = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null) as { message?: unknown } | null;
  return typeof payload?.message === "string" ? payload.message : fallback;
};

/**
 * The shared voice pool of the admin: loaded once, then kept in step with each change. A pool that
 * cannot be read is empty (the editor falls back to the free voice id), never a blocking error.
 */
export const useVoicePool = (accessToken: string | undefined, enabled: boolean) => {
  const [voices, setVoices] = useState<PoolVoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  useEffect(() => {
    if (!enabled || !accessToken) return;
    const controller = new AbortController();
    void fetch(ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readMessage(response, "Le pool de voix n’a pas pu être lu."));
        const parsed = poolVoicesResponseSchema.safeParse(await response.json().catch(() => null));
        if (controller.signal.aborted) return;
        setVoices(parsed.success ? parsed.data.voices : []);
        setError(parsed.success ? null : "Le pool de voix est illisible.");
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Le pool de voix n’a pas pu être lu.");
        setLoaded(true);
      });
    return () => controller.abort();
  }, [accessToken, enabled]);

  const call = useCallback(async (path: string, method: string, body: unknown, fallback: string) => {
    const response = await fetch(`${ENDPOINT}${path}`, {
      method,
      headers: { Authorization: `Bearer ${tokenRef.current}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(await readMessage(response, fallback));
    return response.json().catch(() => null) as Promise<unknown>;
  }, []);

  /** Adds a voice; resolves with an ElevenLabs warning to show, if any. Rejects with a French message. */
  const addVoice = useCallback(async (voiceId: string, name: string) => {
    const payload = await call("", "POST", { voiceId, ...(name.trim() ? { name: name.trim() } : {}) }, "La voix n’a pas pu être ajoutée.") as { voice?: unknown; warning?: unknown } | null;
    const voice = poolVoiceSchema.safeParse(payload?.voice);
    if (!voice.success) throw new Error("Réponse de voix invalide.");
    setVoices((current) => [...current, voice.data]);
    return typeof payload?.warning === "string" ? payload.warning : null;
  }, [call]);

  const updateVoice = useCallback(async (id: string, patch: { name?: string; active?: boolean }) => {
    const payload = await call(`/${id}`, "PATCH", patch, "La voix n’a pas pu être modifiée.") as { voice?: unknown } | null;
    const voice = poolVoiceSchema.safeParse(payload?.voice);
    if (voice.success) setVoices((current) => current.map((item) => item.id === id ? voice.data : item));
  }, [call]);

  const removeVoice = useCallback(async (id: string) => {
    await call(`/${id}`, "DELETE", undefined, "La voix n’a pas pu être supprimée.");
    setVoices((current) => current.filter((item) => item.id !== id));
  }, [call]);

  /** One-time copy of the named voices of this browser's library; resolves with how many were added. */
  const importLibrary = useCallback(async (library: SavedVoice[]) => {
    let added = 0;
    for (const voice of getImportableVoices(library, voices)) {
      try {
        await addVoice(voice.voiceId, voice.name);
        added += 1;
      } catch (cause) {
        // Already in the pool (409) is fine; any other failure stops the import.
        if (!(cause instanceof Error) || !cause.message.includes("déjà")) throw cause;
      }
    }
    return added;
  }, [addVoice, voices]);

  return { voices, loaded, error, addVoice, updateVoice, removeVoice, importLibrary };
};

export type VoicePool = ReturnType<typeof useVoicePool>;
