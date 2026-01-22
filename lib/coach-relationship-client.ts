import { coachRelationshipResponseSchema, type CoachRelationshipStatus } from "./coach-relationship";

export const fetchCoachRelationshipStatus = async (
  accessToken: string,
  signal?: AbortSignal
): Promise<CoachRelationshipStatus> => {
  const response = await fetch("/api/coach/relationship", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load coach relationship.";
    throw new Error(message);
  }

  const parsed = coachRelationshipResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid coach relationship response");
  }

  return parsed.data.status;
};
