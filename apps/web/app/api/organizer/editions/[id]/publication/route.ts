import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { loadOrganizerEditionEntitlement } from "../../../../../../lib/organizer-entitlements";
import {
  jsonError,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";
import { validateOrganizerEditionPublication } from "../../../../../../lib/organizer-publication";
import { invalidateRacebookCache } from "../../../../../../lib/racebook-cache";

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
});

const publishedRaceSchema = z.object({
  id: z.string().uuid(),
  racebook_is_live: z.literal(true),
  racebook_preview_is_visible: z.literal(true),
});

export async function POST(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid edition id.", 400);

  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${parsedParams.data.id}&select=id,event_id&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!editionResponse.ok) return jsonError("Impossible de vérifier cette édition.", 502);
  const edition = z.array(editionSchema).parse(await editionResponse.json())[0] ?? null;
  if (!edition) return jsonError("Édition introuvable.", 404);

  const membership = await requireEventOrganizer(auth.serviceConfig, auth.user, edition.event_id);
  if (membership !== true) return membership.error;

  const readiness = await validateOrganizerEditionPublication(
    auth.serviceConfig,
    edition.event_id,
    edition.id
  );
  if (!readiness.ok) return jsonError(readiness.message, readiness.status);

  const entitlement = await loadOrganizerEditionEntitlement(auth.serviceConfig, edition.id);
  if (!entitlement || entitlement.status !== "active" || entitlement.tier === "visibility") {
    return jsonError("Une offre RaceBook active est requise pour publier cette édition.", 403);
  }

  const publicationResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/publish_organizer_edition_racebooks`,
    {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({ p_edition_id: edition.id, p_actor_id: auth.user.id }),
      cache: "no-store",
    }
  );
  if (!publicationResponse.ok) {
    console.error("Unable to publish organizer edition RaceBooks", await publicationResponse.text());
    return jsonError("Impossible de publier les RaceBooks de cette édition.", 502);
  }

  const publishedRaces = z.array(publishedRaceSchema).parse(await publicationResponse.json());
  if (publishedRaces.length === 0) {
    return jsonError("Affiche au moins un format dans ta démo avant de publier.", 409);
  }

  await invalidateRacebookCache({ editionId: edition.id, eventId: edition.event_id });
  return withSecurityHeaders(NextResponse.json({
    publishedRaceIds: publishedRaces.map((race) => race.id),
  }));
}
