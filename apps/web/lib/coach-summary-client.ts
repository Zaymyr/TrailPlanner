import { coachSummaryResponseSchema, type CoachSummary } from "./coach-summary";

export const fetchCoachSummary = async (accessToken: string, signal?: AbortSignal): Promise<CoachSummary> => {
  const response = await fetch("/api/coach/summary", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load coach summary.";
    throw new Error(message);
  }

  const parsed = coachSummaryResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid coach summary response");
  }

  return parsed.data.summary;
};
