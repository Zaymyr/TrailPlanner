import type { OrganizerSocialProof } from "../../lib/organizer-social-proof";

export const formatProofCount = (value: number) => value.toLocaleString("fr-FR");

export function ProofLogo({ proof, className }: { proof: OrganizerSocialProof; className: string }) {
  return proof.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proof.logoUrl}
      alt={`Logo ${proof.eventName}`}
      loading="lazy"
      className={`shrink-0 rounded-2xl border border-border bg-white ${proof.logoSource === "event" ? "object-cover" : "object-contain p-1"} ${className}`}
    />
  ) : (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-2xl bg-brand text-lg font-semibold text-brand-foreground dark:bg-emerald-400 dark:text-slate-950 ${className}`}>
      {proof.eventName.charAt(0)}
    </span>
  );
}
