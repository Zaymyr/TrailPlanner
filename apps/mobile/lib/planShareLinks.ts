import type { Locale } from '../locales/types';
import type { PlanSummary } from './planSummary';
import { formatClock } from './planSummary';
import { supabase } from './supabase';
import { WEB_API_BASE_URL } from './webApi';

export type CreatePlanShareLinkArgs = {
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

export function buildPlanShareSnapshotKey({
  summary,
  departureTime,
  locale,
}: CreatePlanShareLinkArgs) {
  return JSON.stringify({
    summary,
    departureTime: formatClock(departureTime),
    locale,
  });
}

export function createPlanShareLinkSynchronizer(
  createLink: (args: CreatePlanShareLinkArgs) => Promise<string> = createPlanShareLink,
) {
  let syncedKey: string | null = null;
  let syncedUrl: string | null = null;
  let pendingKey: string | null = null;
  let pendingRequest: Promise<string> | null = null;

  const synchronize = async (args: CreatePlanShareLinkArgs): Promise<string> => {
    const key = buildPlanShareSnapshotKey(args);

    if (syncedKey === key && syncedUrl) return syncedUrl;
    if (pendingRequest) {
      if (pendingKey === key) return pendingRequest;

      try {
        await pendingRequest;
      } catch {
        // A newer snapshot still needs its own synchronization after a failed request.
      }
      return synchronize(args);
    }

    pendingKey = key;
    pendingRequest = createLink(args)
      .then((shareUrl) => {
        syncedKey = key;
        syncedUrl = shareUrl;
        return shareUrl;
      })
      .finally(() => {
        if (pendingKey === key) {
          pendingKey = null;
          pendingRequest = null;
        }
      });

    return pendingRequest;
  };

  return synchronize;
}
