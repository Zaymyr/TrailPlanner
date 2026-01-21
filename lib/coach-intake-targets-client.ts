import {
  coachIntakeTargetsResponseSchema,
  type CoachIntakeTargets,
  type CoachIntakeTargetsUpsert,
} from "./coach-intake-targets";

export const fetchCoachIntakeTargets = async (
  accessToken: string,
  coacheeId?: string,
  signal?: AbortSignal
): Promise<CoachIntakeTargets | null> => {
  const query = coacheeId ? `?coacheeId=${encodeURIComponent(coacheeId)}` : "";
  const response = await fetch(`/api/coach/intake-targets${query}`, {
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

export const upsertCoachIntakeTargets = async (
  accessToken: string,
  payload: CoachIntakeTargetsUpsert
): Promise<CoachIntakeTargets> => {
  const response = await fetch("/api/coach/intake-targets", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to update coach intake targets.";
    throw new Error(message);
  }

  const parsed = coachIntakeTargetsResponseSchema.safeParse(data);

  if (!parsed.success || !parsed.data.targets) {
    throw new Error("Invalid coach intake targets response");
  }

  return parsed.data.targets;
};
