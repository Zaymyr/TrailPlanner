import { z } from "zod";

import {
  coachInviteActionResponseSchema,
  coachInviteCreateSchema,
  coachInviteResponseSchema,
  type CoachInviteActionResponse,
  type CoachInviteCreate,
} from "./coach-invites";

export const createCoachInvite = async (
  accessToken: string,
  payload: CoachInviteCreate
): Promise<{ status: "pending" | "active" }> => {
  const parsedPayload = coachInviteCreateSchema.parse(payload);
  const response = await fetch("/api/coach/invite", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to send invite.";
    throw new Error(message);
  }

  const parsed = coachInviteResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid invite response");
  }

  return parsed.data;
};

export const resendCoachInvite = async (
  accessToken: string,
  inviteId: string
): Promise<CoachInviteActionResponse> => {
  const parsedInviteId = z.string().uuid().parse(inviteId);
  const response = await fetch(`/api/coach/invites/${parsedInviteId}/resend`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to resend invite.";
    throw new Error(message);
  }

  const parsed = coachInviteActionResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid resend response");
  }

  return parsed.data;
};

export const cancelCoachInvite = async (
  accessToken: string,
  inviteId: string
): Promise<CoachInviteActionResponse> => {
  const parsedInviteId = z.string().uuid().parse(inviteId);
  const response = await fetch(`/api/coach/invites/${parsedInviteId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? "Unable to cancel invite.";
    throw new Error(message);
  }

  const parsed = coachInviteActionResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid cancel response");
  }

  return parsed.data;
};
