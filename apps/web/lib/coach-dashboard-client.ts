import { coachDashboardResponseSchema, type CoachDashboard } from "./coach-dashboard";

export const fetchCoachDashboard = async (accessToken: string, signal?: AbortSignal): Promise<CoachDashboard> => {
  const response = await fetch("/api/coach/dashboard", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load coach dashboard.";
    throw new Error(message);
  }

  const parsed = coachDashboardResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid coach dashboard response");
  }

  return parsed.data.dashboard;
};
