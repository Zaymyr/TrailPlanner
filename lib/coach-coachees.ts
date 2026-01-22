import { z } from "zod";

const coachCoacheeSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  fullName: z.string().nullable(),
  age: z.number().nullable(),
  invitedEmail: z.string().email().nullable(),
  createdAt: z.string(),
});

export const coachCoacheesResponseSchema = z.object({
  coachees: z.array(coachCoacheeSchema),
});

export type CoachCoachee = z.infer<typeof coachCoacheesResponseSchema>["coachees"][number];
