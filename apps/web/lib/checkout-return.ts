import { canLoadAnalytics } from "./cookies/consent";
import { normalizeSourceRace } from "./race-funnel-source";

export type RunnerOffer = "course" | "annual";

/**
 * Remembers which runner offer was sent to Stripe so the success return
 * (`?billing=success`) can emit the verified-purchase event with the right
 * offer and source race. Holds only an offer, a source race id and a plan id.
 */
const STORAGE_KEY = "runner.pendingCheckout";
const TTL_MS = 2 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type PendingCheckout = { offer: RunnerOffer; sourceRace: string | null; planId: string | null };

export function rememberPendingCheckout(input: { offer: RunnerOffer; sourceRace?: string | null; planId?: string | null }): void {
  if (typeof window === "undefined" || !canLoadAnalytics()) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        offer: input.offer,
        sourceRace: normalizeSourceRace(input.sourceRace),
        planId: input.planId && UUID_PATTERN.test(input.planId) ? input.planId : null,
        expiresAt: Date.now() + TTL_MS,
      }),
    );
  } catch {
    // Attribution is best effort.
  }
}

export function readPendingCheckout(): PendingCheckout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCheckout> & { expiresAt?: unknown };
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now() || (parsed.offer !== "course" && parsed.offer !== "annual")) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      offer: parsed.offer,
      sourceRace: normalizeSourceRace(parsed.sourceRace),
      planId: typeof parsed.planId === "string" && UUID_PATTERN.test(parsed.planId) ? parsed.planId : null,
    };
  } catch {
    return null;
  }
}

export function clearPendingCheckout(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else to clean up.
  }
}
