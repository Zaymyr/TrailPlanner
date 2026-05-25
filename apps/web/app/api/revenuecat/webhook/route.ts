import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  getRevenueCatWebhookAuthorization,
  syncRevenueCatWebhookPayload,
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

  const { userIds, results } = await syncRevenueCatWebhookPayload(payload);
  const syncedUsers = results.filter((result) => result.synced).length;

  return withSecurityHeaders(
    NextResponse.json({
      processedUsers: userIds.length,
      received: true,
      syncedUsers,
    })
  );
}
