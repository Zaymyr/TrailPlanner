import { z } from 'zod';

import { checkRateLimitAsync } from '../../../../../lib/http';
import { authenticatePlanShareRequest, planShareJson, planShareServiceHeaders } from '../../../../../lib/plan-share-follow-service';

type Context = { params: { id: string } };

export async function POST(request: Request, { params: { id } }: Context) {
  if (!z.string().uuid().safeParse(id).success) return planShareJson({ message: 'Invalid share id.' }, 400);
  const result = await authenticatePlanShareRequest(request);
  if (result.response) return result.response;
  const { userId, serviceConfig } = result.auth;
  const rateLimit = await checkRateLimitAsync(`plan-share-revoke:${userId}`, 20, 60_000);
  if (!rateLimit.allowed) return planShareJson({ message: 'Too many requests.' }, 429);
  const query = new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${userId}`, select: 'id,revoked_at' });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?${query}`, {
    method: 'PATCH',
    headers: { ...planShareServiceHeaders(serviceConfig, true), Prefer: 'return=representation' },
    body: JSON.stringify({ revoked_at: new Date().toISOString() }),
  });
  const rows = (await response.json().catch(() => [])) as unknown[];
  if (!response.ok) return planShareJson({ message: 'Unable to revoke share link.' }, 502);
  if (!rows[0]) return planShareJson({ message: 'Share link not found.' }, 404);
  return planShareJson({ success: true });
}
