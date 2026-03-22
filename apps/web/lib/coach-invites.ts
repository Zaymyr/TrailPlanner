import { z } from "zod";

export const coachInviteCreateSchema = z.object({
  email: z.string().trim().email(),
});

export const coachInviteResponseSchema = z.object({
  status: z.enum(["pending", "active"]),
});

export const coachInviteActionResponseSchema = z.object({
  status: z.enum(["pending", "canceled"]),
});

export const coachInviteUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
});

export const coachInviteUserListSchema = z.array(coachInviteUserSchema);

export const coachInviteUserEnvelopeSchema = z.object({
  users: coachInviteUserListSchema,
});

const coachInviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  status: z.string(),
  createdAt: z.string(),
  acceptedAt: z.string().nullable(),
  inviteeUserId: z.string().uuid().nullable(),
});

export const coachInvitesResponseSchema = z.object({
  invites: z.array(coachInviteSchema),
});

export type CoachInviteCreate = z.infer<typeof coachInviteCreateSchema>;
export type CoachInviteResponse = z.infer<typeof coachInviteResponseSchema>;
export type CoachInviteActionResponse = z.infer<typeof coachInviteActionResponseSchema>;
export type CoachInviteUser = z.infer<typeof coachInviteUserSchema>;
export type CoachInvite = z.infer<typeof coachInviteSchema>;
export type CoachInvitesResponse = z.infer<typeof coachInvitesResponseSchema>;
