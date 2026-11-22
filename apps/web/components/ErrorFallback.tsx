"use client";

import Link from "next/link";
import { useEffect } from "react";

import { reportClientError, type ClientErrorSource } from "../lib/error-reporting";

const primaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground shadow-sm hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const secondaryLinkClass = "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-brand hover:border-brand-border hover:bg-brand-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
  source: ClientErrorSource;
};

// Shared runtime-error UI for app/error.tsx and the segment-level boundaries.
// Copy is French and hardcoded: boundaries must not depend on providers that may have failed.
export function ErrorFallback({ error, reset, source }: ErrorFallbackProps) {
  useEffect(() => {
    reportClientError(error, source);
  }, [error, source]);

  return (
    <div role="alert" className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-16 text-center sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Erreur</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Une erreur est survenue</h1>
      <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
        Quelque chose s&apos;est mal passé de notre côté. Vous pouvez réessayer ou revenir à l&apos;accueil.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className={primaryButtonClass} onClick={() => reset()}>
          Réessayer
        </button>
        <Link className={secondaryLinkClass} href="/">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
