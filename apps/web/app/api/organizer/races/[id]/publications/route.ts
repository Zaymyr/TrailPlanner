import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { loadOrganizerEditionEntitlement } from "../../../../../../lib/organizer-entitlements";
import { jsonError, loadRaceForOrganizer, requireOrganizerAuth, serviceHeaders, uuidParamSchema } from "../../../../../../lib/organizer";
import { validateOrganizerEventPublication } from "../../../../../../lib/organizer-publication";
import {
  loadCurrentRacebookPublication,
  publishRacebookSnapshot,
  racebookPublicationRowSchema,
  serializePublicationState,
} from "../../../../../../lib/racebook-publications";
import { invalidateRacebookCache } from "../../../../../../lib/racebook-cache";

const publishBodySchema = z.object({ makePublic: z.boolean().optional().default(false) });
const limitSchema = z.coerce.number().int().min(1).max(10).default(10);

const historyItem = (publication: z.infer<typeof racebookPublicationRowSchema>) => ({
  id: publication.id,
  version: publication.version,
  publishedAt: publication.published_at,
  publishedBy: publication.published_by,
  restoredFromPublicationId: publication.restored_from_publication_id ?? null,
});

async function authorize(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth;
  const params = uuidParamSchema.safeParse(context.params);
  if (!params.success) return { error: jsonError("Invalid race id.", 400) };
  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, params.data.id);
  if ("error" in race) return race;
  if (!race.edition_id) return { error: jsonError("Ce format n’est rattaché à aucune édition.", 409) };
  return { ...auth, race };
}

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await authorize(request, context);
  if ("error" in auth) return auth.error;
  const limit = limitSchema.safeParse(request.nextUrl.searchParams.get("limit") ?? 10);
  if (!limit.success) return jsonError("Invalid publication limit.", 400);

  try {
    const current = await loadCurrentRacebookPublication(auth.serviceConfig, auth.race.id);
    if (!current.state) return jsonError("Publication state not found.", 404);
    const response = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/racebook_publications?race_id=eq.${auth.race.id}&select=*&order=version.desc&limit=${limit.data}`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
    );
    if (!response.ok) return jsonError("Impossible de charger l’historique de publication.", 502);
    const publications = z.array(racebookPublicationRowSchema).parse(await response.json());
    return withSecurityHeaders(NextResponse.json({
      state: serializePublicationState(current.state, current.publication),
      publications: publications.map(historyItem),
    }));
  } catch (error) {
    console.error("Unable to load RaceBook publication history", error);
    return jsonError("Impossible de charger l’historique de publication.", 502);
  }
}

export async function POST(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await authorize(request, context);
  if ("error" in auth) return auth.error;
  const body = publishBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return jsonError("Invalid publication request.", 400);

  const readiness = await validateOrganizerEventPublication(auth.serviceConfig, auth.race.event_id!, auth.race.id);
  if (!readiness.ok) return jsonError(readiness.message, readiness.status);
  const entitlement = await loadOrganizerEditionEntitlement(auth.serviceConfig, auth.race.edition_id!);
  if (!entitlement || entitlement.status !== "active" || entitlement.tier === "visibility") {
    return jsonError("Une offre Livret coureur active est requise pour publier ce format.", 403);
  }

  try {
    const result = await publishRacebookSnapshot(auth.serviceConfig, auth.race.id, auth.user.id, body.data.makePublic);
    await invalidateRacebookCache({ raceId: auth.race.id, editionId: auth.race.edition_id, eventId: auth.race.event_id });
    return withSecurityHeaders(NextResponse.json({
      state: serializePublicationState(result.state, result.publication),
      publication: historyItem(result.publication),
      visibility: body.data.makePublic ? "public" : (auth.race.racebook_is_live ? "public" : "private"),
    }));
  } catch (error) {
    console.error("Unable to publish RaceBook snapshot", error);
    const status = typeof error === "object" && error && "status" in error && error.status === 409 ? 409 : 502;
    return jsonError(status === 409 ? "Le brouillon a changé pendant la publication. Réessaie." : "Impossible de publier ce Livret coureur.", status);
  }
}
