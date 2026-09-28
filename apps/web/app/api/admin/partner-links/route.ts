import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  partnerLinkSettingsResponseSchema,
  partnerLinkSettingsUpdateSchema,
} from "../../../../lib/partner-links";
import { requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

const rowSchema = z.object({
  partner_key: z.enum(["booking", "decathlon"]),
  standard_url: z.string().url(),
  affiliate_url: z.string().url().nullable(),
  affiliate_enabled: z.boolean(),
  is_enabled: z.boolean(),
  updated_at: z.string(),
});

function mapRows(rows: z.infer<typeof rowSchema>[]) {
  const byKey = new Map(rows.map((row) => [row.partner_key, row]));
  return (["booking", "decathlon"] as const).map((partnerKey) => {
    const row = byKey.get(partnerKey);
    if (!row) throw new Error(`Missing ${partnerKey} partner-link setting.`);
    return {
      partnerKey,
      standardUrl: row.standard_url,
      affiliateUrl: row.affiliate_url,
      affiliateEnabled: row.affiliate_enabled,
      isEnabled: row.is_enabled,
      updatedAt: row.updated_at,
    };
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const response = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/partner_link_settings?select=partner_key,standard_url,affiliate_url,affiliate_enabled,is_enabled,updated_at&order=partner_key.asc`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    );

    if (!response.ok) {
      console.error("Unable to load partner-link settings", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load partner links." }, { status: 502 }));
    }

    const rows = z.array(rowSchema).parse(await response.json());
    return withSecurityHeaders(NextResponse.json(partnerLinkSettingsResponseSchema.parse({ settings: mapRows(rows) })));
  } catch (error) {
    console.error("Unexpected error while loading partner-link settings", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load partner links." }, { status: 500 }));
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const parsedBody = partnerLinkSettingsUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json(
      { message: parsedBody.error.issues[0]?.message ?? "Invalid partner-link settings." },
      { status: 400 }
    ));
  }

  const updatedAt = new Date().toISOString();
  const rows = parsedBody.data.settings.map((setting) => ({
    partner_key: setting.partnerKey,
    standard_url: setting.standardUrl,
    affiliate_url: setting.affiliateUrl,
    affiliate_enabled: setting.affiliateEnabled,
    is_enabled: setting.isEnabled,
    updated_at: updatedAt,
    updated_by: auth.user.id,
  }));

  try {
    const response = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/partner_link_settings?on_conflict=partner_key`,
      {
        method: "POST",
        headers: {
          ...serviceHeaders(auth.serviceConfig),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(rows),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to save partner-link settings", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to save partner links." }, { status: 502 }));
    }

    const savedRows = z.array(rowSchema).parse(await response.json());
    return withSecurityHeaders(NextResponse.json(partnerLinkSettingsResponseSchema.parse({ settings: mapRows(savedRows) })));
  } catch (error) {
    console.error("Unexpected error while saving partner-link settings", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to save partner links." }, { status: 500 }));
  }
}
