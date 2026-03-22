import { z } from "zod";

export const coachRelationshipResponseSchema = z.object({
  status: z.enum(["pending", "active"]).nullable(),
  coach: z
    .object({
      id: z.string(),
      fullName: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type CoachRelationshipStatus = z.infer<typeof coachRelationshipResponseSchema>["status"];
export type CoachRelationship = z.infer<typeof coachRelationshipResponseSchema>;
