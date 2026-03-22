import { z } from "zod";

const coachTierInfoSchema = z.object({
  name: z.string(),
  inviteLimit: z.number().int().nonnegative(),
});

const coachDashboardCoacheeSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  fullName: z.string().nullable(),
  invitedEmail: z.string().email().nullable(),
  createdAt: z.string(),
});

const coachDashboardInviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  status: z.string(),
  createdAt: z.string(),
  acceptedAt: z.string().nullable(),
  inviteeUserId: z.string().uuid().nullable(),
});

export const coachDashboardResponseSchema = z.object({
  dashboard: z.object({
    tier: coachTierInfoSchema.nullable(),
    invitesUsed: z.number().int().nonnegative(),
    seatsRemaining: z.number().int().nonnegative().nullable(),
    coachees: z.array(coachDashboardCoacheeSchema),
    invites: z.array(coachDashboardInviteSchema),
  }),
});

export type CoachDashboard = z.infer<typeof coachDashboardResponseSchema>["dashboard"];
export type CoachDashboardCoachee = z.infer<typeof coachDashboardResponseSchema>["dashboard"]["coachees"][number];
export type CoachDashboardInvite = z.infer<typeof coachDashboardResponseSchema>["dashboard"]["invites"][number];
