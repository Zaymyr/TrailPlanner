import { coachCoacheesResponseSchema, type CoachCoachee } from "./coach-coachees";

export const fetchCoachCoachees = async (accessToken: string, signal?: AbortSignal): Promise<CoachCoachee[]> => {
  const response = await fetch("/api/coach/coachees", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load coachees.";
    throw new Error(message);
  }

  const parsed = coachCoacheesResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid coach coachees response");
  }

  return parsed.data.coachees;
};
