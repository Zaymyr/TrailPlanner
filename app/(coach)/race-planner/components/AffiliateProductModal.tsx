"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";

export type AffiliateProduct = {
  id: string;
  name: string;
  carbs: number;
  sodium: number;
};

export type AffiliateOffer = {
  id: string;
  merchant: string;
  countryCode: string | null;
  affiliateUrl: string;
};

type RaceTotals = {
  fuelGrams: number;
  sodiumMg: number;
};

type Logger = {
  logPopupOpen: (
    sessionId: string,
    payload: { productId: string; offerId?: string; country?: string | null; merchant?: string | null }
  ) => Promise<unknown>;
  logClick: (
    sessionId: string,
    payload: { productId: string; offerId?: string; country?: string | null; merchant?: string | null }
  ) => Promise<unknown>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  displayName: string;
  countryCode?: string | null;
  sessionId?: string | null;
  logger?: Logger;
  totals?: RaceTotals | null;
};

type ResponseBody = {
  product: AffiliateProduct;
  offer: AffiliateOffer;
};

const formatUnits = (value: number) => Math.max(0, Math.ceil(value));

export function AffiliateProductModal({
  open,
  onClose,
  slug,
  displayName,
  countryCode,
  sessionId,
  logger,
  totals,
}: Props) {
  const enabled = open;
  const lastLoggedKey = useRef<string | null>(null);

  const query = useQuery<ResponseBody>({
    queryKey: ["affiliate-product", slug, countryCode ?? "all"],
    queryFn: async () => {
      const search = countryCode ? `?country=${countryCode}` : "";
      const response = await fetch(`/api/affiliate/products/${slug}${search}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load product");
      }
      return (await response.json()) as ResponseBody;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!open || !query.data || !sessionId || !logger) return;

    const uniqueKey = `${sessionId}:${query.data.product.id}:${query.data.offer.id}:popup`;
    if (lastLoggedKey.current === uniqueKey) return;
    lastLoggedKey.current = uniqueKey;

    logger
      .logPopupOpen(sessionId, {
        productId: query.data.product.id,
        offerId: query.data.offer.id,
        country: query.data.offer.countryCode,
        merchant: query.data.offer.merchant,
      })
      .catch(() => {
        lastLoggedKey.current = null;
      });
  }, [logger, open, query.data, sessionId]);

  const recommendation = useMemo(() => {
    if (!totals || !query.data) return null;
    const carbsUnits = query.data.product.carbs > 0 ? totals.fuelGrams / query.data.product.carbs : 0;
    const sodiumUnits = query.data.product.sodium > 0 ? totals.sodiumMg / query.data.product.sodium : 0;
    const recommended = Math.max(formatUnits(carbsUnits), formatUnits(sodiumUnits));

    return {
      carbsUnits: formatUnits(carbsUnits),
      sodiumUnits: formatUnits(sodiumUnits),
      recommended,
    };
  }, [query.data, totals]);

  const handleCta = async () => {
    if (!query.data?.offer) return;
    if (sessionId && logger) {
      await logger.logClick(sessionId, {
        productId: query.data.product.id,
        offerId: query.data.offer.id,
        country: query.data.offer.countryCode,
        merchant: query.data.offer.merchant,
      });
    }

    window.open(`/api/affiliate/${query.data.offer.id}`, "_blank", "noreferrer");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg">
        <Card className="border border-slate-800 bg-slate-900 text-slate-50">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{displayName}</CardTitle>
              <p className="mt-1 text-sm text-slate-400">{query.data?.product.name ?? displayName}</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-md border border-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            {query.isLoading && <p className="text-sm text-slate-400">Loading product...</p>}
            {query.isError && <p className="text-sm text-red-400">Unable to load product details.</p>}
            {query.data && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
                  <div>
                    <p className="text-slate-400">Carbs</p>
                    <p className="font-semibold text-slate-50">{query.data.product.carbs.toFixed(0)} g</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Sodium</p>
                    <p className="font-semibold text-slate-50">{query.data.product.sodium.toFixed(0)} mg</p>
                  </div>
                </div>

                {recommendation && (
                  <div className="space-y-1 rounded-lg border border-emerald-800/50 bg-emerald-950/50 p-3 text-sm text-emerald-100">
                    <p className="font-semibold text-emerald-200">Recommendation</p>
                    <p>Carbs: {recommendation.carbsUnits} units</p>
                    <p>Sodium: {recommendation.sodiumUnits} units</p>
                    <p className="text-emerald-300">Suggested total: {recommendation.recommended} units</p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-slate-100">Offer</p>
                  <p className="text-slate-300">Merchant: {query.data.offer.merchant}</p>
                  {query.data.offer.countryCode && (
                    <p className="text-slate-400">Country: {query.data.offer.countryCode}</p>
                  )}
                </div>

                <Button className="w-full" onClick={handleCta} disabled={query.isError || query.isLoading}>
                  Visit offer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
