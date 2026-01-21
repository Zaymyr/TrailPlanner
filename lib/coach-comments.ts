import { z } from "zod";

export const coachCommentSchema = z.object({
  id: z.string().uuid(),
  coachId: z.string().uuid(),
  coacheeId: z.string().uuid(),
  planId: z.string().uuid(),
  sectionId: z.string().nullable(),
  aidStationId: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CoachComment = z.infer<typeof coachCommentSchema>;

export const coachCommentsResponseSchema = z.object({
  comments: z.array(coachCommentSchema),
});

export const coachCommentResponseSchema = z.object({
  comment: coachCommentSchema,
});

export const coachCommentCreateSchema = z
  .object({
    coacheeId: z.string().uuid(),
    planId: z.string().uuid(),
    sectionId: z.string().trim().min(1).nullable().optional(),
    aidStationId: z.string().trim().min(1).nullable().optional(),
    body: z.string().trim().min(1),
  })
  .refine((value) => Boolean(value.sectionId || value.aidStationId), {
    message: "Comment must include a section or aid station.",
  });

export const coachCommentUpdateSchema = z
  .object({
    id: z.string().uuid(),
    coacheeId: z.string().uuid(),
    planId: z.string().uuid(),
    sectionId: z.string().trim().min(1).nullable().optional(),
    aidStationId: z.string().trim().min(1).nullable().optional(),
    body: z.string().trim().min(1),
  })
  .refine((value) => Boolean(value.sectionId || value.aidStationId), {
    message: "Comment must include a section or aid station.",
  });

export const coachCommentDeleteSchema = z.object({
  id: z.string().uuid(),
  coacheeId: z.string().uuid(),
  planId: z.string().uuid(),
});

export type CoachCommentCreate = z.infer<typeof coachCommentCreateSchema>;
export type CoachCommentUpdate = z.infer<typeof coachCommentUpdateSchema>;
export type CoachCommentDelete = z.infer<typeof coachCommentDeleteSchema>;
