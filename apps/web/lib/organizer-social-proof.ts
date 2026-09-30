import { z } from "zod";

export const organizerSocialProofStatusSchema = z.enum(["draft", "published"]);

export const organizerSocialProofSchema = z.object({
  id: z.string().uuid(),
  editionId: z.string().uuid(),
  eventId: z.string().uuid(),
  eventName: z.string().min(1),
  editionYear: z.number().int(),
  location: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  status: organizerSocialProofStatusSchema,
  displayOrder: z.number().int().min(0).max(999),
  quoteText: z.string().nullable(),
  quoteAuthorName: z.string().nullable(),
  quoteAuthorRole: z.string().nullable(),
  consentConfirmedAt: z.string().nullable(),
  uniqueReaders: z.number().int().nonnegative(),
  totalOpens: z.number().int().nonnegative(),
  analyticsFrom: z.string().nullable(),
  analyticsTo: z.string().nullable(),
  analyticsCapturedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export type OrganizerSocialProof = z.infer<typeof organizerSocialProofSchema>;

export const organizerSocialProofEditionSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  eventName: z.string().min(1),
  editionYear: z.number().int(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string().nullable(),
});

export type OrganizerSocialProofEdition = z.infer<typeof organizerSocialProofEditionSchema>;

export const organizerSocialProofAdminResponseSchema = z.object({
  editions: z.array(organizerSocialProofEditionSchema),
  proofs: z.array(organizerSocialProofSchema),
});

const nullableTrimmedText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .transform((value) => (value && value.length > 0 ? value : null));

export const organizerSocialProofUpdateSchema = z
  .object({
    editionId: z.string().uuid(),
    status: organizerSocialProofStatusSchema,
    displayOrder: z.number().int().min(0).max(999),
    quoteText: nullableTrimmedText(1000),
    quoteAuthorName: nullableTrimmedText(160),
    quoteAuthorRole: nullableTrimmedText(160),
    consentConfirmed: z.boolean(),
    refreshStats: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (!value.quoteText && (value.quoteAuthorName || value.quoteAuthorRole)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quoteText"],
        message: "Un auteur ne peut pas être publié sans témoignage.",
      });
    }
    if (value.status === "published" && !value.consentConfirmed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consentConfirmed"],
        message: "Confirmez l’autorisation avant la publication.",
      });
    }
  });

export type OrganizerSocialProofUpdate = z.infer<typeof organizerSocialProofUpdateSchema>;

