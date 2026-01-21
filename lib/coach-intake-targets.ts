import { z } from "zod";

export const coachIntakeTargetsSchema = z.object({
  carbsPerHour: z.number().nullable(),
  waterMlPerHour: z.number().nullable(),
  sodiumMgPerHour: z.number().nullable(),
});

export type CoachIntakeTargets = z.infer<typeof coachIntakeTargetsSchema>;

export const coachIntakeTargetsResponseSchema = z.object({
  targets: coachIntakeTargetsSchema.nullable(),
});
