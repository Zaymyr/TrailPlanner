import { z } from "zod";

import type { TrialStatus } from "./trial";

const trialSchema = z.object({
  trial: z.object({
    trialStartedAt: z.string().nullable(),
    trialEndsAt: z.string().nullable(),
    trialWelcomeSeenAt: z.string().nullable(),
  }),
});

export const fetchTrialStatus = async (accessToken: string, signal?: AbortSignal): Promise<TrialStatus> => {
  const response = await fetch("/api/trial/status", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load trial status.";
    throw new Error(message);
  }

  const parsed = trialSchema.safeParse(payload);

  if (!parsed.success) {
    console.error("Invalid trial status response", payload);
    return { trialStartedAt: null, trialEndsAt: null, trialWelcomeSeenAt: null };
  }

  return parsed.data.trial;
};

export const markTrialWelcomeSeen = async (accessToken: string): Promise<TrialStatus> => {
  const response = await fetch("/api/trial/welcome", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to update trial status.";
    throw new Error(message);
  }

  const parsed = trialSchema.safeParse(payload);

  if (!parsed.success) {
    console.error("Invalid trial welcome response", payload);
    return { trialStartedAt: null, trialEndsAt: null, trialWelcomeSeenAt: null };
  }

  return parsed.data.trial;
};
