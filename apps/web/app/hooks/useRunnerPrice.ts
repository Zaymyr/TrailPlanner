"use client";

import { useEffect, useState } from "react";

export type RunnerOffer = "annual" | "course";

export type RunnerPriceState =
  | { status: "loading"; formatted: null }
  | { status: "available"; formatted: string }
  | { status: "unavailable"; formatted: null };

type PricePayload = {
  available?: boolean;
  price?: {
    currency?: unknown;
    unitAmount?: unknown;
  } | null;
};

export const formatRunnerPricePayload = (payload: unknown, locale: string): string | null => {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as PricePayload;
  if (candidate.available === false || !candidate.price) return null;
  if (typeof candidate.price.currency !== "string" || typeof candidate.price.unitAmount !== "number") return null;
  if (!Number.isInteger(candidate.price.unitAmount) || candidate.price.unitAmount < 0) return null;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: candidate.price.currency,
    }).format(candidate.price.unitAmount / 100);
  } catch {
    return null;
  }
};

export function useRunnerPrice(offer: RunnerOffer, locale: string): RunnerPriceState {
  const [state, setState] = useState<RunnerPriceState>({ status: "loading", formatted: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", formatted: null });

    fetch(`/api/stripe/price?offer=${offer}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const formatted = formatRunnerPricePayload(payload, locale);
        setState(formatted
          ? { status: "available", formatted }
          : { status: "unavailable", formatted: null });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: "unavailable", formatted: null });
        }
      });

    return () => controller.abort();
  }, [locale, offer]);

  return state;
}
