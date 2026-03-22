import {
  coachCoacheeDetailResponseSchema,
  coachCoacheeOverrideResponseSchema,
  coachCoacheeStatusResponseSchema,
  type CoachCoacheeDetail,
  type CoachCoacheeOverride,
} from "./coach-coachee-details";
import { coachIntakeTargetsUpsertSchema } from "./coach-intake-targets";

type CoachCoacheeOverridePayload = Omit<CoachCoacheeOverride, "createdAt">;

export const fetchCoachCoacheeDetail = async (
  accessToken: string,
  coacheeId: string,
  signal?: AbortSignal
): Promise<CoachCoacheeDetail> => {
  const response = await fetch(`/api/coach/coachees/${coacheeId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load coachee.";
    throw new Error(message);
  }

  const parsed = coachCoacheeDetailResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid coachee response");
  }

  return parsed.data;
};

export const createCoachCoacheeOverride = async (
  accessToken: string,
  coacheeId: string,
  payload: CoachCoacheeOverridePayload
): Promise<CoachCoacheeOverride> => {
  const parsedPayload = coachIntakeTargetsUpsertSchema
    .pick({ carbsPerHour: true, waterMlPerHour: true, sodiumMgPerHour: true })
    .safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Invalid intake targets payload");
  }

  const response = await fetch(`/api/coach/coachees/${coacheeId}/intake-targets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload.data),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to save intake targets.";
    throw new Error(message);
  }

  const parsed = coachCoacheeOverrideResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid intake targets response");
  }

  return parsed.data.override;
};

export const disableCoachCoachee = async (accessToken: string, coacheeId: string): Promise<string> => {
  const response = await fetch(`/api/coach/coachees/${coacheeId}/remove`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to update coachee.";
    throw new Error(message);
  }

  const parsed = coachCoacheeStatusResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid coachee status response");
  }

  return parsed.data.status;
};
