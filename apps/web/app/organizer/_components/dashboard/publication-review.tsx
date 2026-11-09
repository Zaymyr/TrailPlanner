import type { RacebookPublicationIssue } from "../../../../lib/racebook-publication-checks";

export type PublicationAffiliateSlot = { slot: "equipment" | "lodging"; label: string; partner: string };

/**
 * Pre-publication review shown in the publish confirmation: blocking quality
 * issues, non-blocking warnings, and partner slots that will show Pace
 * Yourself affiliate links.
 */
export function PublicationReview({
  checks,
  affiliateSlots,
  partnersOptionAvailable,
}: {
  checks: RacebookPublicationIssue[];
  affiliateSlots: PublicationAffiliateSlot[];
  partnersOptionAvailable: boolean;
}) {
  const blocking = checks.filter((issue) => issue.severity === "blocking");
  const warnings = checks.filter((issue) => issue.severity === "warning");
  if (blocking.length === 0 && warnings.length === 0 && affiliateSlots.length === 0) return null;

  return (
    <div className="grid gap-3 text-sm">
      {blocking.length > 0 ? (
        <section className="grid gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3" aria-label="Points bloquants">
          <p className="font-semibold text-destructive">À corriger avant de publier</p>
          <ul className="grid gap-1.5">
            {blocking.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}
          </ul>
        </section>
      ) : null}
      {warnings.length > 0 ? (
        <section className="grid gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950" aria-label="Points à vérifier">
          <p className="font-semibold">À vérifier (la publication reste possible)</p>
          <ul className="grid gap-1.5">
            {warnings.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}
          </ul>
        </section>
      ) : null}
      {affiliateSlots.length > 0 ? (
        <section className="grid gap-1.5 rounded-lg border border-border bg-muted/20 p-3" aria-label="Emplacements partenaires">
          <p className="font-semibold text-foreground">Emplacements partenaires</p>
          <ul className="grid gap-1">
            {affiliateSlots.map((slot) => (
              <li key={slot.slot}>{slot.label} : lien {slot.partner} proposé par Pace Yourself.</li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            {partnersOptionAvailable
              ? "Tu peux les remplacer par tes propres partenaires, ou les masquer, dans la section Sponsors."
              : "Avec l’offre Signature, remplace-les par tes propres partenaires (magasin, hébergement…) ou masque-les."}
          </p>
        </section>
      ) : null}
    </div>
  );
}
