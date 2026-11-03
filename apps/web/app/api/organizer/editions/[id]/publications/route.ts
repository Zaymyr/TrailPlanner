import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { loadOrganizerEditionEntitlement } from "../../../../../../lib/organizer-entitlements";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders, uuidParamSchema } from "../../../../../../lib/organizer";
import { validateOrganizerEditionPublication } from "../../../../../../lib/organizer-publication";
import { invalidateRacebookCache } from "../../../../../../lib/racebook-cache";
import {
  buildRacebookPublishedSnapshot,
  loadRacebookPublication,
  loadRacebookPublicationState,
  racebookPublicationResultSchema,
  serializePublicationState,
  toRacebookPublicationAssets,
} from "../../../../../../lib/racebook-publications";

const editionSchema = z.object({ id: z.string().uuid(), event_id: z.string().uuid() });
const stateSchema = z.object({ race_id: z.string().uuid(), draft_revision: z.coerce.number().int(), published_source_revision: z.coerce.number().int().nullable() });

export async function POST(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;
  const params = uuidParamSchema.safeParse(context.params);
  if (!params.success) return jsonError("Invalid edition id.", 400);

  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${params.data.id}&select=id,event_id&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!editionResponse.ok) return jsonError("Impossible de vérifier cette édition.", 502);
  const edition = z.array(editionSchema).parse(await editionResponse.json())[0] ?? null;
  if (!edition) return jsonError("Édition introuvable.", 404);
  const membership = await requireEventOrganizer(auth.serviceConfig, auth.user, edition.event_id);
  if (membership !== true) return membership.error;

  const [readiness, entitlement] = await Promise.all([
    validateOrganizerEditionPublication(auth.serviceConfig, edition.event_id, edition.id),
    loadOrganizerEditionEntitlement(auth.serviceConfig, edition.id),
  ]);
  if (!readiness.ok) return jsonError(readiness.message, readiness.status);
  if (!entitlement || entitlement.status !== "active" || entitlement.tier === "visibility") {
    return jsonError("Une offre Livret coureur active est requise pour publier cette édition.", 403);
  }

  const statesResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/racebook_publication_states?edition_id=eq.${edition.id}&select=race_id,draft_revision,published_source_revision`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!statesResponse.ok) return jsonError("Impossible de charger les brouillons de l’édition.", 502);
  const changed = z.array(stateSchema).parse(await statesResponse.json())
    .filter((state) => state.published_source_revision === null || state.draft_revision !== state.published_source_revision);
  if (changed.length === 0) {
    return withSecurityHeaders(NextResponse.json({ publishedRaceIds: [], states: [] }));
  }

  try {
    const built = await Promise.all(changed.map(async (state) => ({
      raceId: state.race_id,
      ...(await buildRacebookPublishedSnapshot(auth.serviceConfig, state.race_id)),
    })));
    const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/publish_racebook_snapshots`, {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({
        p_actor_id: auth.user.id,
        p_items: built.map((item) => ({
          raceId: item.raceId,
          expectedDraftRevision: item.draftRevision,
          schemaVersion: 1,
          content: item.snapshot,
          contentHash: item.hash,
          assets: toRacebookPublicationAssets(auth.serviceConfig, item.snapshot),
        })),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const status = response.status === 409 ? 409 : 502;
      return jsonError(status === 409 ? "Un brouillon a changé pendant la publication. Aucun format n’a été publié." : "Impossible de publier les Livrets coureurs.", status);
    }
    const results = z.array(racebookPublicationResultSchema).parse(await response.json());
    const publications = await Promise.all(results.map(async (result) => {
      if (!result.raceId) throw new Error("Bulk publication result is missing raceId.");
      const publication = await loadRacebookPublication(auth.serviceConfig, result.raceId, result.publicationId);
      if (!publication) throw new Error("Bulk publication could not be reloaded.");
      return publication;
    }));
    const states = await Promise.all(publications.map(async (publication) => {
      const state = await loadRacebookPublicationState(auth.serviceConfig, publication.race_id);
      if (!state) throw new Error("Publication state not found after bulk publication.");
      return { raceId: publication.race_id, ...serializePublicationState(state, publication) };
    }));
    await invalidateRacebookCache({ editionId: edition.id, eventId: edition.event_id });
    return withSecurityHeaders(NextResponse.json({
      publishedRaceIds: publications.map((publication) => publication.race_id),
      states,
    }));
  } catch (error) {
    console.error("Unable to publish edition RaceBook snapshots", error);
    return jsonError("Impossible de publier les Livrets coureurs.", 502);
  }
}
