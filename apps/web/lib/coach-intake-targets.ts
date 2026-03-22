import { z } from "zod";

export const coachIntakeTargetsSchema = z.object({
  carbsPerHour: z.number().nullable(),
  waterMlPerHour: z.number().nullable(),
  sodiumMgPerHour: z.number().nullable(),
});

export type CoachIntakeTargets = z.infer<typeof coachIntakeTargetsSchema>;

export const coachIntakeTargetsUpsertSchema = z.object({
  coacheeId: z.string().uuid(),
  carbsPerHour: z.number().min(0).nullable(),
  waterMlPerHour: z.number().min(0).nullable(),
  sodiumMgPerHour: z.number().min(0).nullable(),
});

export type CoachIntakeTargetsUpsert = z.infer<typeof coachIntakeTargetsUpsertSchema>;

export const coachIntakeTargetsResponseSchema = z.object({
  targets: coachIntakeTargetsSchema.nullable(),
});
