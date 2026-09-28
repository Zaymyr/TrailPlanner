import { NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import { serviceHeaders } from "../../../lib/organizer";
import {
  partnerLinkSettingSchema,
  resolvePublicPartnerLink,
  type ResolvedPartnerLink,
} from "../../../lib/partner-links";
import { getSupabaseServiceConfig } from "../../../lib/supabase";

const partnerLinkRowSchema = z.object({
  partner_key: z.enum(["booking", "decathlon"]),
  standard_url: z.string(),
  affiliate_url: z.string().nullable(),
  affiliate_enabled: z.boolean(),
  is_enabled: z.boolean(),
  updated_at: z.string(),
});

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

export async function GET() {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return jsonError("Supabase configuration is missing.", 500);

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/partner_link_settings?is_enabled=eq.true&select=partner_key,standard_url,affiliate_url,affiliate_enabled,is_enabled,updated_at&order=partner_key.asc`,
      { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
    );
    if (!response.ok) return jsonError("Unable to load partner links.", 502);

    const rows = z.array(partnerLinkRowSchema).parse(await response.json());
    const links = rows.reduce<ResolvedPartnerLink[]>((resolved, row) => {
      const setting = partnerLinkSettingSchema.parse({
        partnerKey: row.partner_key,
        standardUrl: row.standard_url,
        affiliateUrl: row.affiliate_url,
        affiliateEnabled: row.affiliate_enabled,
        isEnabled: row.is_enabled,
        updatedAt: row.updated_at,
      });
      const link = resolvePublicPartnerLink(setting);
      if (link) resolved.push(link);
      return resolved;
    }, []);

    const result = withSecurityHeaders(NextResponse.json({ links }));
    result.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    result.headers.set(
      "Vercel-CDN-Cache-Control",
      "public, max-age=300, stale-while-revalidate=3600, stale-if-error=86400",
    );
    return result;
  } catch {
    return jsonError("Unable to load partner links.", 502);
  }
}
