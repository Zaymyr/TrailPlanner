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

export type CoachInviteCreate = z.infer<typeof coachInviteCreateSchema>;
export type CoachInviteResponse = z.infer<typeof coachInviteResponseSchema>;
export type CoachInviteActionResponse = z.infer<typeof coachInviteActionResponseSchema>;
