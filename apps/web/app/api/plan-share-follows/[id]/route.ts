import { z } from 'zod';

import { checkRateLimitAsync } from '../../../../lib/http';
import {
  authenticatePlanShareRequest,
  FOLLOW_SELECT,
  planShareJson,
  planShareServiceHeaders,
  toFollowedPlanDto,
} from '../../../../lib/plan-share-follow-service';
import { loadPlanShareRaceContext } from '../../../../lib/plan-share-race-context';

const idSchema = z.string().uuid();
const updateSchema = z.object({
  nickname: z.string().trim().min(1).max(60).nullable().optional(),
  archived: z.boolean().optional(),
}).refine((body) => body.nickname !== undefined || body.archived !== undefined);

type Context = { params: { id: string } };

async function authorize(request: Request, id: string, action: string) {
  const auth = await authenticatePlanShareRequest(request);
  if (auth.response) return auth;
  if (!idSchema.safeParse(id).success) return { response: planShareJson({ message: 'Invalid follow id.' }, 400) };
  const rateLimit = await checkRateLimitAsync(`plan-share-follow-${action}:${auth.auth.userId}`, 60, 60_000);
  if (!rateLimit.allowed) return { response: planShareJson({ message: 'Too many requests.' }, 429) };
  return auth;
}

export async function GET(request: Request, { params: { id } }: Context) {
  const result = await authorize(request, id, 'get');
  if (result.response) return result.response;
  const { userId, serviceConfig } = result.auth;
  const query = new URLSearchParams({ id: `eq.${id}`, follower_user_id: `eq.${userId}`, select: FOLLOW_SELECT, limit: '1' });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_follows?${query}`, {
    headers: planShareServiceHeaders(serviceConfig), cache: 'no-store',
  });
  const rows = (await response.json().catch(() => [])) as unknown[];
  if (!response.ok) return planShareJson({ message: 'Unable to load followed plan.' }, 502);
  if (!rows[0]) return planShareJson({ message: 'Followed plan not found.' }, 404);
  const follow = toFollowedPlanDto(rows[0]);
  if (follow.status !== 'active') return planShareJson({ message: 'This plan is no longer shared.', follow }, 410);
  const raceContext = await loadPlanShareRaceContext(serviceConfig, follow.snapshot).catch(() => null);
  return planShareJson({ follow: { ...follow, ...(raceContext ? { raceContext } : {}) } });
}

export async function PATCH(request: Request, { params: { id } }: Context) {
  const result = await authorize(request, id, 'patch');
  if (result.response) return result.response;
  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return planShareJson({ message: 'Invalid follow update.' }, 400);
  const payload: Record<string, unknown> = {};
  if (body.data.nickname !== undefined) payload.nickname = body.data.nickname;
  if (body.data.archived !== undefined) {
    payload.archived_at = body.data.archived ? new Date().toISOString() : null;
    payload.auto_archive_dismissed_at = body.data.archived ? null : new Date().toISOString();
  }
  const { userId, serviceConfig } = result.auth;
  const query = new URLSearchParams({ id: `eq.${id}`, follower_user_id: `eq.${userId}`, removed_at: 'is.null', select: 'id,nickname,archived_at,auto_archive_dismissed_at' });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_follows?${query}`, {
    method: 'PATCH',
    headers: { ...planShareServiceHeaders(serviceConfig, true), Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const rows = (await response.json().catch(() => [])) as unknown[];
  if (!response.ok) return planShareJson({ message: 'Unable to update followed plan.' }, 502);
  if (!rows[0]) return planShareJson({ message: 'Followed plan not found.' }, 404);
  return planShareJson({ follow: rows[0] });
}

export async function DELETE(request: Request, { params: { id } }: Context) {
  const result = await authorize(request, id, 'delete');
  if (result.response) return result.response;
  const { userId, serviceConfig } = result.auth;
  const query = new URLSearchParams({ id: `eq.${id}`, follower_user_id: `eq.${userId}` });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_follows?${query}`, {
    method: 'DELETE', headers: planShareServiceHeaders(serviceConfig),
  });
  if (!response.ok) return planShareJson({ message: 'Unable to unfollow plan.' }, 502);
  return planShareJson({ success: true });
}
