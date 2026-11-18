import { supabase } from './supabase';
import { WEB_API_BASE_URL } from './webApi';

export type FollowedPlan = {
  id: string;
  nickname: string | null;
  createdAt: string;
  archivedAt: string | null;
  status: 'active' | 'unavailable';
  shareLinkId: string;
  planName: string;
  distanceKm: number;
  elevationGainM: number;
  snapshot?: any;
  crewState?: { passages: Array<{ checkpointIndex: number; actualMinute: number; confirmedAt: string }> };
  departureTime?: string | null;
  locale?: 'fr' | 'en';
  planUpdatedAt?: string | null;
  autoArchived?: boolean;
  autoArchiveDismissedAt?: string | null;
  raceContext?: FollowedPlanRaceContext;
};

export type FollowedPlanRaceContext = {
  raceId: string;
  raceName: string;
  raceDate: string | null;
  officialStartTime: string | null;
  finishCutoffTime: string | null;
  finishCutoffDayOffset: number;
  supporterPoints: Array<{ id: string; name: string; km: number; encouragementAllowed: boolean; assistanceAllowed: boolean; accessLabel: string | null; latitude: number; longitude: number; googleMapsUrl: string | null; accessNote: string | null; planUrl: string | null }>;
  checkpointContexts: Array<{ checkpointIndex: number; id: string; name: string; km: number; supportersAccess: 'allowed' | 'restricted' | 'forbidden' | null; maxStopMinutes: number | null; amenities: string[]; cutoffTime: string | null; cutoffDayOffset: number; assistanceAllowed: boolean; accessLabel: string | null; accessNote: string | null; planUrl?: string | null; googleMapsUrl: string | null; latitude: number | null; longitude: number | null }>;
  access: { startAddress: string | null; startLocation: FollowedLocation; finishAddress: string | null; finishLocation: FollowedLocation; officialParkings: string | null; shuttles: string | null; shuttleSchedule: string | null; mapUrl: string | null; note: string | null } | null;
  bibPickup: { thirdPartyPickupAllowed: boolean | null; thirdPartyPickupConditions: string | null } | null;
  emergencyContact: { name: string | null; phone: string } | null;
  publishedAt: string;
  completionAt: string | null;
};

type FollowedLocation = { label: string | null; latitude: number | null; longitude: number | null; googleMapsUrl: string | null };

async function authenticatedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token || data.session?.user.is_anonymous) throw new Error('authentication_required');
  const response = await fetch(`${WEB_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(typeof body?.message === 'string' ? body.message : 'request_failed') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function previewPlanShare(token: string) {
  return authenticatedFetch('/api/plan-share-follows/preview', {
    method: 'POST', body: JSON.stringify({ token }),
  }) as Promise<{ planName: string; distanceKm: number; elevationGainM: number; checkpointCount: number; locale: 'fr' | 'en' }>;
}

export async function followPlanShare(token: string) {
  return authenticatedFetch('/api/plan-share-follows', {
    method: 'POST', body: JSON.stringify({ token }),
  }) as Promise<{ id: string }>;
}

export async function listFollowedPlans() {
  const body = await authenticatedFetch('/api/plan-share-follows') as { follows: FollowedPlan[] };
  return body.follows;
}

export async function getFollowedPlan(id: string) {
  const body = await authenticatedFetch(`/api/plan-share-follows/${encodeURIComponent(id)}`) as { follow: FollowedPlan };
  return body.follow;
}

export async function updateFollowedPlan(id: string, update: { nickname?: string | null; archived?: boolean }) {
  return authenticatedFetch(`/api/plan-share-follows/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(update),
  });
}

export async function unfollowPlan(id: string) {
  return authenticatedFetch(`/api/plan-share-follows/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function updateFollowedPlanCrewState(
  id: string,
  departureTime: string | null,
  crewState: FollowedPlan['crewState'],
) {
  return authenticatedFetch(`/api/plan-share-follows/${encodeURIComponent(id)}/crew-state`, {
    method: 'PATCH', body: JSON.stringify({ departureTime, crewState }),
  }) as Promise<{ departureTime: string | null; crewState: NonNullable<FollowedPlan['crewState']>; updatedAt: string }>;
}

export async function getPlanShareFollowers(shareId: string) {
  return authenticatedFetch(`/api/plan-shares/${encodeURIComponent(shareId)}/followers`) as Promise<{
    revoked: boolean;
    followers: Array<{ id: string; displayName: string | null; nickname: string | null; followedAt: string }>;
  }>;
}

export async function getOwnedPlanShare(planId: string) {
  const body = await authenticatedFetch(`/api/plan-shares?planId=${encodeURIComponent(planId)}`) as {
    share: { id: string; revoked: boolean; createdAt: string; activeFollowerCount: number } | null;
  };
  return body.share;
}

export async function removePlanShareFollower(shareId: string, followId: string) {
  return authenticatedFetch(`/api/plan-shares/${encodeURIComponent(shareId)}/followers/${encodeURIComponent(followId)}`, { method: 'DELETE' });
}

export async function revokePlanShare(shareId: string) {
  return authenticatedFetch(`/api/plan-shares/${encodeURIComponent(shareId)}/revoke`, { method: 'POST' });
}
