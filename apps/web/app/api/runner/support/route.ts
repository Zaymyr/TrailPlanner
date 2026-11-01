import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { getRunnerAdminMode, getRunnerLaunchStatus } from "../../../../lib/runner-access";
import {
  claimRunnerSupportPurchase,
  cancelRunnerSupportIntent,
  createRunnerSupportIntent,
  getRunnerSupportProductId,
  getRunnerSupportPurchase,
  verifyRevenueCatSupportPurchase,
  RunnerSupportIntentConflictError,
} from "../../../../lib/runner-support";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAnonymousUser,
} from "../../../../lib/supabase";

const providerSchema = z.enum(["apple", "google"]);
const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("authorize"), provider: providerSchema }),
  z.object({ action: z.literal("cancel"), intentId: z.string().uuid(), provider: providerSchema }),
  z.object({
    action: z.literal("sync"),
    intentId: z.string().uuid(),
    provider: providerSchema,
    transactionId: z.string().trim().min(1).max(512),
  }),
  z.object({ action: z.literal("reconcile"), provider: providerSchema }),
]);

const json = (body: unknown, status = 200) => withSecurityHeaders(NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "no-store" },
}));

async function authenticate(request: Request) {
  const anon = getSupabaseAnonConfig();
  const service = getSupabaseServiceConfig();
  if (!anon || !service) return { error: json({ message: "Server configuration is missing." }, 500) } as const;
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return { error: json({ message: "Authentication required." }, 401) } as const;
  const user = await fetchSupabaseUser(token, anon);
  if (!user?.id || isAnonymousUser(user)) {
    return { error: json({ message: "Authenticated account required." }, 403) } as const;
  }
  return { token, user } as const;
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ("error" in auth) return auth.error;
  const provider = providerSchema.safeParse(new URL(request.url).searchParams.get("provider"));
  if (!provider.success) return json({ message: "Invalid provider." }, 400);

  try {
    const [purchase, adminMode, launch] = await Promise.all([
      getRunnerSupportPurchase(auth.user.id),
      getRunnerAdminMode(auth.user, auth.token),
      getRunnerLaunchStatus(auth.user.id),
    ]);
    const productId = getRunnerSupportProductId(provider.data);
    return json({
      purchased: purchase?.status === "active",
      productId,
      canPurchase: !purchase && adminMode === "real" && launch.eligible && Boolean(productId),
    });
  } catch (error) {
    console.error("Unable to load runner support status", error);
    return json({ message: "Support status is unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if ("error" in auth) return auth.error;
  const body = postSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ message: "Invalid request." }, 400);
  const rateLimit = await checkRateLimitAsync(`runner:support:${auth.user.id}`, 10, 60_000);
  if (!rateLimit.allowed) return json({ message: "Too many support purchase attempts." }, 429);

  try {
    if (body.data.action === "cancel") {
      const cancelled = await cancelRunnerSupportIntent({
        intentId: body.data.intentId,
        userId: auth.user.id,
      });
      return json({ cancelled });
    }

    const productId = getRunnerSupportProductId(body.data.provider);
    if (!productId) return json({ message: "Support product is not configured." }, 503);

    if (body.data.action === "authorize") {
      const [purchase, adminMode, launch] = await Promise.all([
        getRunnerSupportPurchase(auth.user.id),
        getRunnerAdminMode(auth.user, auth.token),
        getRunnerLaunchStatus(auth.user.id),
      ]);
      if (purchase) {
        return json({ purchased: purchase.status === "active", canPurchase: false }, 409);
      }
      if (adminMode !== "real") {
        return json({ message: "Support purchases are disabled in admin simulation mode." }, 409);
      }
      if (!launch.eligible) {
        return json({ message: "The launch support offer is not available for this account." }, 409);
      }
      const intent = await createRunnerSupportIntent({
        userId: auth.user.id,
        provider: body.data.provider,
        productId,
      });
      return json({
        canPurchase: true,
        intentId: intent.id,
        productId,
        expiresAt: intent.expires_at,
      });
    }

    const verified = await verifyRevenueCatSupportPurchase({
      userId: auth.user.id,
      provider: body.data.provider,
      productId,
      transactionId: body.data.action === "sync" ? body.data.transactionId : null,
    });
    if (!verified) return json({ purchased: false, verified: false }, 404);
    const claimed = await claimRunnerSupportPurchase({
      ...verified,
      userId: auth.user.id,
      intentId: body.data.action === "sync" ? body.data.intentId : null,
    });
    if (!claimed) return json({ purchased: false, verified: true }, 409);
    return json({ purchased: true, verified: true });
  } catch (error) {
    if (error instanceof RunnerSupportIntentConflictError) {
      return json({ message: "Another support purchase is already pending." }, 409);
    }
    console.error("Unable to process runner support purchase", error);
    return json({ message: "Support purchase verification is unavailable." }, 503);
  }
}
