import "server-only";

import { z } from "zod";

import { getSupabaseServiceConfig } from "./supabase";
import { organizerSocialProofSchema, type OrganizerSocialProof } from "./organizer-social-proof";

const publicRowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  status: z.literal("published"),
  display_order: z.number().int(),
  quote_text: z.string().nullable(),
  quote_author_name: z.string().nullable(),
  quote_author_role: z.string().nullable(),
  consent_confirmed_at: z.string(),
  unique_readers: z.number().int().nonnegative(),
  total_opens: z.number().int().nonnegative(),
  analytics_from: z.string(),
  analytics_to: z.string(),
  analytics_captured_at: z.string(),
  published_at: z.string(),
  updated_at: z.string(),
  race_event_editions: z.object({
    edition_year: z.number().int(),
    race_events: z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      location: z.string().nullable(),
      thumbnail_url: z.string().nullable(),
    }),
  }),
});

const mapPublicRow = (row: z.infer<typeof publicRowSchema>): OrganizerSocialProof =>
  organizerSocialProofSchema.parse({
    id: row.id,
    editionId: row.edition_id,
    eventId: row.race_event_editions.race_events.id,
    eventName: row.race_event_editions.race_events.name,
    editionYear: row.race_event_editions.edition_year,
    location: row.race_event_editions.race_events.location,
    thumbnailUrl: row.race_event_editions.race_events.thumbnail_url,
    status: row.status,
    displayOrder: row.display_order,
    quoteText: row.quote_text,
    quoteAuthorName: row.quote_author_name,
    quoteAuthorRole: row.quote_author_role,
    consentConfirmedAt: row.consent_confirmed_at,
    uniqueReaders: row.unique_readers,
    totalOpens: row.total_opens,
    analyticsFrom: row.analytics_from,
    analyticsTo: row.analytics_to,
    analyticsCapturedAt: row.analytics_captured_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  });

export async function loadPublishedOrganizerSocialProofs(limit = 3): Promise<OrganizerSocialProof[]> {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return [];

  const boundedLimit = Math.max(1, Math.min(6, Math.floor(limit)));
  const select = [
    "id",
    "edition_id",
    "status",
    "display_order",
    "quote_text",
    "quote_author_name",
    "quote_author_role",
    "consent_confirmed_at",
    "unique_readers",
    "total_opens",
    "analytics_from",
    "analytics_to",
    "analytics_captured_at",
    "published_at",
    "updated_at",
    "race_event_editions!inner(edition_year,race_events!inner(id,name,location,thumbnail_url))",
  ].join(",");
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/organizer_social_proofs?status=eq.published&select=${encodeURIComponent(select)}&order=display_order.asc,published_at.desc&limit=${boundedLimit}`,
    {
      headers: {
        apikey: serviceConfig.supabaseServiceRoleKey,
        Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
      },
      next: { revalidate: 300, tags: ["organizer-social-proofs"] },
    },
  );

  if (!response.ok) {
    console.error("Unable to load organizer social proofs", await response.text());
    return [];
  }

  const rows = z.array(publicRowSchema).safeParse(await response.json().catch(() => null));
  if (!rows.success) {
    console.error("Unable to parse organizer social proofs", rows.error.flatten());
    return [];
  }

  return rows.data.map(mapPublicRow);
}

