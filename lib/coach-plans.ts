import { z } from "zod";

export const coachPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  updatedAt: z.string(),
  plannerValues: z.record(z.unknown()),
  elevationProfile: z.array(z.unknown()),
});

export type CoachPlan = z.infer<typeof coachPlanSchema>;

export const coachPlansResponseSchema = z.object({
  plans: z.array(coachPlanSchema),
});

export const coachPlanResponseSchema = z.object({
  plan: coachPlanSchema,
});

export const coachPlanCreateSchema = z.object({
  coacheeId: z.string().uuid(),
  name: z.string().trim().min(1),
  plannerValues: z.record(z.unknown()),
  elevationProfile: z.array(z.unknown()),
});

export const coachPlanUpdateSchema = coachPlanCreateSchema.extend({
  id: z.string().uuid(),
});

export const coachPlanDeleteSchema = z.object({
  coacheeId: z.string().uuid(),
  id: z.string().uuid(),
});

export type CoachPlanCreate = z.infer<typeof coachPlanCreateSchema>;
export type CoachPlanUpdate = z.infer<typeof coachPlanUpdateSchema>;
export type CoachPlanDelete = z.infer<typeof coachPlanDeleteSchema>;
