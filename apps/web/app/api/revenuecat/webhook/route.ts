import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractRevenueCatWebhookUserIds,
  getRevenueCatWebhookAuthorization,
  syncRevenueCatSubscriptionForUser,
} from "../../../../lib/revenuecat";
import { extractBearerToken } from "../../../../lib/supabase";

const isWebhookAuthorized = (authorizationHeader: string | null, expectedAuthorization: string | null): boolean => {
  if (!expectedAuthorization) {
    return true;
  }

  if (!authorizationHeader) {
    return false;
  }

  return (
    authorizationHeader === expectedAuthorization ||
    extractBearerToken(authorizationHeader) === expectedAuthorization
  );
};

export async function POST(request: Request) {
  const expectedAuthorization = getRevenueCatWebhookAuthorization();

  if (!isWebhookAuthorized(request.headers.get("authorization"), expectedAuthorization)) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid authorization." }, { status: 401 }));
  }

  const payload = await request.json().catch(() => null);

  if (!payload) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid payload." }, { status: 400 }));
  }

  const { providerHint, userIds } = extractRevenueCatWebhookUserIds(payload);

  const results = await Promise.allSettled(
    userIds.map((userId) => syncRevenueCatSubscriptionForUser(userId, { providerHint }))
  );

  const syncedUsers = results.filter((result) => result.status === "fulfilled" && result.value.synced).length;

  return withSecurityHeaders(
    NextResponse.json({
      processedUsers: userIds.length,
      received: true,
      syncedUsers,
    })
  );
}
