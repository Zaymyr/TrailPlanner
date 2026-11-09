import { useEffect, useId, useState } from "react";

import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { OrganizerSponsor } from "./types";

type SlotKey = "equipment" | "lodging";
type SlotMode = "affiliate" | "partner" | "hidden";

export type OrganizerPartnerSlot = {
  slot: SlotKey;
  label: string;
  affiliatePartner: string;
  mode: SlotMode;
  sponsorId: string | null;
  headline: string | null;
  impressionCount: number;
  clickCount: number;
};

type SlotsResponse = { slots: OrganizerPartnerSlot[]; partnersOptionAvailable: boolean };

const slotHelp: Record<SlotKey, string> = {
  equipment: "Carte affichée sous le matériel obligatoire (onglet Matériel).",
  lodging: "Carte d’hébergement affichée après tes services (onglet Services).",
};

/**
 * Partner slots: each one shows a Pace Yourself affiliate link by default.
 * With Signature, the organizer replaces it with one of their sponsors or
 * hides it. Draft changes reach runners at the next publication.
 */
export function PartnerSlotsEditor({
  editionId,
  authHeaders,
  sponsors,
  onToast,
}: {
  editionId: string;
  authHeaders: Record<string, string>;
  sponsors: OrganizerSponsor[];
  onToast: (type: "success" | "error", message: string) => void;
}) {
  const formId = useId();
  const [state, setState] = useState<SlotsResponse | null>(null);
  const [headlines, setHeadlines] = useState<Partial<Record<SlotKey, string>>>({});
  const [busySlot, setBusySlot] = useState<SlotKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/organizer/editions/${editionId}/partner-slots`, { headers: authHeaders, cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as (SlotsResponse & { message?: string }) | null;
        if (cancelled) return;
        if (!response.ok || !data?.slots) {
          onToast("error", data?.message ?? "Impossible de charger les emplacements partenaires.");
          return;
        }
        setState(data);
      })
      .catch(() => !cancelled && onToast("error", "Impossible de charger les emplacements partenaires."));
    return () => { cancelled = true; };
  }, [authHeaders, editionId, onToast]);

  const save = async (slot: SlotKey, body: Record<string, unknown>) => {
    setBusySlot(slot);
    try {
      const response = await fetch(`/api/organizer/editions/${editionId}/partner-slots`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ slot, ...body }),
      });
      const data = (await response.json().catch(() => null)) as (SlotsResponse & { message?: string }) | null;
      if (!response.ok || !data?.slots) {
        onToast("error", data?.message ?? "Impossible d’enregistrer cet emplacement.");
        return;
      }
      setState(data);
      setHeadlines((current) => ({ ...current, [slot]: undefined }));
    } finally {
      setBusySlot(null);
    }
  };

  if (!state) return <p className="text-sm text-muted-foreground">Chargement des emplacements partenaires…</p>;

  return (
    <section className="space-y-3 rounded-lg border border-border p-4" aria-labelledby={`${formId}-title`}>
      <div className="space-y-1">
        <h3 id={`${formId}-title`} className="font-semibold text-foreground">Emplacements partenaires</h3>
        <p className="text-sm text-muted-foreground">
          Par défaut, ces emplacements affichent un lien Decathlon ou Booking.com proposé par Pace Yourself.
          {state.partnersOptionAvailable
            ? " Remplace-les par tes propres partenaires ou masque-les : la modification sera visible à la prochaine publication."
            : " Avec l’offre Signature, tu peux les remplacer par tes propres partenaires ou les masquer. Tu peux préparer ton choix dès maintenant."}
        </p>
      </div>
      {state.slots.map((slot) => {
        const selectValue = slot.mode === "partner" && slot.sponsorId ? `partner:${slot.sponsorId}` : slot.mode;
        const headline = headlines[slot.slot] ?? slot.headline ?? "";
        return (
          <div key={slot.slot} className="grid gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${formId}-${slot.slot}-mode`}>{slot.label}</Label>
              <select
                id={`${formId}-${slot.slot}-mode`}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={selectValue}
                disabled={busySlot === slot.slot}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value.startsWith("partner:")) {
                    void save(slot.slot, { mode: "partner", sponsorId: value.slice("partner:".length), headline: slot.headline });
                  } else {
                    void save(slot.slot, { mode: value });
                  }
                }}
              >
                <option value="affiliate">Lien {slot.affiliatePartner} (Pace Yourself)</option>
                {sponsors.map((sponsor) => <option key={sponsor.id} value={`partner:${sponsor.id}`}>Mon partenaire : {sponsor.name}</option>)}
                <option value="hidden">Masquer cet emplacement</option>
              </select>
              <p className="text-xs text-muted-foreground">{slotHelp[slot.slot]}</p>
            </div>
            {slot.mode === "partner" ? (
              <div className="space-y-1">
                <Label htmlFor={`${formId}-${slot.slot}-headline`}>Texte court (optionnel)</Label>
                <Input
                  id={`${formId}-${slot.slot}-headline`}
                  maxLength={120}
                  value={headline}
                  placeholder="Ex. -10 % pour les coureurs sur présentation du dossard"
                  onChange={(event) => setHeadlines((current) => ({ ...current, [slot.slot]: event.target.value }))}
                  onBlur={() => {
                    if (headlines[slot.slot] === undefined || !slot.sponsorId) return;
                    void save(slot.slot, { mode: "partner", sponsorId: slot.sponsorId, headline: headlines[slot.slot] });
                  }}
                />
                <p className="text-sm font-semibold text-foreground">
                  {slot.impressionCount} vue{slot.impressionCount > 1 ? "s" : ""} · {slot.clickCount} clic{slot.clickCount > 1 ? "s" : ""}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
      {sponsors.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ajoute d’abord un sponsor ci-dessous (logo, nom, site) pour pouvoir le placer ici.</p>
      ) : null}
    </section>
  );
}
