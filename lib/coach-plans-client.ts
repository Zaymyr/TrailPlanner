import {
  coachPlanCreateSchema,
  coachPlanDeleteSchema,
  coachPlanResponseSchema,
  coachPlanUpdateSchema,
  coachPlansResponseSchema,
  type CoachPlan,
  type CoachPlanCreate,
  type CoachPlanDelete,
  type CoachPlanUpdate,
} from "./coach-plans";

export const fetchCoachPlans = async (accessToken: string, coacheeId: string): Promise<CoachPlan[]> => {
  const response = await fetch(`/api/coach/plans?coacheeId=${encodeURIComponent(coacheeId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load coachee plans.";
    throw new Error(message);
  }

  const parsed = coachPlansResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid coach plans response");
  }

  return parsed.data.plans;
};

export const createCoachPlan = async (accessToken: string, payload: CoachPlanCreate): Promise<CoachPlan> => {
  const parsedPayload = coachPlanCreateSchema.parse(payload);
  const response = await fetch("/api/coach/plans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to create coachee plan.";
    throw new Error(message);
  }

  const parsed = coachPlanResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid coach plan response");
  }

  return parsed.data.plan;
};

export const updateCoachPlan = async (accessToken: string, payload: CoachPlanUpdate): Promise<CoachPlan> => {
  const parsedPayload = coachPlanUpdateSchema.parse(payload);
  const response = await fetch("/api/coach/plans", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to update coachee plan.";
    throw new Error(message);
  }

  const parsed = coachPlanResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid coach plan response");
  }

  return parsed.data.plan;
};

export const deleteCoachPlan = async (accessToken: string, payload: CoachPlanDelete): Promise<void> => {
  const parsedPayload = coachPlanDeleteSchema.parse(payload);
  const response = await fetch("/api/coach/plans", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to delete coachee plan.";
    throw new Error(message);
  }
};
