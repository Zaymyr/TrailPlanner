"use client";

import { useEffect } from "react";

import { readStoredSession } from "../lib/auth-storage";
import { clearPendingCheckout, readPendingCheckout, type PendingCheckout } from "../lib/checkout-return";
import { fetchEntitlements } from "../lib/entitlements-client";
import { trackRunnerPurchaseVerified } from "../lib/product-analytics";

const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 2500;

async function isPurchaseActive(pending: PendingCheckout, accessToken: string, signal: AbortSignal): Promise<boolean> {
  if (pending.offer === "annual") {
    const entitlements = await fetchEntitlements(accessToken, signal);
    return entitlements.isPremium && (entitlements.subscriptionStatus === "active" || entitlements.subscriptionStatus === "trialing");
  }
  if (!pending.planId) return false;
  const response = await fetch(`/api/plans/${pending.planId}/access`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });
  if (!response.ok) return false;
  const payload = (await response.json().catch(() => null)) as { access?: { hasPlanUnlock?: boolean; source?: string } } | null;
  return payload?.access?.hasPlanUnlock === true && payload.access.source === "plan_unlock";
}

/**
 * Emits `premium purchase verified` / `runner course purchase verified` once the runner returns
 * from Stripe (`?billing=success`) and the webhook-backed entitlement is visible (polled briefly,
 * as the webhook can land after the redirect). Never fires from the return URL alone.
 */
export function CheckoutReturnTracker() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("billing") !== "success") return undefined;
    const pending = readPendingCheckout();
    const accessToken = readStoredSession()?.accessToken;
    if (!pending || !accessToken) return undefined;

    const controller = new AbortController();
    let timer: number | null = null;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        if (await isPurchaseActive(pending, accessToken, controller.signal)) {
          if (controller.signal.aborted) return;
          trackRunnerPurchaseVerified({ offer: pending.offer, sourceRace: pending.sourceRace });
          clearPendingCheckout();
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      if (attempts < MAX_ATTEMPTS && !controller.signal.aborted) timer = window.setTimeout(check, RETRY_DELAY_MS);
    };
    void check();

    return () => {
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
