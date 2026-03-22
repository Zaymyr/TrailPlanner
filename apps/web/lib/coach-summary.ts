import { z } from "zod";

export const coachSummarySchema = z.object({
  isCoach: z.boolean(),
  planName: z.string().nullable(),
  inviteCount: z.number().int().nonnegative(),
  inviteLimit: z.number().int().nonnegative().nullable(),
});

export const coachSummaryResponseSchema = z.object({
  summary: coachSummarySchema,
});

export type CoachSummary = z.infer<typeof coachSummarySchema>;
