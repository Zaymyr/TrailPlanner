import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";
import {
  organizerSocialProofAdminResponseSchema,
  organizerSocialProofSchema,
  organizerSocialProofUpdateSchema,
  type OrganizerSocialProof,
} from "../../../../lib/organizer-social-proof";
import { loadPostHogOrganizerAnalytics } from "../../../../lib/posthog-organizer-analytics";

const editionRowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_year: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  race_events: z.object({
    name: z.string().min(1),
    location: z.string().nullable(),
    thumbnail_url: z.string().nullable(),
  }),
});

const proofRowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  status: z.enum(["draft", "published"]),
  display_order: z.number().int(),
  quote_text: z.string().nullable(),
  quote_author_name: z.string().nullable(),
  quote_author_role: z.string().nullable(),
  consent_confirmed_at: z.string().nullable(),
  unique_readers: z.number().int().nonnegative(),
  total_opens: z.number().int().nonnegative(),
  analytics_from: z.string().nullable(),
  analytics_to: z.string().nullable(),
  analytics_captured_at: z.string().nullable(),
  published_at: z.string().nullable(),
  created_by: z.string().uuid().nullable().optional(),
  updated_at: z.string(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  racebook_publication_approved_at: z.string().nullable(),
});

type EditionRow = z.infer<typeof editionRowSchema>;
type ProofRow = z.infer<typeof proofRowSchema>;

const mapProof = (row: ProofRow, edition: EditionRow): OrganizerSocialProof =>
  organizerSocialProofSchema.parse({
    id: row.id,
    editionId: row.edition_id,
    eventId: edition.event_id,
    eventName: edition.race_events.name,
    editionYear: edition.edition_year,
    location: edition.race_events.location,
    thumbnailUrl: edition.race_events.thumbnail_url,
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

const addUtcDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

async function loadAdminData(serviceConfig: Parameters<typeof serviceHeaders>[0]) {
  const [editionsResponse, proofsResponse] = await Promise.all([
    fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/race_event_editions?select=id,event_id,edition_year,start_date,end_date,race_events!inner(name,location,thumbnail_url)&order=start_date.desc&limit=500`,
      { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
    ),
    fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/organizer_social_proofs?select=id,edition_id,status,display_order,quote_text,quote_author_name,quote_author_role,consent_confirmed_at,unique_readers,total_opens,analytics_from,analytics_to,analytics_captured_at,published_at,created_by,updated_at&order=display_order.asc,published_at.desc.nullslast`,
      { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
    ),
  ]);

  if (!editionsResponse.ok || !proofsResponse.ok) {
    console.error("Unable to load organizer social proof admin data", {
      editions: editionsResponse.status,
      proofs: proofsResponse.status,
    });
    throw new Error("Unable to load organizer social proofs.");
  }

  const editions = z.array(editionRowSchema).parse(await editionsResponse.json());
  const proofs = z.array(proofRowSchema).parse(await proofsResponse.json());
  const editionsById = new Map(editions.map((edition) => [edition.id, edition]));

  return organizerSocialProofAdminResponseSchema.parse({
    editions: editions.map((edition) => ({
      id: edition.id,
      eventId: edition.event_id,
      eventName: edition.race_events.name,
      editionYear: edition.edition_year,
      startDate: edition.start_date,
      endDate: edition.end_date,
      location: edition.race_events.location,
    })),
    proofs: proofs.flatMap((proof) => {
      const edition = editionsById.get(proof.edition_id);
      return edition ? [mapProof(proof, edition)] : [];
    }),
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  try {
    return withSecurityHeaders(NextResponse.json(await loadAdminData(auth.serviceConfig)));
  } catch (error) {
    console.error("Unable to load organizer social proofs", error);
    return withSecurityHeaders(NextResponse.json({ message: "Impossible de charger les preuves sociales." }, { status: 502 }));
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const parsedBody = organizerSocialProofUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json(
      { message: parsedBody.error.issues[0]?.message ?? "Preuve sociale invalide." },
      { status: 400 },
    ));
  }

  try {
    const [editionResponse, existingResponse, racesResponse] = await Promise.all([
      fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${parsedBody.data.editionId}&select=id,event_id,edition_year,start_date,end_date,race_events!inner(name,location,thumbnail_url)&limit=1`,
        { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
      ),
      fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_social_proofs?edition_id=eq.${parsedBody.data.editionId}&select=id,edition_id,status,display_order,quote_text,quote_author_name,quote_author_role,consent_confirmed_at,unique_readers,total_opens,analytics_from,analytics_to,analytics_captured_at,published_at,created_by,updated_at&limit=1`,
        { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
      ),
      fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/races?edition_id=eq.${parsedBody.data.editionId}&select=id,racebook_publication_approved_at&order=id.asc`,
        { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
      ),
    ]);

    if (!editionResponse.ok || !existingResponse.ok || !racesResponse.ok) {
      return withSecurityHeaders(NextResponse.json({ message: "Impossible de charger cette édition." }, { status: 502 }));
    }

    const edition = z.array(editionRowSchema).parse(await editionResponse.json())[0] ?? null;
    if (!edition) {
      return withSecurityHeaders(NextResponse.json({ message: "Édition introuvable." }, { status: 404 }));
    }
    const existing = z.array(proofRowSchema).parse(await existingResponse.json())[0] ?? null;
    const races = z.array(raceRowSchema).parse(await racesResponse.json());

    let uniqueReaders = existing?.unique_readers ?? 0;
    let totalOpens = existing?.total_opens ?? 0;
    let analyticsFrom = existing?.analytics_from ?? null;
    let analyticsTo = existing?.analytics_to ?? null;
    let analyticsCapturedAt = existing?.analytics_captured_at ?? null;
    const shouldRefreshStats = parsedBody.data.refreshStats
      || (parsedBody.data.status === "published" && !analyticsCapturedAt);

    if (shouldRefreshStats) {
      const firstPublication = races
        .map((race) => race.racebook_publication_approved_at)
        .filter((value): value is string => Boolean(value))
        .sort()[0];
      if (!firstPublication || races.length === 0) {
        return withSecurityHeaders(NextResponse.json(
          { message: "Aucun Livret coureur publié n’est disponible pour mesurer cette édition." },
          { status: 409 },
        ));
      }

      analyticsFrom = firstPublication.slice(0, 10);
      analyticsTo = [new Date().toISOString().slice(0, 10), addUtcDays(edition.end_date, 14)].sort()[0];
      if (analyticsTo < analyticsFrom) {
        return withSecurityHeaders(NextResponse.json(
          { message: "La période de mesure de cette édition n’a pas encore commencé." },
          { status: 409 },
        ));
      }

      const analytics = await loadPostHogOrganizerAnalytics({
        eventId: edition.event_id,
        editionId: edition.id,
        editionStartDate: edition.start_date,
        editionEndDate: edition.end_date,
        raceIds: races.map((race) => race.id),
        selectedRaceId: null,
        dateFrom: analyticsFrom,
        dateTo: analyticsTo,
      });
      uniqueReaders = analytics.summary.uniqueReaders;
      totalOpens = analytics.summary.totalOpens;
      analyticsCapturedAt = new Date().toISOString();
    }

    if (parsedBody.data.status === "published" && !analyticsCapturedAt) {
      return withSecurityHeaders(NextResponse.json(
        { message: "Actualisez les statistiques avant de publier cette preuve." },
        { status: 409 },
      ));
    }

    const now = new Date().toISOString();
    const row = {
      edition_id: edition.id,
      status: parsedBody.data.status,
      display_order: parsedBody.data.displayOrder,
      quote_text: parsedBody.data.quoteText,
      quote_author_name: parsedBody.data.quoteAuthorName,
      quote_author_role: parsedBody.data.quoteAuthorRole,
      consent_confirmed_at: parsedBody.data.consentConfirmed ? existing?.consent_confirmed_at ?? now : null,
      unique_readers: uniqueReaders,
      total_opens: totalOpens,
      analytics_from: analyticsFrom,
      analytics_to: analyticsTo,
      analytics_captured_at: analyticsCapturedAt,
      published_at: parsedBody.data.status === "published" ? existing?.published_at ?? now : null,
      updated_at: now,
      created_by: existing?.created_by ?? auth.user.id,
      updated_by: auth.user.id,
    };
    const saveResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_social_proofs?on_conflict=edition_id`,
      {
        method: "POST",
        headers: {
          ...serviceHeaders(auth.serviceConfig),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(row),
        cache: "no-store",
      },
    );

    if (!saveResponse.ok) {
      console.error("Unable to save organizer social proof", await saveResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Impossible d’enregistrer la preuve sociale." }, { status: 502 }));
    }

    const saved = z.array(proofRowSchema).parse(await saveResponse.json())[0];
    if (!saved) throw new Error("Organizer social proof upsert returned no row.");
    revalidateTag("organizer-social-proofs");
    return withSecurityHeaders(NextResponse.json({ proof: mapProof(saved, edition) }));
  } catch (error) {
    console.error("Unable to save organizer social proof", error);
    return withSecurityHeaders(NextResponse.json({ message: "Impossible d’enregistrer la preuve sociale." }, { status: 502 }));
  }
}

