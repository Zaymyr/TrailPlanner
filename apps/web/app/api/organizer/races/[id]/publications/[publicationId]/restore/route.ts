import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../../../lib/http";
import { jsonError, loadRaceForOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../../../../../lib/organizer";
import { invalidateRacebookCache } from "../../../../../../../../lib/racebook-cache";
import {
  loadRacebookPublicationState,
  loadRacebookPublication,
  racebookPublicationResultSchema,
  serializePublicationState,
} from "../../../../../../../../lib/racebook-publications";

const paramsSchema = z.object({ id: z.string().uuid(), publicationId: z.string().uuid() });

export async function POST(request: NextRequest, context: { params: { id?: string; publicationId?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return jsonError("Invalid publication id.", 400);
  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, params.data.id);
  if ("error" in race) return race.error;

  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/restore_racebook_publication`, {
    method: "POST",
    headers: serviceHeaders(auth.serviceConfig),
    body: JSON.stringify({
      p_race_id: race.id,
      p_publication_id: params.data.publicationId,
      p_actor_id: auth.user.id,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const status = response.status === 404 || response.status === 409 ? response.status : 502;
    return jsonError(status === 404 ? "Publication introuvable." : "Impossible de restaurer cette publication.", status);
  }
  const result = racebookPublicationResultSchema.parse(await response.json());
  const publication = await loadRacebookPublication(auth.serviceConfig, race.id, result.publicationId);
  if (!publication) return jsonError("Publication introuvable.", 404);
  const state = await loadRacebookPublicationState(auth.serviceConfig, race.id);
  if (!state) return jsonError("Publication state not found.", 502);
  await invalidateRacebookCache({ raceId: race.id, editionId: race.edition_id, eventId: race.event_id });
  return withSecurityHeaders(NextResponse.json({
    state: serializePublicationState(state, publication),
    publication: {
      id: publication.id,
      version: publication.version,
      publishedAt: publication.published_at,
      publishedBy: publication.published_by,
      restoredFromPublicationId: publication.restored_from_publication_id ?? null,
    },
  }));
}
