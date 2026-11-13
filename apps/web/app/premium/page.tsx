"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/ui/button";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { type RunnerOffer, useRunnerPrice } from "../hooks/useRunnerPrice";
import { useI18n } from "../i18n-provider";
import { orderRunnerOffers, resolvePlanCourseName, type SavedPlanSummary } from "./offer-presentation";

const isUuid = (value: string | null): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

export default function PremiumPage() {
  const { session } = useVerifiedSession();
  const { locale } = useI18n();
  const fr = locale === "fr";
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

  const offers = useMemo<RunnerOffer[]>(
    () => orderRunnerOffers(Boolean(planId)),
    [planId],
  );

  async function purchase(offer: RunnerOffer) {
    if (!session?.accessToken || session.isAnonymous || !enabled || opening) return;
    setOpening(offer);
    setError(null);
    try {
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
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (fr ? "Paiement indisponible." : "Checkout unavailable."));
      setOpening(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold">
          {courseName
            ? (fr ? `Prépare ${courseName} dans les détails` : `Prepare ${courseName} in detail`)
            : (fr ? "Prépare tes courses dans les détails" : "Prepare every race in detail")}
        </h1>
        <p className="text-muted-foreground">
          {fr
            ? "Ton estimation est gratuite. Débloque les allures, les ravitos et le plan nutrition qui correspondent à ton objectif."
            : "Your estimate is free. Unlock the pacing, aid stations and nutrition plan for your goal."}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {offers.map((offer) => {
          const price = offer === "course" ? coursePrice : annualPrice;
          const needsPlan = offer === "course" && !planId;
          const unavailable = price.status === "unavailable";
          const disabled = !enabled || price.status !== "available" || opening !== null || needsPlan;
          const disabledReason = needsPlan
            ? (fr ? "Choisis d’abord une course pour obtenir l’offre qui lui correspond." : "Choose a race first to see its matching offer.")
            : unavailable
              ? (fr ? "Ce prix n’est pas configuré. L’achat reste désactivé pour éviter un montant incorrect." : "This price is not configured. Checkout stays disabled to avoid an incorrect amount.")
              : !enabled
                ? (fr ? "Les nouvelles offres sont en cours de préparation." : "The new offers are being prepared.")
                : price.status === "loading"
                  ? (fr ? "Le prix fourni par Stripe est en cours de chargement." : "The Stripe price is loading.")
                  : null;

          return (
            <section key={offer} className="space-y-5 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold">
                {offer === "course"
                  ? (courseName ? (fr ? `Cette course — ${courseName}` : `This race — ${courseName}`) : (fr ? "Cette course" : "This race"))
                  : (fr ? "Toutes mes courses" : "All my races")}
              </h2>
              <p className="text-3xl font-semibold" aria-live="polite">
                {price.status === "available"
                  ? `${price.formatted}${offer === "annual" ? (fr ? "/an" : "/year") : ""}`
                  : price.status === "loading"
                    ? (fr ? "Chargement du prix…" : "Loading price…")
                    : (fr ? "Prix indisponible" : "Price unavailable")}
              </p>
              <p className="text-muted-foreground">
                {offer === "course"
                  ? (fr ? "Paiement unique. Accès durable à ce format pour cette édition." : "One-time payment. Lasting access to this distance and edition.")
                  : (fr ? "Abonnement annuel renouvelable pour préparer toutes tes courses." : "Auto-renewing annual subscription for all your races.")}
              </p>
              <ul className="list-inside list-disc space-y-2 text-sm">
                <li>{fr ? "Allures ajustables section par section" : "Adjustable pacing by section"}</li>
                <li>{fr ? "Produits et quantités ravito par ravito" : "Products and quantities at each aid station"}</li>
                <li>{fr ? "Récapitulatif, assistance et exports" : "Summary, crew support and exports"}</li>
              </ul>

              {session && !session.isAnonymous ? (
                <Button
                  className="min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
                  onClick={() => { void purchase(offer); }}
                  disabled={disabled}
                  aria-describedby={disabledReason ? `${offer}-disabled-reason` : undefined}
                >
                  {opening === offer
                    ? (fr ? "Ouverture…" : "Opening…")
                    : offer === "course"
                      ? (fr ? "Débloquer cette course" : "Unlock this race")
                      : (fr ? "Passer à l’abonnement annuel" : "Choose annual access")}
                </Button>
              ) : (
                <Link
                  href="/sign-up"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-brand-foreground shadow-sm hover:bg-brand-light"
                >
                  {fr ? "Créer mon compte" : "Create my account"}
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
      <p className="text-sm text-muted-foreground">
        {fr
          ? "Les achats sont rattachés à ton compte et accessibles sur le web, Android et iOS. Après expiration de l’abonnement, tes plans préparés restent consultables ; leur modification nécessite un achat ou un réabonnement."
          : "Purchases belong to your account across web, Android and iOS. After a subscription expires, prepared plans remain readable; editing requires a purchase or resubscription."}
      </p>
    </div>
  );
}
