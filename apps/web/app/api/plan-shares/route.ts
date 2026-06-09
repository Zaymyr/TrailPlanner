import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../lib/http";
import {
  buildPlanShareUrl,
  departureTimeSchema,
  generatePlanShareToken,
  hashPlanShareToken,
  localeSchema,
  PLAN_SHARE_SCHEMA_VERSION,
  planShareSnapshotSchema,
} from "../../../lib/plan-share";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
} from "../../../lib/supabase";

export const runtime = "nodejs";

const createPlanShareSchema = z.object({
  planId: z.string().uuid(),
  snapshot: planShareSnapshotSchema,
  departureTime: departureTimeSchema.nullable().optional(),
  locale: localeSchema.default("fr"),
});

const serviceHeaders = (serviceConfig: SupabaseServiceConfig, contentType = "application/json") => ({
  apikey: serviceConfig.supabaseServiceRoleKey,
  Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

type RacePlanLookupRow = {
  id: string;
  updated_at: string;
};

type PlanShareInsertRow = {
  id: string;
  created_at: string;
  expires_at: string | null;
};

async function loadOwnedPlan(serviceConfig: SupabaseServiceConfig, planId: string, userId: string) {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_plans?id=eq.${encodeURIComponent(
      planId
    )}&user_id=eq.${encodeURIComponent(userId)}&select=id,updated_at&limit=1`,
    {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to verify plan before creating share link", await response.text().catch(() => ""));
    return { ok: false as const, plan: null };
  }

  const rows = (await response.json().catch(() => [])) as RacePlanLookupRow[];
  return { ok: true as const, plan: rows[0] ?? null };
}

export async function POST(request: Request) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const parsedBody = createPlanShareSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success || parsedBody.data.snapshot.id !== parsedBody.data.planId) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid share payload." }, { status: 400 }));
  }

  const snapshotSize = JSON.stringify(parsedBody.data.snapshot).length;
  if (snapshotSize > 120000) {
    return withSecurityHeaders(NextResponse.json({ message: "Share payload is too large." }, { status: 413 }));
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);

  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = await checkRateLimitAsync(`plan-share:${supabaseUser.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(NextResponse.json({ message: "Too many share links." }, { status: 429 }));
  }

  const ownedPlan = await loadOwnedPlan(supabaseService, parsedBody.data.planId, supabaseUser.id);
  if (!ownedPlan.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to verify plan." }, { status: 500 }));
  }

  if (!ownedPlan.plan) {
    return withSecurityHeaders(NextResponse.json({ message: "Plan not found." }, { status: 404 }));
  }

  const publicToken = generatePlanShareToken();
  const tokenHash = hashPlanShareToken(publicToken);
  const insertResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/plan_share_links?select=id,created_at,expires_at`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders(supabaseService),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        plan_id: parsedBody.data.planId,
        user_id: supabaseUser.id,
        token_hash: tokenHash,
        snapshot: parsedBody.data.snapshot,
        snapshot_schema_version: PLAN_SHARE_SCHEMA_VERSION,
        departure_time: parsedBody.data.departureTime ?? null,
        locale: parsedBody.data.locale,
        plan_updated_at: ownedPlan.plan.updated_at,
      }),
    }
  );

  const insertResponseBody = await insertResponse.text().catch(() => "");
  let inserted: PlanShareInsertRow[] | null = null;

  try {
    inserted = insertResponseBody ? (JSON.parse(insertResponseBody) as PlanShareInsertRow[]) : null;
  } catch {
    inserted = null;
  }

  if (!insertResponse.ok || !inserted?.[0]) {
    console.error("Unable to create plan share link", insertResponseBody);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create share link." }, { status: 500 }));
  }

  return withSecurityHeaders(
    NextResponse.json({
      share: inserted[0],
      shareUrl: buildPlanShareUrl(publicToken, request),
    })
  );
}
