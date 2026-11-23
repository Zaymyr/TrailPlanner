"use client";

import { useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Label } from "../../../../components/ui/label";
import { ORGANIZER_TIER_PRICE_EUR } from "../../../../lib/organizer-modules";
import { ORGANIZER_FEATURES, giftableOrganizerFeatures, type OrganizerFeatureKey } from "../../../../lib/organizer-features";
import {
  activeTier,
  organizerTierLabel,
  publicationOriginLabel,
  type FeatureCatalogItem,
  type OrganizerTier,
  type PublicationOrigin,
  type RacebookPublicationEvent,
} from "./organizer-admin-model";

const initialOrigin = (event: RacebookPublicationEvent): PublicationOrigin => {
  const currentSource = event.entitlement?.source;
  return currentSource === "stripe" || currentSource === "manual_payment" || currentSource === "complimentary" ? currentSource : "admin";
};

/**
 * « Gérer le pack et les accès » (tab « Pack & modules » of the edition drawer since lot 5, formerly a
 * dialog): pack, origin and modules offered outside the pack. Same fields and same calls as before:
 * PATCH `/api/admin/event-publication-requests` `setEditionGrant`, then one `setEditionCapabilityGrant`
 * per changed module. It bills nothing. The parent remounts it (key) when the stored right changes.
 */
export function EditionPackForm({ accessToken, event, featureCatalog, onSaved }: {
  accessToken: string | null;
  event: RacebookPublicationEvent;
  featureCatalog: FeatureCatalogItem[];
  /** Called after a save attempt that changed something: reload the data, show the warning if any. */
  onSaved: (result: { warning?: string | null }) => Promise<void> | void;
}) {
  const activeFeatures = event.featureGrants.filter((grant) => grant.status === "active").map((grant) => grant.capability_key);
  const [purchaseTier, setPurchaseTier] = useState<OrganizerTier>(() => activeTier(event));
  const [purchaseOrigin, setPurchaseOrigin] = useState<PublicationOrigin>(() => initialOrigin(event));
  const [enabledFeatureGrants, setEnabledFeatureGrants] = useState<OrganizerFeatureKey[]>(activeFeatures);
  const [initialFeatureGrants, setInitialFeatureGrants] = useState<OrganizerFeatureKey[]>(activeFeatures);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setError(null);
    setPurchaseTier(activeTier(event));
    setPurchaseOrigin(initialOrigin(event));
    setEnabledFeatureGrants(activeFeatures);
    setInitialFeatureGrants(activeFeatures);
  };

  const hasSelectedBankTransfer = event.payments.some((payment) => (
    payment.status === "paid"
    && payment.payment_channel === "bank_transfer"
    && payment.to_tier === purchaseTier
  ));

  const recordPurchase = async () => {
    if (!accessToken || !event.editionId) return;
    setSaving(true);
    setError(null);
    try {
      if (purchaseTier !== "visibility" && purchaseOrigin === "manual_payment" && !hasSelectedBankTransfer) {
        setError("Aucun virement réglé ne correspond à ce pack. Créez la facture séparément ou ouvrez les droits avec l’origine Admin.");
        return;
      }
      const response = await fetch("/api/admin/event-publication-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: "setEditionGrant",
          editionId: event.editionId,
          tier: purchaseTier,
          origin: purchaseTier === "visibility" ? "admin" : purchaseOrigin,
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string; warning?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible de modifier le droit de publication.");
        return;
      }
      const changedFeatures = ORGANIZER_FEATURES.filter((feature) => enabledFeatureGrants.includes(feature.key) !== initialFeatureGrants.includes(feature.key));
      for (const feature of changedFeatures) {
        const capabilityResponse = await fetch("/api/admin/event-publication-requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            action: "setEditionCapabilityGrant",
            editionId: event.editionId,
            capabilityKey: feature.key,
            enabled: enabledFeatureGrants.includes(feature.key),
          }),
        });
        const capabilityData = await capabilityResponse.json().catch(() => null) as { message?: string } | null;
        if (!capabilityResponse.ok) {
          setError(capabilityData?.message ?? `Le pack a été enregistré, mais ${feature.label} n’a pas pu être mis à jour.`);
          await onSaved({});
          return;
        }
      }
      setInitialFeatureGrants(enabledFeatureGrants);
      await onSaved({ warning: data?.warning ?? null });
    } catch (caught) {
      console.error("Unable to update organizer publication right", caught);
      setError("Impossible de modifier le droit de publication. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Modifiez le pack et son origine pour {event.name}
        {event.editionYear ? ` · édition ${event.editionYear}` : ""}.
        {event.entitlement?.status === "active"
          ? ` Pack actuellement actif : ${organizerTierLabel[event.entitlement.tier]} — ${publicationOriginLabel[event.entitlement.source]}.`
          : ""}
      </p>
      {error ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium leading-none">Pack accordé</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["visibility", "essential", "complete", "signature"] as const).map((tier) => (
              <label
                key={tier}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                  purchaseTier === tier
                    ? "border-brand bg-brand/10 text-foreground ring-1 ring-brand"
                    : "border-border bg-card text-muted-foreground hover:border-brand/60 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name={`organizer-purchase-tier-${event.editionId ?? event.id}`}
                  value={tier}
                  checked={purchaseTier === tier}
                  onChange={() => setPurchaseTier(tier)}
                  className="h-4 w-4 shrink-0"
                />
                <span>{organizerTierLabel[tier]}</span>
                <span className="ml-auto text-xs font-medium">
                  {tier === "visibility" ? "Gratuit" : `${ORGANIZER_TIER_PRICE_EUR[tier]} € HT`}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {purchaseTier === "visibility" ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
            L’événement restera visible dans le catalogue, mais tous les Livrets coureurs de cette édition seront retirés du public. Les contenus restent enregistrés.
          </p>
        ) : <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="organizer-publication-origin">Origine de la publication</Label>
          <select id="organizer-publication-origin" className="min-h-11 w-full cursor-pointer rounded-md border border-input bg-card px-3 text-sm" value={purchaseOrigin} onChange={(changeEvent) => setPurchaseOrigin(changeEvent.target.value as PublicationOrigin)}>
            <option value="admin">Admin</option>
            <option value="stripe">Paiement Stripe</option>
            <option value="manual_payment">Paiement par virement</option>
            <option value="complimentary">Offert</option>
          </select>
        </div>}
        {purchaseTier !== "visibility" && purchaseOrigin === "stripe" ? (
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Un paiement Stripe valide correspondant à ce pack doit déjà exister dans l’historique.
          </p>
        ) : null}
        {purchaseTier !== "visibility" && purchaseOrigin === "manual_payment" && hasSelectedBankTransfer ? (
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Le virement déjà enregistré pour ce pack sera utilisé.
          </p>
        ) : null}
        <fieldset className="space-y-2 rounded-lg border border-border bg-muted/20 p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-semibold text-foreground">Modules offerts hors pack</legend>
          {ORGANIZER_FEATURES.map((feature) => {
            const giftable = giftableOrganizerFeatures(purchaseTier).some((item) => item.key === feature.key)
              && (featureCatalog.some((item) => item.feature_key === feature.key && item.is_active) || enabledFeatureGrants.includes(feature.key));
            const included = !giftable;
            const checked = included || enabledFeatureGrants.includes(feature.key);
            return <label key={feature.key} className={`flex items-start gap-3 ${included ? "cursor-default opacity-70" : "cursor-pointer"}`}>
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={checked} disabled={included} onChange={(changeEvent) => setEnabledFeatureGrants((current) => changeEvent.target.checked ? Array.from(new Set([...current, feature.key])) : current.filter((key) => key !== feature.key))} />
              <span>
                <span className="block text-sm font-medium text-foreground">{feature.label}</span>
                <span className="block text-xs text-muted-foreground">{included ? `Inclus dans ${feature.minimumTier === "complete" ? "Complet" : "Signature"}` : checked ? "Offert manuellement pour cette édition" : "Non inclus dans ce pack"}</span>
              </span>
            </label>;
          })}
          <p className="text-xs text-muted-foreground">La dérogation reste mémorisée lors d’un changement de pack jusqu’à sa révocation explicite.</p>
        </fieldset>
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          Ce réglage ne facture rien. Factures, virements et règlements se gèrent dans{" "}
          {event.editionId ? <a className="font-semibold text-brand underline-offset-4 hover:underline" href={`/admin/billing?edition=${event.editionId}`}>Ventes & facturation</a> : "Ventes & facturation"}.
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" disabled={saving} onClick={reset}>Annuler les modifications</Button>
        <Button type="button" disabled={saving || !event.editionId} onClick={() => void recordPurchase()}>
          {saving
            ? "Enregistrement…"
            : purchaseTier === "visibility"
              ? "Repasser à Visibilité"
              : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
