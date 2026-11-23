"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { rememberPendingCheckout } from "../../lib/checkout-return";
import { trackPremiumPaywallViewed, trackRunnerCheckoutStarted } from "../../lib/product-analytics";
import { readFunnelSourceRace } from "../../lib/race-funnel-source";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { type RunnerOffer, useRunnerPrice } from "../hooks/useRunnerPrice";
import { useI18n } from "../i18n-provider";
import { PremiumSections } from "./PremiumSections";
import { PREMIUM_COPY } from "./premium-copy";
import { orderRunnerOffers, resolvePlanCourseName, type SavedPlanSummary } from "./offer-presentation";

const isUuid = (value: string | null): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

export default function PremiumPage() {
  const { session } = useVerifiedSession();
  const { locale } = useI18n();
  const fr = locale === "fr";
  const copy = PREMIUM_COPY[fr ? "fr" : "en"];
  const annualPrice = useRunnerPrice("annual", locale);
  const coursePrice = useRunnerPrice("course", locale);
  const [planId, setPlanId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [opening, setOpening] = useState<RunnerOffer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("planId");
    setPlanId(isUuid(candidate) ? candidate : null);

    const controller = new AbortController();
    fetch("/api/runner/config", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setEnabled(data.enabled === true))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!planId || !session?.accessToken || session.isAnonymous) {
      setCourseName(null);
      return;
    }

    const controller = new AbortController();
    fetch("/api/plans", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (controller.signal.aborted || !Array.isArray(payload?.plans)) return;
        const plan = payload.plans.find((candidate: SavedPlanSummary) => candidate.id === planId) as SavedPlanSummary | undefined;
        setCourseName(resolvePlanCourseName(plan));
      })
      .catch(() => {});

    return () => controller.abort();
  }, [planId, session?.accessToken, session?.isAnonymous]);

  const paywallTrackedRef = useRef(false);
  useEffect(() => {
    if (paywallTrackedRef.current) return;
    paywallTrackedRef.current = true;
    trackPremiumPaywallViewed({
      placement: "premium_page",
      hasPlanContext: new URLSearchParams(window.location.search).has("planId"),
      sourceRace: readFunnelSourceRace(),
    });
  }, []);

  const offers = useMemo<RunnerOffer[]>(
    () => orderRunnerOffers(Boolean(planId)),
    [planId],
  );

  async function purchase(offer: RunnerOffer) {
    if (!session?.accessToken || session.isAnonymous || !enabled || opening) return;
    setOpening(offer);
    setError(null);
    try {
      const sourceRace = readFunnelSourceRace();
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ offer, ...(offer === "course" ? { planId } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.message || (fr ? "Paiement indisponible." : "Checkout unavailable."));
      }
      trackRunnerCheckoutStarted({ offer, placement: "premium_page", sourceRace });
      rememberPendingCheckout({ offer, sourceRace, planId: offer === "course" ? planId : null });
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (fr ? "Paiement indisponible." : "Checkout unavailable."));
      setOpening(null);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-10 px-4 py-8 sm:px-0">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold leading-tight">
          {courseName ? copy.heroTitleRace(courseName) : copy.heroTitle}
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">{copy.heroSub}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {offers.map((offer) => {
          const price = offer === "course" ? coursePrice : annualPrice;
          const needsPlan = offer === "course" && !planId;
          const unavailable = price.status === "unavailable";
          const disabled = !enabled || price.status !== "available" || opening !== null || needsPlan;
          const disabledReason = needsPlan
            ? null
            : unavailable
              ? (fr ? "Ce prix n’est pas configuré. L’achat reste désactivé pour éviter un montant incorrect." : "This price is not configured. Checkout stays disabled to avoid an incorrect amount.")
              : !enabled
                ? (fr ? "Les nouvelles offres sont en cours de préparation." : "The new offers are being prepared.")
                : price.status === "loading"
                  ? (fr ? "Le prix fourni par Stripe est en cours de chargement." : "The Stripe price is loading.")
                  : null;

          return (
            <section key={offer} className="space-y-5 rounded-2xl border border-border bg-card p-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">
                  {offer === "course"
                    ? (courseName ? copy.courseTitleRace(courseName) : copy.courseTitle)
                    : copy.annualTitle}
                </h2>
                <p className="text-sm font-medium text-brand">
                  {offer === "course" ? copy.courseTag : copy.annualTag}
                </p>
              </div>
              <p className="text-3xl font-semibold" aria-live="polite">
                {price.status === "available"
                  ? `${price.formatted}${offer === "annual" ? (fr ? "/an" : "/year") : ""}`
                  : price.status === "loading"
                    ? (fr ? "Chargement du prix…" : "Loading price…")
                    : (fr ? "Prix indisponible" : "Price unavailable")}
              </p>
              <ul className="space-y-2 text-sm">
                {(offer === "course" ? copy.courseBullets : copy.annualBullets).map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span aria-hidden="true" className="font-bold text-brand">✓</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              {needsPlan ? (
                <div className="space-y-2">
                  <Link
                    href="/race-planner"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-brand-foreground shadow-sm hover:bg-brand-light"
                  >
                    {copy.chooseRaceCta}
                  </Link>
                  <p className="text-sm text-muted-foreground">{copy.chooseRaceHint}</p>
                </div>
              ) : session && !session.isAnonymous ? (
                <Button
                  className="min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
                  onClick={() => { void purchase(offer); }}
                  disabled={disabled}
                  aria-describedby={disabledReason ? `${offer}-disabled-reason` : undefined}
                >
                  {opening === offer
                    ? (fr ? "Ouverture…" : "Opening…")
                    : offer === "course" ? copy.courseCta : copy.annualCta}
                </Button>
              ) : (
                <Link
                  href="/sign-up"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-brand-foreground shadow-sm hover:bg-brand-light"
                >
                  {copy.anonymousCta}
                </Link>
              )}
              {disabledReason ? (
                <p id={`${offer}-disabled-reason`} className="text-sm text-muted-foreground">
                  {disabledReason}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      {error ? <p role="alert" className="text-red-600">{error}</p> : null}
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
        {copy.reassurance.map((line) => (
          <li key={line} className="flex items-center gap-2">
            <span aria-hidden="true" className="font-bold text-brand">✓</span>
            {line}
          </li>
        ))}
      </ul>

      <PremiumSections copy={copy} />
    </div>
  );
}
