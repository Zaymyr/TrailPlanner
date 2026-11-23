"use client";

import Link from "next/link";
import type { Route } from "next";
import { useId } from "react";

/** Departure + first aid station stay editable in the free preview (same sample as the mobile Livret). */
export const PLAN_SAMPLE_EDITABLE_ITEM_COUNT = 2;
/** Marks the locked-plan CTA; the planner layout renders its content twice (mobile and desktop). */
export const PLAN_SAMPLE_CTA_ATTRIBUTE = "data-plan-sample-cta";

type SampleAudience = "visitor" | "free";

const primaryClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-base font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-light disabled:opacity-60 sm:w-auto";
const secondaryClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-5 text-base font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface sm:w-auto";

const Check = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2">
    <span aria-hidden className="font-bold text-brand">
      ✓
    </span>
    <span>{children}</span>
  </li>
);

/** Scrolls the locked-plan CTA into view (header actions of the preview point to it). */
export function focusPlanSampleCta() {
  const element = Array.from(document.querySelectorAll<HTMLElement>(`[${PLAN_SAMPLE_CTA_ATTRIBUTE}]`)).find(
    (candidate) => candidate.offsetParent !== null,
  );
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.classList.add("ring-4", "ring-brand/40");
  window.setTimeout(() => element.classList.remove("ring-4", "ring-brand/40"), 1600);
}

/**
 * Card shown in the timeline right after the free sample: it names what the rest of the plan holds and
 * leads to the account (visitor) or to the course unlock (free account).
 */
export function PlanSampleLockedCta({
  audience,
  remainingAidStations,
  coursePrice,
  annualPrice,
  onCreateAccount,
  unlockHref,
}: {
  audience: SampleAudience;
  remainingAidStations: number;
  coursePrice: string | null;
  annualPrice: string | null;
  /** Visitor: saves the preview locally and opens sign-up. */
  onCreateAccount?: () => void;
  /** Free account: course unlock page for this plan. */
  unlockHref?: string;
}) {
  const titleId = useId();
  const remainingLabel =
    remainingAidStations > 1
      ? `Tes ${remainingAidStations} autres ravitos t’attendent`
      : remainingAidStations === 1
        ? "Ton prochain ravito t’attend"
        : "La suite de ta course t’attend";

  return (
    <section
      {...{ [PLAN_SAMPLE_CTA_ATTRIBUTE]: "" }}
      aria-labelledby={titleId}
      className="scroll-mt-24 rounded-2xl border-2 border-brand bg-card p-5 shadow-lg transition sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
        {audience === "visitor" ? "Tu as préparé ton 1er ravito" : "Aperçu gratuit terminé"}
      </p>
      <h3 id={titleId} className="mt-1 text-xl font-bold leading-tight text-foreground sm:text-2xl">
        {remainingLabel}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Le plan complet calcule chaque section jusqu’à l’arrivée, pour ne jamais te retrouver à court au mauvais moment.
      </p>
      <ul className="mt-4 grid gap-2 text-sm text-foreground sm:grid-cols-2">
        <Check>Glucides, eau et sodium section par section</Check>
        <Check>Remplissage automatique avec tes produits</Check>
        <Check>Tes heures de passage à chaque ravito</Check>
        <Check>Plan à imprimer pour ton assistance</Check>
        <Check>Ton plan dans l’app, même sans réseau</Check>
        <Check>Ajuste ton allure section par section</Check>
      </ul>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        {audience === "visitor" ? (
          <button type="button" onClick={onCreateAccount} className={primaryClassName}>
            Enregistrer mon plan gratuitement
          </button>
        ) : (
          <Link href={(unlockHref ?? "/premium") as Route} className={primaryClassName}>
            {coursePrice ? `Débloquer cette course · ${coursePrice}` : "Débloquer cette course"}
          </Link>
        )}
        {audience === "free" ? (
          <Link href={(unlockHref ?? "/premium") as Route} className={secondaryClassName}>
            {annualPrice ? `Toutes mes courses · ${annualPrice}/an` : "Toutes mes courses"}
          </Link>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {audience === "visitor"
          ? `Compte gratuit : ton temps, ta course et ton 1er ravito sont gardés. Le plan complet se débloque ensuite${coursePrice ? ` pour ${coursePrice} la course` : ""}.`
          : "Paiement unique pour cette course, sans abonnement. Tes réglages du 1er ravito sont conservés."}
      </p>
    </section>
  );
}

/** Banner above the preview: what is free, what is not, and the next step. */
export function PlanSampleBanner({
  audience,
  raceName,
  onCreateAccount,
  unlockHref,
}: {
  audience: SampleAudience;
  raceName: string | null;
  onCreateAccount?: () => void;
  unlockHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
          {audience === "visitor" ? "Ton plan · aperçu gratuit" : "Aperçu gratuit de ton plan"}
        </p>
        <p className="text-base font-bold text-foreground">
          {raceName ? `${raceName} : prépare ton départ et ton 1er ravito` : "Prépare ton départ et ton 1er ravito"}
        </p>
        <p className="text-sm text-muted-foreground">
          Ajoute tes gels, barres et boissons, ajuste ton allure : tout se recalcule en direct.
          {audience === "free" ? " Tes réglages du 1er ravito restent sur cet appareil jusqu’au déblocage." : ""}
        </p>
      </div>
      {audience === "visitor" ? (
        <button type="button" onClick={onCreateAccount} className={`${secondaryClassName} shrink-0`}>
          Enregistrer mon plan
        </button>
      ) : (
        <Link href={(unlockHref ?? "/premium") as Route} className={`${secondaryClassName} shrink-0`}>
          Débloquer tout le plan
        </Link>
      )}
    </div>
  );
}

/** Sticky bottom bar of the visitor preview: the plan only lives in this browser until an account exists. */
export function VisitorPlanSaveBar({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
          <span className="font-semibold">Ton plan n’est pas encore enregistré.</span>{" "}
          <span className="hidden text-muted-foreground sm:inline">Crée ton compte gratuit pour le retrouver sur le web et dans l’app.</span>
        </p>
        <button
          type="button"
          onClick={onCreateAccount}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}
