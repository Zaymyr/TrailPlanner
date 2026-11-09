import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { loadOrganizerFeatureCatalog, organizerFeatureCatalogRowSchema } from "../../../../lib/organizer-manual-invoices";
import { organizerFeatureKeySchema } from "../../../../lib/organizer-features";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

const updateSchema = z.object({
  featureKey: organizerFeatureKeySchema,
  unitPriceCents: z.number().int().nonnegative().max(1_000_000),
  isActive: z.boolean(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  try {
    return withSecurityHeaders(NextResponse.json({ features: await loadOrganizerFeatureCatalog(auth.serviceConfig) }));
  } catch (error) {
    console.error("Unable to load organizer feature prices", error);
    return jsonError("Impossible de charger les tarifs des options.", 502);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Tarif invalide.", 400);
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/update_admin_organizer_feature_catalog`, {
    method: "POST",
    headers: serviceHeaders(auth.serviceConfig),
    body: JSON.stringify({ p_admin_id: auth.user.id, p_feature_key: body.data.featureKey, p_unit_price_cents: body.data.unitPriceCents, p_is_active: body.data.isActive }),
    cache: "no-store",
  });
  if (!response.ok) return jsonError("Impossible de modifier ce tarif.", 502);
  return withSecurityHeaders(NextResponse.json({ feature: organizerFeatureCatalogRowSchema.parse(await response.json()) }));
}
