import { NextResponse } from 'next/server';
import { z } from 'zod';

import { checkRateLimitAsync, withSecurityHeaders } from '../../../../lib/http';
import { parseCrewStateMutation, updatePlanShareCrewState } from '../../../../lib/plan-share-crew-state-service';
import { planShareServiceHeaders } from '../../../../lib/plan-share-follow-service';
import { hashPlanShareToken, isValidPlanShareToken } from '../../../../lib/plan-share';
import { getSupabaseServiceConfig } from '../../../../lib/supabase';

export const runtime = 'nodejs';

const tokenSchema = z.object({ token: z.string().refine(isValidPlanShareToken) });

export async function PATCH(request: Request) {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) {
    return withSecurityHeaders(NextResponse.json({ message: 'Supabase configuration is missing.' }, { status: 500 }));
  }
  const body = await request.json().catch(() => null);
  const token = tokenSchema.safeParse(body);
  const mutation = parseCrewStateMutation(body);
  if (!token.success || !mutation) {
    return withSecurityHeaders(NextResponse.json({ message: 'Invalid crew-state payload.' }, { status: 400 }));
  }

  const tokenHash = hashPlanShareToken(token.data.token);
  const rateLimit = await checkRateLimitAsync(`plan-share-crew:${tokenHash}`, 120, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(NextResponse.json({ message: 'Too many crew updates.' }, { status: 429 }));
  }

  const params = new URLSearchParams({
    token_hash: `eq.${tokenHash}`,
    revoked_at: 'is.null',
    or: `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`,
    select: 'id,snapshot',
    limit: '1',
  });
  const lookup = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?${params}`, {
    headers: planShareServiceHeaders(serviceConfig),
    cache: 'no-store',
  });
  const links = (await lookup.json().catch(() => [])) as Array<{ id: string; snapshot: unknown }>;
  if (!lookup.ok) {
    return withSecurityHeaders(NextResponse.json({ message: 'Unable to load share link.' }, { status: 500 }));
  }
  if (!links[0]) {
    return withSecurityHeaders(NextResponse.json({ message: 'Share link not found.' }, { status: 404 }));
  }

  const result = await updatePlanShareCrewState(
    serviceConfig,
    links[0].id,
    links[0].snapshot,
    mutation.departureTime,
    mutation.crewState,
  );
  if (result.error === 'too_large') {
    return withSecurityHeaders(NextResponse.json({ message: 'Crew-state payload is too large.' }, { status: 413 }));
  }
  if (!result.data) {
    return withSecurityHeaders(NextResponse.json({ message: 'Unable to update crew state.' }, { status: 500 }));
  }
  return withSecurityHeaders(NextResponse.json(result.data));
}
