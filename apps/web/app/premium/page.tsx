"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { useI18n } from "../i18n-provider";
import { Button } from "../../components/ui/button";

type Offer = "annual" | "course";
export default function PremiumPage() {
  const { session } = useVerifiedSession();
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [planId, setPlanId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [prices, setPrices] = useState<Partial<Record<Offer, string>>>({});
  const [opening, setOpening] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("planId");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setPlanId(id);
    const controller = new AbortController();
    fetch("/api/runner/config", { signal: controller.signal, cache: "no-store" }).then((r) => r.json()).then((data) => setEnabled(data.enabled === true)).catch(() => {});
    for (const offer of ["annual", "course"] as const) {
      fetch(`/api/stripe/price?offer=${offer}`, { signal: controller.signal, cache: "no-store" }).then(async (r) => {
        if (!r.ok) return;
        const { price } = await r.json();
        if (typeof price?.unitAmount !== "number" || typeof price.currency !== "string") return;
        const formatted = new Intl.NumberFormat(locale, { style: "currency", currency: price.currency }).format(price.unitAmount / 100);
        setPrices((previous) => ({ ...previous, [offer]: formatted }));
      }).catch(() => {});
    }
    return () => controller.abort();
  }, [locale]);
  async function purchase(offer: Offer) {
    if (!session?.accessToken || session.isAnonymous || !enabled || opening) return;
    setOpening(offer); setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify({ offer, ...(offer === "course" ? { planId } : {}) }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.message || (fr ? "Paiement indisponible." : "Checkout unavailable."));
      // Same-tab checkout avoids popup blockers. Access is granted only by the verified webhook.
      window.location.assign(data.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : (fr ? "Paiement indisponible." : "Checkout unavailable.")); setOpening(null); }
  }
  return <div className="mx-auto max-w-4xl space-y-8 py-8">
    <div className="space-y-3 text-center"><h1 className="text-3xl font-semibold">{fr ? "Prépare ta course dans les détails" : "Prepare every detail of your race"}</h1>
      <p className="text-muted-foreground">{fr ? "Ton estimation est gratuite. Débloque tes allures, tes ravitos et ton plan nutrition pour le jour J." : "Your estimate is free. Unlock pacing, aid stations and race-day nutrition."}</p></div>
    <div className="grid gap-6 sm:grid-cols-2">{(["course", "annual"] as const).map((offer) => <section key={offer} className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">{offer === "course" ? (fr ? "Cette course" : "This race") : (fr ? "Toutes mes courses" : "All my races")}</h2>
      <p className="text-3xl font-semibold">{prices[offer] ?? (offer === "course" ? "9,99 €" : "29,99 €")}{offer === "annual" ? (fr ? "/an" : "/year") : ""}</p>
      <p className="text-muted-foreground">{offer === "course" ? (fr ? "Paiement unique. Accès durable à ce format pour cette édition." : "One-time payment. Lasting access to this distance and edition.") : (fr ? "Abonnement annuel renouvelable. Plus avantageux dès 4 courses par an." : "Auto-renewing annual subscription. Better value from 4 races per year.")}</p>
      <ul className="list-inside list-disc space-y-2 text-sm"><li>{fr ? "Allures ajustables section par section" : "Adjustable pacing by section"}</li><li>{fr ? "Produits et quantités ravito par ravito" : "Products and quantities at each aid station"}</li><li>{fr ? "Récapitulatif, assistance et exports" : "Summary, crew support and exports"}</li></ul>
      {session && !session.isAnonymous ? <Button onClick={() => { void purchase(offer); }} disabled={!enabled || !prices[offer] || opening !== null || (offer === "course" && !planId)}>{opening === offer ? (fr ? "Ouverture…" : "Opening…") : offer === "course" ? (fr ? "Débloquer cette course" : "Unlock this race") : (fr ? "Choisir l’abonnement annuel" : "Choose annual subscription")}</Button> : <Link href="/sign-up" className="font-semibold text-brand underline">{fr ? "Créer mon compte" : "Create my account"}</Link>}
      {offer === "course" && !planId ? <p className="text-sm"><Link href="/race-planner" className="underline">{fr ? "Choisis d’abord la course à débloquer." : "First choose the race to unlock."}</Link></p> : null}
    </section>)}</div>
    {!enabled ? <p role="status" className="text-center text-muted-foreground">{fr ? "Les nouvelles offres sont en cours de préparation." : "The new offers are being prepared."}</p> : null}
    {error ? <p role="alert" className="text-red-600">{error}</p> : null}
    <p className="text-sm text-muted-foreground">{fr ? "Les achats sont rattachés à ton compte et accessibles sur le web, Android et iOS. Après expiration de l’abonnement, tes plans préparés restent consultables ; leur modification nécessite un achat ou un réabonnement." : "Purchases belong to your account across web, Android and iOS. After a subscription expires, prepared plans remain readable; editing requires a purchase or resubscription."}</p>
  </div>;
}
