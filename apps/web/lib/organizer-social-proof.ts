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
  logoUrl: z.string().nullable(),
  logoSource: z.enum(["racebook", "event"]).nullable(),
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

/**
 * PostgREST embed of `race_event_edition_branding` from `race_event_editions`.
 * `edition_id` is the branding primary key, so it is normally an object or null;
 * an array is accepted defensively.
 */
const brandingLogoRowSchema = z.object({ published_logo_url: z.string().nullable() });
export const organizerSocialProofBrandingEmbedSchema = z
  .union([brandingLogoRowSchema, z.array(brandingLogoRowSchema)])
  .nullable()
  .optional();

/**
 * The proof logo is taken from the organizer space, never uploaded separately:
 * the published Livret coureur logo first, then the event image the organizer set.
 */
export function resolveOrganizerSocialProofLogo(
  branding: z.infer<typeof organizerSocialProofBrandingEmbedSchema>,
  eventThumbnailUrl: string | null,
): Pick<OrganizerSocialProof, "logoUrl" | "logoSource"> {
  const brandingRow = Array.isArray(branding) ? branding[0] : branding;
  if (brandingRow?.published_logo_url) return { logoUrl: brandingRow.published_logo_url, logoSource: "racebook" };
  if (eventThumbnailUrl) return { logoUrl: eventThumbnailUrl, logoSource: "event" };
  return { logoUrl: null, logoSource: null };
}

export const organizerSocialProofEditionSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  eventName: z.string().min(1),
  editionYear: z.number().int(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string().nullable(),
  logoUrl: z.string().nullable().default(null),
  logoSource: z.enum(["racebook", "event"]).nullable().default(null),
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

