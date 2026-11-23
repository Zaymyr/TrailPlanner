"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import type { OrganizerAdminData } from "./useOrganizerAdminData";

/** « Fonctionnalités pouvant être offertes »: catalog of the modules the admin may gift outside a pack. */
export function FeatureCatalogCard({ data }: { data: OrganizerAdminData }) {
  const { featureCatalog, status, saveFeatureAvailability } = data;
  return (
    <Card className="rounded-lg">
      <CardHeader><CardTitle>Fonctionnalités pouvant être offertes</CardTitle><CardDescription>Activez les fonctionnalités que l’administration peut offrir hors du pack sélectionné.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {featureCatalog.map((feature) => <div key={feature.feature_key} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">{feature.label}</p>
            <p className="text-xs text-muted-foreground">{feature.minimum_tier === "complete" ? "Complet" : "Signature"}</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={feature.is_active}
              disabled={status !== "idle"}
              onChange={(event) => {
                void saveFeatureAvailability({ ...feature, is_active: event.target.checked });
              }}
            />
            Disponible
          </label>
        </div>)}
      </CardContent>
    </Card>
  );
}
