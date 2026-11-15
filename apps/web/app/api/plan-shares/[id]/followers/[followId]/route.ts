import { z } from 'zod';

import { checkRateLimitAsync } from '../../../../../../lib/http';
import { authenticatePlanShareRequest, planShareJson, planShareServiceHeaders } from '../../../../../../lib/plan-share-follow-service';

type Context = { params: { id: string; followId: string } };

export async function DELETE(request: Request, { params: { id, followId } }: Context) {
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(followId).success) {
    return planShareJson({ message: 'Invalid follower id.' }, 400);
  }
  const result = await authenticatePlanShareRequest(request);
  if (result.response) return result.response;
  const { userId, serviceConfig } = result.auth;
  const rateLimit = await checkRateLimitAsync(`plan-share-remove-follower:${userId}`, 30, 60_000);
  if (!rateLimit.allowed) return planShareJson({ message: 'Too many requests.' }, 429);
  const ownershipQuery = new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${userId}`, select: 'id', limit: '1' });
  const ownershipResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?${ownershipQuery}`, {
    headers: planShareServiceHeaders(serviceConfig), cache: 'no-store',
  });
  const ownedLinks = (await ownershipResponse.json().catch(() => [])) as Array<{ id: string }>;
  if (!ownershipResponse.ok) return planShareJson({ message: 'Unable to verify share link.' }, 502);
  if (!ownedLinks[0]) return planShareJson({ message: 'Share link not found.' }, 404);

  const query = new URLSearchParams({ id: `eq.${followId}`, share_link_id: `eq.${id}`, select: 'id' });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_follows?${query}`, {
    method: 'PATCH',
    headers: { ...planShareServiceHeaders(serviceConfig, true), Prefer: 'return=representation' },
    body: JSON.stringify({ removed_at: new Date().toISOString() }),
  });
  const rows = (await response.json().catch(() => [])) as unknown[];
  if (!response.ok) return planShareJson({ message: 'Unable to remove follower.' }, 502);
  if (!rows[0]) return planShareJson({ message: 'Follower not found.' }, 404);
  return planShareJson({ success: true });
}
