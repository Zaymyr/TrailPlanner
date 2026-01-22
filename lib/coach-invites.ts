import { z } from "zod";

export const coachInviteCreateSchema = z.object({
  email: z.string().trim().email(),
});

export const coachInviteResponseSchema = z.object({
  status: z.enum(["pending", "active"]),
});

export type CoachInviteCreate = z.infer<typeof coachInviteCreateSchema>;
export type CoachInviteResponse = z.infer<typeof coachInviteResponseSchema>;
