import { z } from "zod";

export type CoachTier = {
  name: string;
  inviteLimit: number;
};

const coachTierResponseSchema = z.object({
  tiers: z.array(
    z.object({
      name: z.string(),
      inviteLimit: z.number(),
    })
  ),
});

export const fetchCoachTiers = async (accessToken: string, signal?: AbortSignal): Promise<CoachTier[]> => {
  const response = await fetch("/api/coach/tiers", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load coach tiers.";
    throw new Error(message);
  }

  const parsed = coachTierResponseSchema.safeParse(payload);

  if (!parsed.success) {
    console.error("Invalid coach tiers response", payload);
    return [];
  }

  return parsed.data.tiers;
};
