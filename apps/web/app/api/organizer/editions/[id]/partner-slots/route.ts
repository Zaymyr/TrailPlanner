import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  jsonError,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";
import { loadOrganizerEditionEntitlement } from "../../../../../../lib/organizer-entitlements";
import { isOrganizerEditionModuleSelected } from "../../../../../../lib/organizer-module-settings";
import { isOrganizerModuleAvailable } from "../../../../../../lib/organizer-modules";
import {
  racebookPartnerSlotRowSchema,
  racebookPartnerSlotUpdateSchema,
  toOrganizerPartnerSlots,
} from "../../../../../../lib/racebook-partner-slots";

const editionSchema = z.object({ id: z.string().uuid(), event_id: z.string().uuid() });
const slotSelect = "edition_id,slot_key,mode,sponsor_id,headline,impression_count,click_count";

async function loadAuthorizedEdition(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth;
  const params = uuidParamSchema.safeParse(context.params);
  if (!params.success) return { error: jsonError("Invalid edition id.", 400) };

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${params.data.id}&select=id,event_id&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!response.ok) return { error: jsonError("Unable to load edition.", 502) };
  const edition = z.array(editionSchema).parse(await response.json())[0] ?? null;
  if (!edition) return { error: jsonError("Edition not found.", 404) };

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, edition.event_id);
  if (organizer !== true) return organizer;
  // Same draft rule as sponsors: editing needs the selected module; runner
  // visibility additionally needs Signature at publication time.
  if (!(await isOrganizerEditionModuleSelected(auth.serviceConfig, edition.id, "sponsors"))) {
    return { error: jsonError("Activez la section Sponsors pour configurer les emplacements partenaires.", 403) };
  }
  return { ...auth, edition };
}

async function loadSlotsResponse(serviceConfig: Parameters<typeof serviceHeaders>[0], editionId: string) {
  const [slotsResponse, entitlement] = await Promise.all([
    fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/race_event_edition_partner_slots?edition_id=eq.${editionId}&select=${slotSelect}`,
      { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
    ),
    loadOrganizerEditionEntitlement(serviceConfig, editionId),
  ]);
  if (!slotsResponse.ok) throw new Error(await slotsResponse.text());
  const rows = z.array(racebookPartnerSlotRowSchema).parse(await slotsResponse.json());
  const tier = entitlement?.status === "active" ? entitlement.tier : "visibility";
  return {
    slots: toOrganizerPartnerSlots(rows),
    partnersOptionAvailable: isOrganizerModuleAvailable(tier, "sponsors"),
  };
}

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await loadAuthorizedEdition(request, context);
  if ("error" in auth) return auth.error;
  try {
    return withSecurityHeaders(NextResponse.json(await loadSlotsResponse(auth.serviceConfig, auth.edition.id)));
  } catch (error) {
    console.error("Unable to load partner slots", error);
    return jsonError("Impossible de charger les emplacements partenaires.", 502);
  }
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await loadAuthorizedEdition(request, context);
  if ("error" in auth) return auth.error;
  const input = racebookPartnerSlotUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError("Emplacement partenaire invalide.", 400);
  const headers = serviceHeaders(auth.serviceConfig);

  try {
    if (input.data.mode === "affiliate") {
      // The default presentation is the absence of a row.
      const response = await fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_partner_slots?edition_id=eq.${auth.edition.id}&slot_key=eq.${input.data.slot}`,
        { method: "DELETE", headers, cache: "no-store" },
      );
      if (!response.ok) throw new Error(await response.text());
    } else {
      if (input.data.mode === "partner") {
        const sponsorResponse = await fetch(
          `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_sponsors?id=eq.${input.data.sponsorId}&edition_id=eq.${auth.edition.id}&select=id&limit=1`,
          { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
        );
        if (!sponsorResponse.ok) throw new Error(await sponsorResponse.text());
        if ((z.array(z.unknown()).parse(await sponsorResponse.json())).length === 0) {
          return jsonError("Ce partenaire n’appartient pas à cette édition.", 400);
        }
      }
      const response = await fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_partner_slots?on_conflict=edition_id,slot_key`,
        {
          method: "POST",
          headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            edition_id: auth.edition.id,
            slot_key: input.data.slot,
            mode: input.data.mode,
            sponsor_id: input.data.mode === "partner" ? input.data.sponsorId : null,
            headline: input.data.mode === "partner" ? input.data.headline : null,
          }),
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error(await response.text());
    }
    return withSecurityHeaders(NextResponse.json(await loadSlotsResponse(auth.serviceConfig, auth.edition.id)));
  } catch (error) {
    console.error("Unable to save partner slot", error);
    return jsonError("Impossible d’enregistrer cet emplacement partenaire.", 502);
  }
}
