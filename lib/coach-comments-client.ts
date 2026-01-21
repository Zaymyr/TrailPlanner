import {
  coachCommentCreateSchema,
  coachCommentDeleteSchema,
  coachCommentResponseSchema,
  coachCommentUpdateSchema,
  coachCommentsResponseSchema,
  type CoachComment,
  type CoachCommentCreate,
  type CoachCommentDelete,
  type CoachCommentUpdate,
} from "./coach-comments";

export const fetchCoachComments = async (accessToken: string, planId: string): Promise<CoachComment[]> => {
  const response = await fetch(`/api/coach/comments?planId=${encodeURIComponent(planId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load coach comments.";
    throw new Error(message);
  }

  const parsed = coachCommentsResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid coach comments response");
  }

  return parsed.data.comments;
};

export const createCoachComment = async (accessToken: string, payload: CoachCommentCreate): Promise<CoachComment> => {
  const parsedPayload = coachCommentCreateSchema.parse(payload);
  const response = await fetch("/api/coach/comments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to create coach comment.";
    throw new Error(message);
  }

  const parsed = coachCommentResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid coach comment response");
  }

  return parsed.data.comment;
};

export const updateCoachComment = async (accessToken: string, payload: CoachCommentUpdate): Promise<CoachComment> => {
  const parsedPayload = coachCommentUpdateSchema.parse(payload);
  const response = await fetch("/api/coach/comments", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to update coach comment.";
    throw new Error(message);
  }

  const parsed = coachCommentResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid coach comment response");
  }

  return parsed.data.comment;
};

export const deleteCoachComment = async (accessToken: string, payload: CoachCommentDelete): Promise<void> => {
  const parsedPayload = coachCommentDeleteSchema.parse(payload);
  const response = await fetch("/api/coach/comments", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to delete coach comment.";
    throw new Error(message);
  }
};
