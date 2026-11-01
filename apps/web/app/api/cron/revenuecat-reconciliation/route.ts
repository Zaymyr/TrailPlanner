import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import { reconcileRevenueCatSubscriptions } from "../../../../lib/revenuecat-reconciliation";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  try {
    const result = await reconcileRevenueCatSubscriptions();
    return withSecurityHeaders(NextResponse.json({ ok: true, result }));
  } catch (error) {
    console.error("Unable to reconcile RevenueCat subscriptions.", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to reconcile RevenueCat subscriptions." }, { status: 500 })
    );
  }
}

export const POST = GET;
