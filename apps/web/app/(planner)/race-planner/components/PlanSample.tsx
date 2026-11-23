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
            Garder mon plan gratuitement
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

/**
 * Banner above the preview: what is ready and what to do with it. The visitor has a single save action
 * (sticky bar + locked-plan card), so the banner carries no button for them.
 */
export function PlanSampleBanner({
  audience,
  raceName,
  unlockHref,
}: {
  audience: SampleAudience;
  raceName: string | null;
  unlockHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
          {audience === "visitor" ? "Ton plan · aperçu gratuit" : "Aperçu gratuit de ton plan"}
        </p>
        <p className="text-base font-bold text-foreground">
          {raceName ? `${raceName} : ton départ et ton 1er ravito sont prêts` : "Ton départ et ton 1er ravito sont prêts"}
        </p>
        <p className="text-sm text-muted-foreground">
          On a choisi des produits pour ton allure. Change-les ou ajuste les quantités : tout se recalcule en direct.
          {audience === "free" ? " Tes réglages du 1er ravito restent sur cet appareil jusqu’au déblocage." : ""}
        </p>
      </div>
      {audience === "free" ? (
        <Link href={(unlockHref ?? "/premium") as Route} className={`${secondaryClassName} shrink-0`}>
          Débloquer tout le plan
        </Link>
      ) : null}
    </div>
  );
}

/** Sticky bottom bar of the visitor preview: the plan only lives in this browser until an account exists. */
export function VisitorPlanSaveBar({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
          <span className="font-semibold">Garde ton plan pour le jour J.</span>{" "}
          <span className="hidden text-muted-foreground sm:inline">Compte gratuit : retrouve-le sur ton téléphone, même sans réseau.</span>
        </p>
        <button
          type="button"
          onClick={onCreateAccount}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
        >
          Garder mon plan
        </button>
      </div>
    </div>
  );
}

/** Desktop side panel of the visitor preview: the race recap and a way out, no competing save button. */
export function VisitorPlanRecap({
  raceName,
  distanceLabel,
  elevationLabel,
  durationLabel,
  aidStationCount,
  onChooseAnotherRace,
}: {
  raceName: string | null;
  distanceLabel: string;
  elevationLabel: string;
  durationLabel: string;
  aidStationCount: number;
  onChooseAnotherRace: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["Distance", distanceLabel],
    ["Dénivelé", elevationLabel],
    ["Temps estimé", durationLabel],
    ["Ravitos", aidStationCount > 0 ? String(aidStationCount) : "—"],
  ];
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Ta course</p>
        {raceName ? <p className="text-base font-bold text-foreground">{raceName}</p> : null}
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-muted/50 px-3 py-2">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="text-sm font-bold tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Ton plan vit dans ce navigateur pour l’instant. Garde-le avec un compte gratuit pour le retrouver dans l’app.
      </p>
      <button type="button" onClick={onChooseAnotherRace} className={`${secondaryClassName} sm:w-full`}>
        Choisir une autre course
      </button>
    </div>
  );
}
