import { z } from "zod";

export const coachCommentTargetTypeSchema = z.enum(["plan", "section", "aid-station"]);

export const coachCommentSchema = z.object({
  id: z.string().uuid(),
  coachId: z.string().uuid(),
  coacheeId: z.string().uuid(),
  planId: z.string().uuid(),
  targetType: coachCommentTargetTypeSchema,
  targetId: z.string().trim().min(1),
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

export const coachCommentCreateSchema = z.object({
  coacheeId: z.string().uuid(),
  planId: z.string().uuid(),
  targetType: coachCommentTargetTypeSchema,
  targetId: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

export const coachCommentUpdateSchema = z.object({
  id: z.string().uuid(),
  coacheeId: z.string().uuid(),
  planId: z.string().uuid(),
  targetType: coachCommentTargetTypeSchema,
  targetId: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

export const coachCommentDeleteSchema = z.object({
  id: z.string().uuid(),
  coacheeId: z.string().uuid(),
  planId: z.string().uuid(),
});

export type CoachCommentCreate = z.infer<typeof coachCommentCreateSchema>;
export type CoachCommentUpdate = z.infer<typeof coachCommentUpdateSchema>;
export type CoachCommentDelete = z.infer<typeof coachCommentDeleteSchema>;
