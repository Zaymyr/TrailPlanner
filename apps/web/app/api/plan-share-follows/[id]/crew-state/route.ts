import { z } from 'zod';

import { checkRateLimitAsync } from '../../../../../lib/http';
import { parseCrewStateMutation, updatePlanShareCrewState } from '../../../../../lib/plan-share-crew-state-service';
import { authenticatePlanShareRequest, isActivePlanShare, planShareJson, planShareServiceHeaders } from '../../../../../lib/plan-share-follow-service';

type Context = { params: { id: string } };

export async function PATCH(request: Request, { params: { id } }: Context) {
  if (!z.string().uuid().safeParse(id).success) return planShareJson({ message: 'Invalid follow id.' }, 400);
  const result = await authenticatePlanShareRequest(request);
  if (result.response) return result.response;
  const { userId, serviceConfig } = result.auth;
  const rateLimit = await checkRateLimitAsync(`plan-share-follow-crew:${userId}`, 120, 60_000);
  if (!rateLimit.allowed) return planShareJson({ message: 'Too many crew updates.' }, 429);
  const mutation = parseCrewStateMutation(await request.json().catch(() => null));
  if (!mutation) return planShareJson({ message: 'Invalid crew-state payload.' }, 400);

  const select = 'id,removed_at,plan_share_links!inner(id,snapshot,revoked_at,expires_at)';
  const query = new URLSearchParams({ id: `eq.${id}`, follower_user_id: `eq.${userId}`, select, limit: '1' });
  const lookup = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_follows?${query}`, {
    headers: planShareServiceHeaders(serviceConfig), cache: 'no-store',
  });
  const follows = (await lookup.json().catch(() => [])) as any[];
  if (!lookup.ok) return planShareJson({ message: 'Unable to load followed plan.' }, 502);
  const follow = follows[0];
  const link = Array.isArray(follow?.plan_share_links) ? follow.plan_share_links[0] : follow?.plan_share_links;
  if (!follow || follow.removed_at || !link || !isActivePlanShare(link)) {
    return planShareJson({ message: 'This plan is no longer shared.' }, 410);
  }
  const updated = await updatePlanShareCrewState(serviceConfig, link.id, link.snapshot, mutation.departureTime, mutation.crewState);
  if ('error' in updated && updated.error === 'too_large') return planShareJson({ message: 'Crew-state payload is too large.' }, 413);
  if (!('data' in updated) || !updated.data) return planShareJson({ message: 'Unable to update crew state.' }, 502);
  return planShareJson(updated.data);
}
