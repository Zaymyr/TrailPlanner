import type { FormEvent, ReactNode } from 'react';

import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import type { AidStationType } from '../../../../lib/organizer-dashboard-details';
import type { FuelProduct } from '../../../../lib/product-types';
import { aidStationTypeLabels } from './constants';
import { NumberField, TextAreaField, TextField, ToggleChip } from './controls';
import { formatKm } from './helpers';
import { StationProductsBlock } from './products-editor';
import type { AidStationDraft, ProductFormValues, RaceFormat, StationProduct } from './types';

export function AidStationsEditor({
  activeRace,
  aidStations,
  expandedStationKey,
  onExpandedStationKeyChange,
  onAddStation,
  onSave,
  onUpdateStation,
  onRemoveStation,
  stationProducts,
  productsById,
  productForm,
  productStationId,
  onOpenProductPicker,
  onRemoveProduct,
  onToggleProductForm,
  onProductFormChange,
  onCreateProduct,
  status,
}: {
  activeRace: RaceFormat | null;
  aidStations: AidStationDraft[];
  expandedStationKey: string | null;
  onExpandedStationKeyChange: (key: string | null) => void;
  onAddStation: () => void;
  onSave: () => void;
  onUpdateStation: (index: number, station: AidStationDraft) => void;
  onRemoveStation: (index: number) => void;
  stationProducts: StationProduct[];
  productsById: Map<string, FuelProduct>;
  productForm: ProductFormValues;
  productStationId: string | null;
  onOpenProductPicker: (stationId: string) => void;
  onRemoveProduct: (stationId: string, productId: string) => void;
  onToggleProductForm: (stationId: string) => void;
  onProductFormChange: (values: ProductFormValues) => void;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  if (!activeRace) return <p className="text-sm text-muted-foreground">Selectionne un format pour gerer ses ravitos.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{activeRace.name}</p>
          <p className="text-sm text-muted-foreground">Saisie rapide en tableau, details par ligne.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onAddStation}>
            Ajouter un ravito
          </Button>
          <Button type="button" onClick={onSave} disabled={status === "saving"}>
            Sauvegarder les ravitos
          </Button>
        </div>
      </div>

      {aidStations.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Aucun ravito.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordre</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Km</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Barriere</TableHead>
              <TableHead>Produits</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aidStations.map((station, index) => {
              const key = station.id ?? `new-${index}`;
              const isExpanded = expandedStationKey === key;
              const productCount = station.id ? stationProducts.filter((link) => link.aidStationId === station.id).length : 0;
              return (
                <TableRow key={key} className="align-top">
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="min-w-52">
                    <Input value={station.name} onChange={(event) => onUpdateStation(index, { ...station, name: event.target.value })} />
                    {isExpanded ? (
                      <StationDetailsPanel
                        station={station}
                        onChange={(next) => onUpdateStation(index, next)}
                        productsSlot={
                          station.id ? (
                            <StationProductsBlock
                              station={station}
                              stationProducts={stationProducts}
                              productsById={productsById}
                              onOpenProductPicker={() => onOpenProductPicker(station.id as string)}
                              onRemoveProduct={(productId) => onRemoveProduct(station.id as string, productId)}
                              productFormOpen={productStationId === station.id}
                              onToggleProductForm={() => onToggleProductForm(station.id as string)}
                              productForm={productForm}
                              onProductFormChange={onProductFormChange}
                              onCreateProduct={onCreateProduct}
                              disabled={status === "saving"}
                            />
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">Sauvegarde le ravito avant d'y ajouter des produits.</p>
                          )
                        }
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-28">
                    <Input
                      type="number"
                      step="0.1"
                      value={station.distanceKm}
                      onChange={(event) => onUpdateStation(index, { ...station, distanceKm: Number(event.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      className="h-10 rounded-md border border-border bg-card px-3 text-sm"
                      value={station.organizerDetails.stationType}
                      onChange={(event) =>
                        onUpdateStation(index, {
                          ...station,
                          organizerDetails: { ...station.organizerDetails, stationType: event.target.value as AidStationType },
                        })
                      }
                    >
                      {Object.entries(aidStationTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>{station.organizerDetails.cutoffTime || "-"}</TableCell>
                  <TableCell>{productCount}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" onClick={() => onExpandedStationKeyChange(isExpanded ? null : key)}>
                        {isExpanded ? "Fermer" : "Details"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => onRemoveStation(index)}>
                        Retirer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function StationDetailsPanel({ station, onChange, productsSlot }: { station: AidStationDraft; onChange: (station: AidStationDraft) => void; productsSlot: ReactNode }) {
  const details = station.organizerDetails;
  return (
    <div className="mt-3 grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-3">
      <NumberField
        label="D+ cumule"
        value={details.cumulativeElevationGainM ?? 0}
        onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cumulativeElevationGainM: value } })}
      />
      <NumberField
        label="D- cumule"
        value={details.cumulativeElevationLossM ?? 0}
        onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cumulativeElevationLossM: value } })}
      />
      <NumberField
        label="Altitude"
        value={details.altitudeM ?? 0}
        onChange={(value) => onChange({ ...station, organizerDetails: { ...details, altitudeM: value } })}
      />
      <TextField
        label="Heure fermeture / barriere"
        value={details.cutoffTime ?? ""}
        onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cutoffTime: value || null } })}
      />
      <div className="flex items-end">
        <ToggleChip
          checked={details.dropBagAvailable}
          label="Sac de delestage"
          onChange={(checked) => onChange({ ...station, organizerDetails: { ...details, dropBagAvailable: checked } })}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <ToggleChip checked={station.waterRefill} label="Eau" onChange={(checked) => onChange({ ...station, waterRefill: checked })} />
        <ToggleChip checked={station.solidRefill} label="Solide" onChange={(checked) => onChange({ ...station, solidRefill: checked })} />
        <ToggleChip checked={station.assistanceAllowed} label="Assistance" onChange={(checked) => onChange({ ...station, assistanceAllowed: checked })} />
      </div>
      <div className="md:col-span-3">
        <TextAreaField
          label="Note organisateur"
          value={details.organizerNote ?? station.notes ?? ""}
          onChange={(value) => onChange({ ...station, notes: value, organizerDetails: { ...details, organizerNote: value || null } })}
        />
      </div>
      <div className="md:col-span-3">{productsSlot}</div>
    </div>
  );
}
