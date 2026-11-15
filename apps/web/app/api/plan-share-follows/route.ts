import { z } from 'zod';

import { checkRateLimitAsync } from '../../../lib/http';
import {
  authenticatePlanShareRequest,
  FOLLOW_SELECT,
  planShareJson,
  planShareServiceHeaders,
  toFollowedPlanDto,
} from '../../../lib/plan-share-follow-service';
import { hashPlanShareToken, isValidPlanShareToken } from '../../../lib/plan-share';

export const runtime = 'nodejs';

const followSchema = z.object({ token: z.string().refine(isValidPlanShareToken) });

export async function GET(request: Request) {
  const result = await authenticatePlanShareRequest(request);
  if (result.response) return result.response;
  const { userId, serviceConfig } = result.auth;
  const rateLimit = await checkRateLimitAsync(`plan-share-follows-list:${userId}`, 60, 60_000);
  if (!rateLimit.allowed) return planShareJson({ message: 'Too many requests.' }, 429);

  const params = new URLSearchParams({
    follower_user_id: `eq.${userId}`,
    select: FOLLOW_SELECT,
    order: 'created_at.desc',
  });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_follows?${params}`, {
    headers: planShareServiceHeaders(serviceConfig),
    cache: 'no-store',
  });
  if (!response.ok) return planShareJson({ message: 'Unable to load followed plans.' }, 502);
  const follows = (await response.json().catch(() => [])) as unknown[];
  return planShareJson({ follows: follows.map(toFollowedPlanDto) });
}

export async function POST(request: Request) {
  const result = await authenticatePlanShareRequest(request);
  if (result.response) return result.response;
  const { userId, serviceConfig } = result.auth;
  const rateLimit = await checkRateLimitAsync(`plan-share-follow:${userId}`, 20, 60_000);
  if (!rateLimit.allowed) return planShareJson({ message: 'Too many follow attempts.' }, 429);

  const body = followSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return planShareJson({ message: 'Invalid share token.' }, 400);
  const params = new URLSearchParams({
    token_hash: `eq.${hashPlanShareToken(body.data.token)}`,
    revoked_at: 'is.null',
    or: `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`,
    select: 'id,user_id',
    limit: '1',
  });
  const lookup = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?${params}`, {
    headers: planShareServiceHeaders(serviceConfig),
    cache: 'no-store',
  });
  const links = (await lookup.json().catch(() => [])) as Array<{ id: string; user_id: string }>;
  if (!lookup.ok) return planShareJson({ message: 'Unable to verify share link.' }, 502);
  if (!links[0]) return planShareJson({ message: 'Share link not found.' }, 404);
  if (links[0].user_id === userId) return planShareJson({ message: 'You cannot follow your own plan.' }, 409);

  const upsert = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/plan_share_follows?on_conflict=share_link_id,follower_user_id&select=id`,
    {
      method: 'POST',
      headers: {
        ...planShareServiceHeaders(serviceConfig, true),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        share_link_id: links[0].id,
        follower_user_id: userId,
        removed_at: null,
        archived_at: null,
      }),
    },
  );
  const rows = (await upsert.json().catch(() => [])) as Array<{ id: string }>;
  if (!upsert.ok || !rows[0]) return planShareJson({ message: 'Unable to follow plan.' }, 502);
  return planShareJson({ id: rows[0].id }, 201);
}
