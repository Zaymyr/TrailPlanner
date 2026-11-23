import React from "react";
import Link from "next/link";

const STEPS = [
  { title: "Choisis ta course", description: "Cherche-la dans le catalogue ou importe ta trace GPX." },
  { title: "Ton temps et tes passages", description: "Une estimation en 30 secondes, avec ton heure de passage à chaque ravito." },
  { title: "Ton plan ravito par ravito", description: "Ce que tu manges, bois et emportes, du départ à l’arrivée." },
] as const;

const BENEFITS = [
  { title: "Pas de coup de barre", description: "Glucides, eau et sodium calculés pour ton allure, pour éviter le « bonk »." },
  { title: "Les quantités à emporter", description: "Combien de gels, de barres et de boisson dans ton sac, ravito après ravito." },
  { title: "Tes proches au bon endroit", description: "Les heures de passage se partagent avec ton assistance grâce à la fiche dédiée." },
] as const;

const primaryButtonClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-base font-semibold text-brand-foreground transition hover:bg-brand-light sm:w-auto";
const secondaryButtonClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-brand-border bg-card px-5 text-base font-semibold text-brand transition hover:bg-brand-surface sm:w-auto";

/** Static illustration of a plan result: not computed, not a real race. */
function PlanExample() {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-sm" aria-label="Exemple de plan de course">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <p className="text-sm font-semibold text-brand">Ton plan de course</p>
        <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Exemple</span>
      </div>
      <ul className="space-y-2 p-4">
        <li className="rounded-xl bg-card px-3 py-3">
          <p className="text-sm font-semibold text-foreground">Ravito 1 · Chaponost · km 11</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Passage <span className="font-semibold tabular-nums text-foreground">1 h 24</span> · 2 gels + 500 ml
          </p>
        </li>
        <li className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-card/60 px-3 py-3">
          <p className="text-sm font-semibold text-muted-foreground">Ravito 2 · km 18</p>
          <span className="text-sm text-muted-foreground">
            <span aria-hidden>🔒</span> Plan complet
          </span>
        </li>
      </ul>
    </div>
  );
}

/**
 * Landing content of /race-planner when no race is selected: promise, 3 steps, an illustrative plan
 * and the free / full-plan split. Purely presentational; the parent wires the two actions.
 */
export function PlannerLanding({ onBrowseRaces, onImportGpx }: { onBrowseRaces: () => void; onImportGpx: () => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
      <section className="grid gap-8 md:grid-cols-2 md:items-center" aria-labelledby="planner-landing-heading">
        <div className="space-y-4">
          <h2 id="planner-landing-heading" className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            Ton plan de course, ravito par ravito
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Ton temps estimé en 30 secondes, gratuit et sans compte. Puis ce que tu manges, bois et emportes à chaque ravito.
          </p>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button type="button" onClick={onBrowseRaces} className={primaryButtonClassName}>
              Choisir ma course
            </button>
            <button type="button" onClick={onImportGpx} className={secondaryButtonClassName}>
              J’ai mon fichier GPX
            </button>
          </div>
        </div>
        <PlanExample />
      </section>

      <section className="space-y-4" aria-labelledby="planner-landing-steps">
        <h2 id="planner-landing-steps" className="text-2xl font-semibold text-foreground">Comment ça marche</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-surface text-sm font-bold text-brand">{index + 1}</span>
              <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4" aria-labelledby="planner-landing-benefits">
        <h2 id="planner-landing-benefits" className="text-2xl font-semibold text-foreground">Ce que ça change le jour J</h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-base font-semibold text-foreground">{benefit.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{benefit.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Gratuit, puis plan complet</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          L’estimation de ton temps, ton départ et ton premier ravito sont gratuits. Le plan complet (tous les ravitos, fiche à
          imprimer, fiche assistance) se débloque ensuite.
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
          <Link href="/premium" className="inline-flex min-h-11 items-center text-brand underline-offset-4 hover:underline">
            Voir le plan complet
          </Link>
          <Link href="/methodologie" className="inline-flex min-h-11 items-center text-brand underline-offset-4 hover:underline">
            Comment on calcule
          </Link>
        </p>
      </section>
    </div>
  );
}
