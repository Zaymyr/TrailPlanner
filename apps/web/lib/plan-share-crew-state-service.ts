import { normalizePlanSharePassages } from '@trailplanner/shared';

import {
  departureTimeSchema,
  planShareCrewStateSchema,
  planShareSnapshotSchema,
  type PlanShareCrewState,
  type PlanShareSnapshot,
} from './plan-share';
import { planShareServiceHeaders } from './plan-share-follow-service';
import type { SupabaseServiceConfig } from './supabase';

export function normalizeCrewState(crewState: PlanShareCrewState, snapshot: PlanShareSnapshot): PlanShareCrewState {
  return { passages: normalizePlanSharePassages(crewState.passages, snapshot.checkpoints) };
}

export function parseCrewStateMutation(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const body = input as Record<string, unknown>;
  const departureTime = departureTimeSchema.nullable().safeParse(body.departureTime);
  const crewState = planShareCrewStateSchema.safeParse(body.crewState);
  if (!departureTime.success || !crewState.success) return null;
  return { departureTime: departureTime.data, crewState: crewState.data };
}

export async function updatePlanShareCrewState(
  serviceConfig: SupabaseServiceConfig,
  shareId: string,
  snapshotInput: unknown,
  departureTime: string | null,
  crewState: PlanShareCrewState,
) {
  const snapshot = planShareSnapshotSchema.safeParse(snapshotInput);
  if (!snapshot.success) return { error: 'invalid_snapshot' as const };
  const normalized = normalizeCrewState(crewState, snapshot.data);
  if (JSON.stringify(normalized).length > 20_000) return { error: 'too_large' as const };

  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?id=eq.${encodeURIComponent(shareId)}&select=departure_time,crew_state,updated_at`,
    {
      method: 'PATCH',
      headers: { ...planShareServiceHeaders(serviceConfig, true), Prefer: 'return=representation' },
      body: JSON.stringify({ departure_time: departureTime, crew_state: normalized }),
    },
  );
  const rows = (await response.json().catch(() => [])) as Array<{
    departure_time: string | null;
    crew_state: unknown;
    updated_at: string;
  }>;
  if (!response.ok || !rows[0]) return { error: 'update_failed' as const };
  return {
    data: {
      departureTime: rows[0].departure_time,
      crewState: planShareCrewStateSchema.catch({ passages: [] }).parse(rows[0].crew_state),
      updatedAt: rows[0].updated_at,
    },
  };
}
