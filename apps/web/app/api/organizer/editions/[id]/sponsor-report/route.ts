import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  loadOrganizerEditionCapabilityGrants,
  loadOrganizerEditionEntitlement,
  resolveOrganizerCapabilityAccess,
} from "../../../../../../lib/organizer-entitlements";
import {
  buildSponsorReport,
  buildSponsorReportCampaignWindow,
  buildSponsorReportCsv,
  sponsorReportFileName,
  type SponsorReportReaders,
} from "../../../../../../lib/organizer-sponsor-report";
import { generateSponsorReportPdf } from "../../../../../../lib/organizer-sponsor-report-document";
import { canEnableOrganizerModule } from "../../../../../../lib/organizer-module-settings";
import { loadPostHogOrganizerAnalytics } from "../../../../../../lib/posthog-organizer-analytics";
import { racebookPartnerSlotRowSchema } from "../../../../../../lib/racebook-partner-slots";
import { racebookSponsorRowSchema } from "../../../../../../lib/racebook-sponsors";
import {
  jsonError,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";

const formatSchema = z.enum(["json", "csv", "pdf"]).default("json");

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_year: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  race_events: z.object({ name: z.string() }).nullable().optional(),
});

const SPONSOR_SELECT =
  "id,edition_id,name,logo_url,website_url,is_active,show_on_loading,show_in_banner,position,click_count,impression_count,partnership_level,category,contextual_placement,created_at";

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid edition id.", 400);
  const format = formatSchema.safeParse(request.nextUrl.searchParams.get("format") ?? undefined);
  if (!format.success) return jsonError("Invalid report format.", 400);

  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceConfig } = auth;
  const get = (path: string) => fetch(`${serviceConfig.supabaseUrl}/rest/v1/${path}`, {
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  });

  const editionResponse = await get(
    `race_event_editions?id=eq.${encodeURIComponent(parsedParams.data.id)}&select=id,event_id,edition_year,start_date,end_date,race_events(name)&limit=1`,
  );
  if (!editionResponse.ok) {
    console.error("Unable to load sponsor report edition", await editionResponse.text());
    return jsonError("Unable to load edition.", 502);
  }
  const editionResult = z.array(editionSchema).safeParse(await editionResponse.json().catch(() => null));
  if (!editionResult.success) return jsonError("Unable to load edition.", 502);
  const edition = editionResult.data[0] ?? null;
  if (!edition) return jsonError("Edition not found.", 404);

  // Active event membership (or trusted admin) first, then the edition offer:
  // like the Statistics route, admins bypass membership but not the entitlement.
  const organizer = await requireEventOrganizer(serviceConfig, auth.user, edition.event_id);
  if (organizer !== true) return organizer.error;

  try {
    const [entitlement, grantsByEdition] = await Promise.all([
      loadOrganizerEditionEntitlement(serviceConfig, edition.id),
      loadOrganizerEditionCapabilityGrants(serviceConfig, [edition.id]),
    ]);
    const grants = grantsByEdition[edition.id] ?? [];
    const activeGrantKeys = grants.filter((grant) => grant.status === "active").map((grant) => grant.capabilityKey);
    // Same gate as the sponsors module itself: effective Signature tier, or the
    // exact complimentary module.sponsors grant.
    if (!canEnableOrganizerModule(entitlement, "sponsors", activeGrantKeys)) return jsonError("Le rapport partenaires est inclus dans l’offre Signature.", 403);
    const analyticsAccess = resolveOrganizerCapabilityAccess(entitlement, grants, "racebook_analytics.view");

    const [sponsorsResponse, slotsResponse, racesResponse, publicationResponse] = await Promise.all([
      get(`race_event_edition_sponsors?edition_id=eq.${edition.id}&select=${SPONSOR_SELECT}&order=position.asc,created_at.asc`),
      get(`race_event_edition_partner_slots?edition_id=eq.${edition.id}&select=edition_id,slot_key,mode,sponsor_id,headline,impression_count,click_count`),
      get(`races?edition_id=eq.${edition.id}&select=id&order=id.asc`),
      get(`racebook_publications?edition_id=eq.${edition.id}&select=published_at&order=published_at.asc&limit=1`),
    ]);
    for (const response of [sponsorsResponse, slotsResponse, racesResponse, publicationResponse]) {
      if (!response.ok) {
        console.error("Unable to load sponsor report data", await response.text());
        return jsonError("Unable to load the partner report.", 502);
      }
    }

    const sponsors = z.array(racebookSponsorRowSchema).parse(await sponsorsResponse.json());
    const partnerSlots = z.array(racebookPartnerSlotRowSchema).parse(await slotsResponse.json());
    const raceIds = z.array(z.object({ id: z.string().uuid() })).parse(await racesResponse.json()).map((race) => race.id);
    const firstPublication = z.array(z.object({ published_at: z.string() })).parse(await publicationResponse.json())[0];
    const firstSponsorCreatedAt = sponsors
      .map((sponsor) => sponsor.created_at)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null;

    const campaign = buildSponsorReportCampaignWindow({
      firstPublishedAt: firstPublication?.published_at ?? null,
      firstSponsorCreatedAt,
      editionStartDate: edition.start_date,
      editionEndDate: edition.end_date,
    });

    let readers: SponsorReportReaders = { status: "not_included" };
    if (analyticsAccess.allowed) {
      try {
        const analytics = await loadPostHogOrganizerAnalytics({
          eventId: edition.event_id,
          editionId: edition.id,
          editionStartDate: edition.start_date,
          editionEndDate: edition.end_date,
          raceIds,
          selectedRaceId: null,
          dateFrom: campaign.from,
          dateTo: campaign.to,
        });
        readers = { status: "available", ...analytics.summary };
      } catch (error) {
        // Reader figures are optional in the report; sponsor counters still ship.
        console.error("Unable to load sponsor report reader analytics", error);
        readers = { status: "unavailable" };
      }
    }

    const report = buildSponsorReport({
      eventName: edition.race_events?.name ?? "Événement",
      editionYear: edition.edition_year,
      editionStartDate: edition.start_date,
      editionEndDate: edition.end_date,
      formatCount: raceIds.length,
      campaign,
      readers,
      sponsors,
      partnerSlots,
    });

    if (format.data === "csv") {
      return withSecurityHeaders(new NextResponse(buildSponsorReportCsv(report), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sponsorReportFileName(report, "csv")}"`,
          "Cache-Control": "private, no-store",
        },
      }));
    }
    if (format.data === "pdf") {
      const pdf = await generateSponsorReportPdf(report);
      return withSecurityHeaders(new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${sponsorReportFileName(report, "pdf")}"`,
          "Cache-Control": "private, no-store",
        },
      }));
    }
    const response = NextResponse.json({ report });
    response.headers.set("Cache-Control", "private, no-store");
    return withSecurityHeaders(response);
  } catch (error) {
    console.error("Unable to build sponsor report", error);
    return jsonError("Unable to build the partner report.", 502);
  }
}
