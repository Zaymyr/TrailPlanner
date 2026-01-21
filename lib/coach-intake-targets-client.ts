import { coachIntakeTargetsResponseSchema, type CoachIntakeTargets } from "./coach-intake-targets";

export const fetchCoachIntakeTargets = async (
  accessToken: string,
  signal?: AbortSignal
): Promise<CoachIntakeTargets | null> => {
  const response = await fetch("/api/coach/intake-targets", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load coach intake targets.";
    throw new Error(message);
  }

  const parsed = coachIntakeTargetsResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid coach intake targets response");
  }

  return parsed.data.targets;
};
