import { z } from "zod";

import { coachIntakeTargetsSchema } from "./coach-intake-targets";

export const coachCoacheeProfileSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  fullName: z.string().nullable(),
  age: z.number().nullable(),
  waterBagLiters: z.number().nullable(),
  invitedEmail: z.string().email().nullable(),
});

export const coachCoacheeOverrideSchema = coachIntakeTargetsSchema.extend({
  createdAt: z.string(),
});

export const coachCoacheeDetailResponseSchema = z.object({
  coachee: coachCoacheeProfileSchema,
  latestOverride: coachCoacheeOverrideSchema.nullable(),
});

export const coachCoacheeOverrideResponseSchema = z.object({
  override: coachCoacheeOverrideSchema,
});

export const coachCoacheeStatusResponseSchema = z.object({
  status: z.string(),
});

export type CoachCoacheeDetail = z.infer<typeof coachCoacheeDetailResponseSchema>;
export type CoachCoacheeOverride = z.infer<typeof coachCoacheeOverrideSchema>;
export type CoachCoacheeOverrideResponse = z.infer<typeof coachCoacheeOverrideResponseSchema>;
export type CoachCoacheeStatusResponse = z.infer<typeof coachCoacheeStatusResponseSchema>;
