import { z } from 'zod';

import { checkRateLimitAsync } from '../../../../../lib/http';
import { authenticatePlanShareRequest, planShareJson, planShareServiceHeaders } from '../../../../../lib/plan-share-follow-service';

type Context = { params: { id: string } };

export async function GET(request: Request, { params: { id } }: Context) {
  if (!z.string().uuid().safeParse(id).success) return planShareJson({ message: 'Invalid share id.' }, 400);
  const result = await authenticatePlanShareRequest(request);
  if (result.response) return result.response;
  const { userId, serviceConfig } = result.auth;
  const rateLimit = await checkRateLimitAsync(`plan-share-followers:${userId}`, 60, 60_000);
  if (!rateLimit.allowed) return planShareJson({ message: 'Too many requests.' }, 429);

  const linkQuery = new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${userId}`, select: 'id,revoked_at', limit: '1' });
  const linkResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?${linkQuery}`, {
    headers: planShareServiceHeaders(serviceConfig), cache: 'no-store',
  });
  const links = (await linkResponse.json().catch(() => [])) as Array<{ id: string; revoked_at: string | null }>;
  if (!linkResponse.ok) return planShareJson({ message: 'Unable to load share link.' }, 502);
  if (!links[0]) return planShareJson({ message: 'Share link not found.' }, 404);

  const followQuery = new URLSearchParams({ share_link_id: `eq.${id}`, removed_at: 'is.null', select: 'id,follower_user_id,nickname,created_at', order: 'created_at.asc' });
  const followsResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_follows?${followQuery}`, {
    headers: planShareServiceHeaders(serviceConfig), cache: 'no-store',
  });
  const follows = (await followsResponse.json().catch(() => [])) as Array<{ id: string; follower_user_id: string; nickname: string | null; created_at: string }>;
  if (!followsResponse.ok) return planShareJson({ message: 'Unable to load followers.' }, 502);
  const ids = [...new Set(follows.map((follow) => follow.follower_user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const profileQuery = new URLSearchParams({ user_id: `in.(${ids.join(',')})`, select: 'user_id,full_name' });
    const profilesResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/user_profiles?${profileQuery}`, {
      headers: planShareServiceHeaders(serviceConfig), cache: 'no-store',
    });
    const profiles = (await profilesResponse.json().catch(() => [])) as Array<{ user_id: string; full_name: string | null }>;
    if (profilesResponse.ok) profiles.forEach((profile) => {
      if (profile.full_name?.trim()) names.set(profile.user_id, profile.full_name.trim());
    });
  }
  return planShareJson({
    revoked: Boolean(links[0].revoked_at),
    followers: follows.map((follow) => ({
      id: follow.id,
      displayName: names.get(follow.follower_user_id) ?? null,
      nickname: follow.nickname,
      followedAt: follow.created_at,
    })),
  });
}
