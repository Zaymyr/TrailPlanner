import Link from "next/link";
import type { Route } from "next";

import type { OrganizerSocialProof } from "../../lib/organizer-social-proof";
import type { HomeLandingCopy } from "./home-copy";
import { formatProofCount, ProofLogo } from "./ProofLogo";

type HomeProofStripProps = {
  proofs: OrganizerSocialProof[];
  copy: HomeLandingCopy["proofStrip"];
};

/** Compact proof reusing the published organizer social proofs; renders nothing without data. */
export function HomeProofStrip({ proofs, copy }: HomeProofStripProps) {
  const proof = proofs[0];
  if (!proof) return null;

  return (
    <Link
      href={"/organisateurs#preuve-sociale" as Route}
      className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-card/90 p-4 shadow-sm transition hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:gap-5 dark:border-emerald-400/25"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ProofLogo proof={proof} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-brand dark:text-emerald-200">{copy.label}</p>
          <p className="truncate text-sm font-semibold text-foreground">{proof.eventName}</p>
        </div>
      </div>
      <dl className="flex flex-1 flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <div className="flex items-baseline gap-1.5">
          <dd className="text-lg font-semibold text-foreground">{formatProofCount(proof.uniqueReaders)}</dd>
          <dt>{copy.readers}</dt>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dd className="text-lg font-semibold text-foreground">{formatProofCount(proof.totalOpens)}</dd>
          <dt>{copy.opens}</dt>
        </div>
      </dl>
      <span className="text-sm font-semibold text-brand underline-offset-4 dark:text-emerald-200">{copy.link}</span>
    </Link>
  );
}
