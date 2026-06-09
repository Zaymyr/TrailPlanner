import type { Locale } from '../locales/types';
import { formatClock, type PlanSummary } from './planSummary';
import { supabase } from './supabase';
import { WEB_API_BASE_URL } from './webApi';

type CreatePlanShareLinkArgs = {
  summary: PlanSummary;
  departureTime: Date;
  locale: Locale;
};

type CreatePlanShareLinkResponse = {
  shareUrl?: unknown;
};

export async function createPlanShareLink({
  summary,
  departureTime,
  locale,
}: CreatePlanShareLinkArgs) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error('Missing Supabase session.');
  }

  const response = await fetch(`${WEB_API_BASE_URL}/api/plan-shares`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      planId: summary.id,
      snapshot: summary,
      departureTime: formatClock(departureTime),
      locale,
    }),
  });

  const body = (await response.json().catch(() => null)) as CreatePlanShareLinkResponse | null;
  const shareUrl = body?.shareUrl;

  if (!response.ok || typeof shareUrl !== 'string' || shareUrl.length === 0) {
    throw new Error('Unable to create plan share link.');
  }

  return shareUrl;
}
