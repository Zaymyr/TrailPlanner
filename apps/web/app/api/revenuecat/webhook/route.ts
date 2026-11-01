import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  getRevenueCatWebhookAuthorization,
  getRevenueCatWebhookSigningSecret,
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

const isWebhookSignatureValid = (
  payload: string,
  signatureHeader: string | null,
  signingSecret: string | null,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean => {
  if (!signatureHeader || !signingSecret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const separator = part.indexOf("=");
      return separator > 0 ? [part.slice(0, separator), part.slice(separator + 1)] : [part, ""];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;

  const expected = crypto.createHmac("sha256", signingSecret).update(`${timestamp}.${payload}`).digest("hex");
  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

export async function POST(request: Request) {
  const expectedAuthorization = getRevenueCatWebhookAuthorization();
  const signingSecret = getRevenueCatWebhookSigningSecret();

  if (!expectedAuthorization && !signingSecret) {
    return withSecurityHeaders(NextResponse.json({ message: "Webhook authorization is not configured." }, { status: 503 }));
  }

  const rawPayload = await request.text();
  const isAuthorized = isWebhookAuthorized(request.headers.get("authorization"), expectedAuthorization);
  const hasValidSignature = isWebhookSignatureValid(
    rawPayload,
    request.headers.get("x-revenuecat-webhook-signature"),
    signingSecret
  );

  if (!isAuthorized && !hasValidSignature) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid authorization." }, { status: 401 }));
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawPayload || "null") as unknown;
  } catch {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid payload." }, { status: 400 }));
  }

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
