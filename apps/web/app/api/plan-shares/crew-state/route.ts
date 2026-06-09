import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import {
  departureTimeSchema,
  hashPlanShareToken,
  isValidPlanShareToken,
  planShareCrewStateSchema,
  planShareSnapshotSchema,
  type PlanShareCrewState,
  type PlanShareSnapshot,
} from "../../../../lib/plan-share";
import { getSupabaseServiceConfig, type SupabaseServiceConfig } from "../../../../lib/supabase";

export const runtime = "nodejs";

const updateCrewStateSchema = z.object({
  token: z.string().refine(isValidPlanShareToken),
  departureTime: departureTimeSchema.nullable(),
  crewState: planShareCrewStateSchema,
});

const emptyCrewState: PlanShareCrewState = { passages: [] };

const serviceHeaders = (serviceConfig: SupabaseServiceConfig, contentType = "application/json") => ({
  apikey: serviceConfig.supabaseServiceRoleKey,
  Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

type PlanShareLookupRow = {
  id: string;
  snapshot: unknown;
};

type PlanShareCrewStateMutationRow = {
  departure_time: string | null;
  crew_state: unknown;
  updated_at: string;
};

async function loadPlanShareByTokenHash(serviceConfig: SupabaseServiceConfig, tokenHash: string) {
  const params = new URLSearchParams();
  params.set("token_hash", `eq.${tokenHash}`);
  params.set("revoked_at", "is.null");
  params.set("or", `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`);
  params.set("select", "id,snapshot");
  params.set("limit", "1");

  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?${params.toString()}`, {
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to load plan share before crew-state update", await response.text().catch(() => ""));
    return { ok: false as const, share: null };
  }

  const rows = (await response.json().catch(() => [])) as PlanShareLookupRow[];
  const row = rows[0];
  if (!row) return { ok: true as const, share: null };

  const parsedSnapshot = planShareSnapshotSchema.safeParse(row.snapshot);
  if (!parsedSnapshot.success) {
    console.error("Invalid plan share snapshot before crew-state update", parsedSnapshot.error.flatten().fieldErrors);
    return { ok: false as const, share: null };
  }

  return {
    ok: true as const,
    share: {
      id: row.id,
      snapshot: parsedSnapshot.data,
    },
  };
}

function normalizeCrewState(
  crewState: PlanShareCrewState,
  snapshot: PlanShareSnapshot
): PlanShareCrewState {
  const checkpointOrder = new Map(snapshot.checkpoints.map((checkpoint, order) => [checkpoint.index, order]));
  const validCheckpointIndexes = new Set(checkpointOrder.keys());
  const byCheckpoint = new Map<number, PlanShareCrewState["passages"][number]>();

  for (const passage of crewState.passages) {
    if (!validCheckpointIndexes.has(passage.checkpointIndex)) continue;

    byCheckpoint.set(passage.checkpointIndex, {
      checkpointIndex: passage.checkpointIndex,
      actualMinute: Math.max(0, Math.round(passage.actualMinute)),
      confirmedAt: passage.confirmedAt,
    });
  }

  return {
    passages: Array.from(byCheckpoint.values()).sort(
      (a, b) => (checkpointOrder.get(a.checkpointIndex) ?? 0) - (checkpointOrder.get(b.checkpointIndex) ?? 0)
    ),
  };
}

async function updateCrewState(
  serviceConfig: SupabaseServiceConfig,
  shareId: string,
  departureTime: string | null,
  crewState: PlanShareCrewState
) {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?id=eq.${encodeURIComponent(
      shareId
    )}&select=departure_time,crew_state,updated_at`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        departure_time: departureTime,
        crew_state: crewState,
      }),
    }
  );

  const responseBody = await response.text().catch(() => "");
  let updated: PlanShareCrewStateMutationRow[] | null = null;

  try {
    updated = responseBody ? (JSON.parse(responseBody) as PlanShareCrewStateMutationRow[]) : null;
  } catch {
    updated = null;
  }

  if (!response.ok || !updated?.[0]) {
    console.error("Unable to update plan share crew state", responseBody);
    return null;
  }

  const parsedCrewState = planShareCrewStateSchema.catch(emptyCrewState).parse(updated[0].crew_state);

  return {
    departureTime: updated[0].departure_time,
    crewState: parsedCrewState,
    updatedAt: updated[0].updated_at,
  };
}

export async function PATCH(request: Request) {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedBody = updateCrewStateSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid crew-state payload." }, { status: 400 }));
  }

  const tokenHash = hashPlanShareToken(parsedBody.data.token);
  const rateLimit = await checkRateLimitAsync(`plan-share-crew:${tokenHash}`, 120, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(NextResponse.json({ message: "Too many crew updates." }, { status: 429 }));
  }

  const share = await loadPlanShareByTokenHash(serviceConfig, tokenHash);
  if (!share.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load share link." }, { status: 500 }));
  }

  if (!share.share) {
    return withSecurityHeaders(NextResponse.json({ message: "Share link not found." }, { status: 404 }));
  }

  const normalizedCrewState = normalizeCrewState(parsedBody.data.crewState, share.share.snapshot);
  if (JSON.stringify(normalizedCrewState).length > 20000) {
    return withSecurityHeaders(NextResponse.json({ message: "Crew-state payload is too large." }, { status: 413 }));
  }

  const updated = await updateCrewState(
    serviceConfig,
    share.share.id,
    parsedBody.data.departureTime,
    normalizedCrewState
  );

  if (!updated) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update crew state." }, { status: 500 }));
  }

  return withSecurityHeaders(NextResponse.json(updated));
}
