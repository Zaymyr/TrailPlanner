import { NextResponse } from 'next/server';

import { withSecurityHeaders } from './http';
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAnonymousUser,
  type SupabaseServiceConfig,
} from './supabase';

export type PlanShareRequestAuth = {
  userId: string;
  serviceConfig: SupabaseServiceConfig;
};

export const planShareServiceHeaders = (serviceConfig: SupabaseServiceConfig, json = false) => ({
  apikey: serviceConfig.supabaseServiceRoleKey,
  Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

export function planShareJson(body: unknown, status = 200) {
  return withSecurityHeaders(NextResponse.json(body, { status }));
}

export async function authenticatePlanShareRequest(
  request: Request,
): Promise<{ auth: PlanShareRequestAuth; response?: never } | { auth?: never; response: NextResponse }> {
  const anonConfig = getSupabaseAnonConfig();
  const serviceConfig = getSupabaseServiceConfig();
  if (!anonConfig || !serviceConfig) {
    return { response: planShareJson({ message: 'Supabase configuration is missing.' }, 500) };
  }

  const accessToken = extractBearerToken(request.headers.get('authorization'));
  if (!accessToken) return { response: planShareJson({ message: 'Missing access token.' }, 401) };

  const user = await fetchSupabaseUser(accessToken, anonConfig);
  if (!user || isAnonymousUser(user)) return { response: planShareJson({ message: 'Identified account required.' }, 401) };

  return { auth: { userId: user.id, serviceConfig } };
}

export function isActivePlanShare(link: { revoked_at: string | null; expires_at: string | null }) {
  return !link.revoked_at && (!link.expires_at || new Date(link.expires_at).getTime() > Date.now());
}

export function toFollowedPlanDto(follow: any) {
  const link = Array.isArray(follow.plan_share_links) ? follow.plan_share_links[0] : follow.plan_share_links;
  const snapshot = link?.snapshot ?? null;
  const active = Boolean(link && !follow.removed_at && isActivePlanShare(link));
  return {
    id: follow.id,
    nickname: follow.nickname,
    createdAt: follow.created_at,
    archivedAt: follow.archived_at,
    status: active ? 'active' : 'unavailable',
    shareLinkId: link?.id ?? follow.share_link_id,
    planName: active ? snapshot?.name ?? '' : '',
    distanceKm: active ? snapshot?.distanceKm ?? 0 : 0,
    elevationGainM: active ? snapshot?.elevationGainM ?? 0 : 0,
    ...(active ? {
      snapshot,
      crewState: link.crew_state ?? { passages: [] },
      departureTime: link.departure_time ?? null,
      locale: link.locale ?? 'fr',
    } : {}),
  };
}

export const FOLLOW_SELECT = [
  'id',
  'share_link_id',
  'nickname',
  'created_at',
  'archived_at',
  'removed_at',
  'plan_share_links!inner(id,user_id,snapshot,crew_state,departure_time,locale,expires_at,revoked_at)',
].join(',');
