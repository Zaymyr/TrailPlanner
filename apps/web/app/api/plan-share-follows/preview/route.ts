import { z } from 'zod';

import { checkRateLimitAsync } from '../../../../lib/http';
import { authenticatePlanShareRequest, planShareJson, planShareServiceHeaders } from '../../../../lib/plan-share-follow-service';
import { hashPlanShareToken, isValidPlanShareToken, planShareSnapshotSchema } from '../../../../lib/plan-share';

const schema = z.object({ token: z.string().refine(isValidPlanShareToken) });

export async function POST(request: Request) {
  const result = await authenticatePlanShareRequest(request);
  if (result.response) return result.response;
  const { userId, serviceConfig } = result.auth;
  const rateLimit = await checkRateLimitAsync(`plan-share-follow-preview:${userId}`, 30, 60_000);
  if (!rateLimit.allowed) return planShareJson({ message: 'Too many requests.' }, 429);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return planShareJson({ message: 'Invalid share token.' }, 400);

  const params = new URLSearchParams({
    token_hash: `eq.${hashPlanShareToken(body.data.token)}`,
    revoked_at: 'is.null',
    or: `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`,
    select: 'user_id,snapshot,locale',
    limit: '1',
  });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?${params}`, {
    headers: planShareServiceHeaders(serviceConfig), cache: 'no-store',
  });
  const rows = (await response.json().catch(() => [])) as Array<{ user_id: string; snapshot: unknown; locale: string }>;
  if (!response.ok) return planShareJson({ message: 'Unable to load preview.' }, 502);
  if (!rows[0]) return planShareJson({ message: 'Share link not found.' }, 404);
  if (rows[0].user_id === userId) return planShareJson({ message: 'You cannot follow your own plan.' }, 409);
  const snapshot = planShareSnapshotSchema.safeParse(rows[0].snapshot);
  if (!snapshot.success) return planShareJson({ message: 'Share preview unavailable.' }, 500);
  return planShareJson({
    planName: snapshot.data.name,
    distanceKm: snapshot.data.distanceKm,
    elevationGainM: snapshot.data.elevationGainM,
    checkpointCount: snapshot.data.checkpoints.length,
    locale: rows[0].locale,
  });
}
