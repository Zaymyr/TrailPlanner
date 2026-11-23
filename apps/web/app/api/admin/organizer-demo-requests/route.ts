import { withAdminAudit, auditBody, pickAuditFields } from "../../../../lib/admin-audit-log";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";
import { demoRequestStatusSchema } from "../../../../lib/organizer-demo-requests";

const rowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  email: z.string(),
  race_url: z.string(),
  phone: z.string().nullable(),
  attribution: z.record(z.string(), z.unknown()).nullable().optional(),
  status: demoRequestStatusSchema,
  reviewed_at: z.string().nullable(),
  admin_email_status: z.string().nullable(),
  confirmation_email_status: z.string().nullable(),
});
const patchSchema = z.object({ id: z.string().uuid(), status: demoRequestStatusSchema });

/** Organizer demo requests for the admin inbox (« Demandes de course »), pending first. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const params = new URLSearchParams({
    select: "id,created_at,email,race_url,phone,attribution,status,reviewed_at,admin_email_status,confirmation_email_status",
    order: "is_pending.desc,created_at.desc",
    limit: "50",
  });
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_demo_requests?${params.toString()}`, {
    headers: serviceHeaders(auth.serviceConfig, ""),
    cache: "no-store",
  });
  // Before the migration is deployed the inbox simply shows no demo request.
  if (response.status === 404) return withSecurityHeaders(NextResponse.json({ requests: [], available: false }));
  if (!response.ok) return jsonError("Unable to load demo requests.", 502);
  const parsed = z.array(rowSchema).safeParse(await response.json().catch(() => null));
  if (!parsed.success) return jsonError("Unexpected demo request response.", 500);

  return withSecurityHeaders(NextResponse.json({
    available: true,
    requests: parsed.data.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      email: row.email,
      raceUrl: row.race_url,
      phone: row.phone,
      source: typeof row.attribution?.utm_source === "string" ? row.attribution.utm_source : null,
      status: row.status,
      reviewedAt: row.reviewed_at,
      confirmationEmailStatus: row.confirmation_email_status,
    })),
  }));
}

async function patchRoute(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid demo request update.", 400);

  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_demo_requests?id=eq.${parsed.data.id}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(auth.serviceConfig, ""), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      status: parsed.data.status,
      reviewed_at: parsed.data.status === "pending" ? null : new Date().toISOString(),
      reviewed_by: parsed.data.status === "pending" ? null : auth.user.id,
    }),
    cache: "no-store",
  });
  if (!response.ok) return jsonError("Unable to update demo request.", 502);
  return withSecurityHeaders(NextResponse.json({ ok: true }));
}

export const PATCH = withAdminAudit(patchRoute, {
  action: "organizer.demo",
  targetType: "demo",
  targetId: (c) => auditBody(c).id as string | undefined,
  summary: (c) => `Démo organisateur passée en « ${auditBody(c).status ?? "?"} »`,
  after: (c) => pickAuditFields(c.body, ["status"]),
});
