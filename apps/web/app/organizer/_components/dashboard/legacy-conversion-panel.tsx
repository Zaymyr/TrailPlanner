import { useState } from "react";

import { Button } from "../../../../components/ui/button";
import type { OrganizerLegacyBlock } from "../../../../lib/organizer-legacy-conversion";

type Props<T> = {
  eventId: string;
  editionId: string;
  headers: HeadersInit;
  block: OrganizerLegacyBlock;
  text: string;
  onApply: (proposal: T) => void;
};

const labels: Record<string, string> = {
  amenities: "Services", water: "Eau", sweet: "Sucré", savory: "Salé", hotMeal: "Repas chaud", dropBag: "Sac d’allègement", toilets: "Toilettes",
  maxStopMinutes: "Arrêt maximum", supportersAccess: "Accès accompagnants", cutoffTime: "Heure limite", cutoffDayOffset: "Jour de la barrière", note: "Note",
  parkings: "Parkings", shuttleLines: "Navettes", name: "Nom", address: "Adresse", capacity: "Capacité", paid: "Payant", from: "Départ", to: "Arrivée", startTime: "Début", endTime: "Fin", frequencyMinutes: "Fréquence", bookingUrl: "Réservation", free: "Gratuite",
  requiredDocumentKinds: "Documents requis", requiredDocumentsOther: "Autre document", thirdPartyPickupAllowed: "Retrait par un tiers", thirdPartyDocumentKinds: "Documents tiers", thirdPartyDocumentsOther: "Autre document tiers",
  startArea: "Zone de départ", opensAt: "Ouverture", briefing: "Briefing", date: "Date", time: "Heure", location: "Lieu", videoUrl: "Vidéo", mandatory: "Obligatoire", rules: "Règles", regulationUrl: "Règlement", polesAllowed: "Bâtons", cupRequired: "Gobelet obligatoire", musicAllowed: "Musique autorisée", outsideAssistanceForbidden: "Assistance extérieure interdite",
  checkpoints: "Contrôles", shortNote: "Note courte",
};

function rows(value: unknown, path = ""): Array<{ label: string; value: string }> {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item !== "object" || item === null)) return [{ label: labels[path] ?? path, value: value.length ? value.join(", ") : "—" }];
    return value.flatMap((item, index) => rows(item, `${path} ${index + 1}`));
  }
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => rows(item, path ? `${path} · ${labels[key] ?? key}` : (labels[key] ?? key)));
  return [{ label: labels[path] ?? path, value: value === null || value === "" ? "—" : typeof value === "boolean" ? (value ? "Oui" : "Non") : String(value) }];
}

export function LegacyConversionPanel<T>({ eventId, editionId, headers, block, text, onApply }: Props<T>) {
  const [proposal, setProposal] = useState<T | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const convert = async () => {
    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch(`/api/organizer/events/${eventId}/website-import`, {
        method: "POST",
        headers: { ...Object.fromEntries(new Headers(headers).entries()), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert-legacy-block", editionId, block, text }),
      });
      const payload = await response.json().catch(() => null) as { proposal?: T; message?: string } | null;
      if (!response.ok || !payload?.proposal) throw new Error(payload?.message ?? "Conversion impossible.");
      setProposal(payload.proposal);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Conversion impossible.");
    }
  };

  if (!proposal) return <div className="mt-3"><Button type="button" variant="outline" disabled={status === "loading"} onClick={() => void convert()}>{status === "loading" ? "Conversion…" : "Proposer une conversion"}</Button>{message ? <p className="mt-2 text-sm text-red-700" role="alert">{message}</p> : null}</div>;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-brand-border bg-background p-3">
      <p className="text-sm font-semibold">Proposition à vérifier</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">{rows(proposal).map((row, index) => <div key={`${row.label}-${index}`}><dt className="font-medium text-muted-foreground">{row.label}</dt><dd className="break-words text-foreground">{row.value}</dd></div>)}</dl>
      <p className="text-xs text-muted-foreground">Rien ne sera enregistré tant que tu n’auras pas appliqué puis sauvegardé le formulaire.</p>
      <div className="flex gap-2"><Button type="button" onClick={() => { onApply(proposal); setProposal(null); }}>Appliquer</Button><Button type="button" variant="ghost" onClick={() => setProposal(null)}>Ignorer</Button></div>
    </div>
  );
}
