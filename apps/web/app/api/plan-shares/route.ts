import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../lib/http";
import {
  buildPlanShareUrl,
  departureTimeSchema,
  generatePlanShareId,
  generateStablePlanShareToken,
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

type PlanShareExistingRow = {
  id: string;
  token_hash: string;
  created_at: string;
  expires_at: string | null;
};

type PlanShareMutationRow = {
  id: string;
  created_at: string;
  updated_at: string;
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

function getStableTokenSecret(serviceConfig: SupabaseServiceConfig) {
  return process.env.PLAN_SHARE_TOKEN_SECRET?.trim() || serviceConfig.supabaseServiceRoleKey;
}

function buildStableTokenForShare(serviceConfig: SupabaseServiceConfig, shareId: string) {
  return generateStablePlanShareToken(shareId, getStableTokenSecret(serviceConfig));
}

async function loadReusableShareLink(
  serviceConfig: SupabaseServiceConfig,
  planId: string,
  userId: string
) {
  const params = new URLSearchParams();
  params.set("plan_id", `eq.${planId}`);
  params.set("user_id", `eq.${userId}`);
  params.set("revoked_at", "is.null");
  params.set("or", `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`);
  params.set("select", "id,token_hash,created_at,expires_at");
  params.set("order", "updated_at.desc");
  params.set("limit", "25");

  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?${params.toString()}`, {
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to load existing plan share links", await response.text().catch(() => ""));
    return null;
  }

  const rows = (await response.json().catch(() => [])) as PlanShareExistingRow[];
  for (const row of rows) {
    const publicToken = buildStableTokenForShare(serviceConfig, row.id);
    if (hashPlanShareToken(publicToken) === row.token_hash) {
      return { row, publicToken };
    }
  }

  return null;
}

async function updateShareLink(
  serviceConfig: SupabaseServiceConfig,
  shareId: string,
  userId: string,
  data: z.infer<typeof createPlanShareSchema>,
  planUpdatedAt: string
) {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?id=eq.${encodeURIComponent(
      shareId
    )}&user_id=eq.${encodeURIComponent(userId)}&select=id,created_at,updated_at,expires_at`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        snapshot: data.snapshot,
        snapshot_schema_version: PLAN_SHARE_SCHEMA_VERSION,
        departure_time: data.departureTime ?? null,
        locale: data.locale,
        plan_updated_at: planUpdatedAt,
        revoked_at: null,
      }),
    }
  );

  const responseBody = await response.text().catch(() => "");
  let updated: PlanShareMutationRow[] | null = null;

  try {
    updated = responseBody ? (JSON.parse(responseBody) as PlanShareMutationRow[]) : null;
  } catch {
    updated = null;
  }

  if (!response.ok || !updated?.[0]) {
    console.error("Unable to update plan share link", responseBody);
    return null;
  }

  return updated[0];
}

async function createShareLink(
  serviceConfig: SupabaseServiceConfig,
  userId: string,
  data: z.infer<typeof createPlanShareSchema>,
  planUpdatedAt: string
) {
  const shareId = generatePlanShareId();
  const publicToken = buildStableTokenForShare(serviceConfig, shareId);
  const tokenHash = hashPlanShareToken(publicToken);
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?select=id,created_at,expires_at`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders(serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: shareId,
        plan_id: data.planId,
        user_id: userId,
        token_hash: tokenHash,
        snapshot: data.snapshot,
        snapshot_schema_version: PLAN_SHARE_SCHEMA_VERSION,
        departure_time: data.departureTime ?? null,
        locale: data.locale,
        plan_updated_at: planUpdatedAt,
      }),
    }
  );

  const responseBody = await response.text().catch(() => "");
  let inserted: PlanShareInsertRow[] | null = null;

  try {
    inserted = responseBody ? (JSON.parse(responseBody) as PlanShareInsertRow[]) : null;
  } catch {
    inserted = null;
  }

  if (!response.ok || !inserted?.[0]) {
    console.error("Unable to create plan share link", responseBody);
    return null;
  }

  return { share: inserted[0], publicToken };
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

  const reusableShare = await loadReusableShareLink(supabaseService, parsedBody.data.planId, supabaseUser.id);
  if (reusableShare) {
    const updatedShare = await updateShareLink(
      supabaseService,
      reusableShare.row.id,
      supabaseUser.id,
      parsedBody.data,
      ownedPlan.plan.updated_at
    );

    if (!updatedShare) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update share link." }, { status: 500 }));
    }

    return withSecurityHeaders(
      NextResponse.json({
        share: updatedShare,
        shareUrl: buildPlanShareUrl(reusableShare.publicToken),
      })
    );
  }

  const createdShare = await createShareLink(
    supabaseService,
    supabaseUser.id,
    parsedBody.data,
    ownedPlan.plan.updated_at
  );

  if (!createdShare) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create share link." }, { status: 500 }));
  }

  return withSecurityHeaders(
    NextResponse.json({
      share: createdShare.share,
      shareUrl: buildPlanShareUrl(createdShare.publicToken),
    })
  );
}
