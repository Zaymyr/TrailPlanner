import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  getRevenueCatWebhookAuthorization,
  syncRevenueCatWebhookPayload,
} from "../../../../lib/revenuecat";
import { extractBearerToken } from "../../../../lib/supabase";

const isWebhookAuthorized = (authorizationHeader: string | null, expectedAuthorization: string | null): boolean => {
  if (!expectedAuthorization) return false;

  if (!authorizationHeader) {
    return false;
  }

  const provided = extractBearerToken(authorizationHeader) ?? authorizationHeader;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expectedAuthorization);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

export async function POST(request: Request) {
  const expectedAuthorization = getRevenueCatWebhookAuthorization();

  if (!expectedAuthorization) {
    return withSecurityHeaders(NextResponse.json({ message: "Webhook authorization is not configured." }, { status: 503 }));
  }

  if (!isWebhookAuthorized(request.headers.get("authorization"), expectedAuthorization)) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid authorization." }, { status: 401 }));
  }

  const payload = await request.json().catch(() => null);

  if (!payload) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid payload." }, { status: 400 }));
  }

  const { userIds, results } = await syncRevenueCatWebhookPayload(payload);
  const syncedUsers = results.filter((result) => result.synced).length;
  if (results.some((result) => !result.synced)) {
    return withSecurityHeaders(NextResponse.json({ message: "Webhook persistence failed." }, { status: 503 }));
  }

  return withSecurityHeaders(
    NextResponse.json({
      processedUsers: userIds.length,
      received: true,
      syncedUsers,
    })
  );
}
