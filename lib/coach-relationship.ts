import { z } from "zod";

export const coachRelationshipResponseSchema = z.object({
  status: z.enum(["pending", "active"]).nullable(),
});

export type CoachRelationshipStatus = z.infer<typeof coachRelationshipResponseSchema>["status"];
