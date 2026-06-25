import type { FormEvent, ReactNode } from 'react';

import { AidStationBadge } from '../../../../components/race-planner/AidStationBadge';
import { ChevronDownIcon, ChevronUpIcon } from '../../../../components/race-planner/TimelineIcons';
import { Button } from '../../../../components/ui/button';
import { cn } from '../../../../components/utils';
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
          <p className="text-sm text-muted-foreground">Vue ravitos compacte, avec produits et details dans la meme carte.</p>
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
        <div className="space-y-4">
          {aidStations.map((station, index) => {
            const key = station.id ?? `new-${index}`;
            const isExpanded = expandedStationKey === key;
            const productCount = station.id ? stationProducts.filter((link) => link.aidStationId === station.id).length : 0;
            const details = station.organizerDetails;

            return (
              <article
                key={key}
                className={cn(
                  "overflow-hidden rounded-[1.5rem] border bg-card shadow-sm transition",
                  isExpanded ? "border-brand-border bg-brand-surface/20 shadow-[0_12px_30px_-18px_rgba(16,185,129,0.55)]" : "border-border"
                )}
              >
                <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <AidStationBadge step={index + 1} variant="ravito" />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-foreground">{station.name || `Ravito ${index + 1}`}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatKm(station.distanceKm)}
                            {details.cutoffTime ? ` - Barriere ${details.cutoffTime}` : " - Barriere a definir"}
                          </p>
                        </div>
                        {!station.id ? (
                          <span className="rounded-full border border-dashed border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            A sauvegarder
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StationMetaChip>{formatKm(station.distanceKm)}</StationMetaChip>
                        <StationMetaChip>D+ {formatOptionalMeters(details.cumulativeElevationGainM)}</StationMetaChip>
                        <StationMetaChip>D- {formatOptionalMeters(details.cumulativeElevationLossM)}</StationMetaChip>
                        <StationMetaChip>Barriere {details.cutoffTime?.trim() || "-"}</StationMetaChip>
                        <StationMetaChip>
                          {productCount} produit{productCount > 1 ? "s" : ""}
                        </StationMetaChip>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StationServiceChip
                          checked={station.waterRefill}
                          label="Eau disponible"
                          disabled={status === "saving"}
                          onChange={(checked) => onUpdateStation(index, { ...station, waterRefill: checked })}
                        />
                        <StationServiceChip
                          checked={station.solidRefill}
                          label="Solide disponible"
                          disabled={status === "saving"}
                          onChange={(checked) => onUpdateStation(index, { ...station, solidRefill: checked })}
                        />
                        <StationServiceChip
                          checked={station.assistanceAllowed}
                          label="Assistance"
                          disabled={status === "saving"}
                          onChange={(checked) => onUpdateStation(index, { ...station, assistanceAllowed: checked })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-full px-4 text-xs font-semibold"
                      onClick={() => {
                        if (station.id) onOpenProductPicker(station.id);
                      }}
                      disabled={!station.id || status === "saving"}
                    >
                      Ajouter un produit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 w-10 rounded-full border border-border bg-background p-0"
                      onClick={() => onExpandedStationKeyChange(isExpanded ? null : key)}
                      aria-label={isExpanded ? "Replier le ravito" : "Deplier le ravito"}
                      title={isExpanded ? "Replier le ravito" : "Deplier le ravito"}
                    >
                      {isExpanded ? <ChevronUpIcon className="h-4 w-4" aria-hidden /> : <ChevronDownIcon className="h-4 w-4" aria-hidden />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700 hover:bg-red-100"
                      onClick={() => onRemoveStation(index)}
                    >
                      Retirer
                    </Button>
                  </div>
                </div>

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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StationDetailsPanel({ station, onChange, productsSlot }: { station: AidStationDraft; onChange: (station: AidStationDraft) => void; productsSlot: ReactNode }) {
  const details = station.organizerDetails;
  return (
    <div className="border-t border-border px-4 pb-4 pt-1">
      <div className="grid gap-3 rounded-[1.25rem] border border-dashed border-brand-border/70 bg-background/80 p-4 lg:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <TextField label="Nom du ravito" value={station.name} onChange={(value) => onChange({ ...station, name: value })} required />
        </div>
        <NumberField label="Distance km" value={station.distanceKm} step="0.1" onChange={(value) => onChange({ ...station, distanceKm: value })} />
        <NumberField
          label="D+ cumule"
          value={details.cumulativeElevationGainM ?? 0}
          step="1"
          onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cumulativeElevationGainM: value } })}
        />
        <NumberField
          label="D- cumule"
          value={details.cumulativeElevationLossM ?? 0}
          step="1"
          onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cumulativeElevationLossM: value } })}
        />
        <div className="xl:col-span-2">
          <TextField
            label="Barriere horaire"
            value={details.cutoffTime ?? ""}
            onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cutoffTime: value || null } })}
          />
        </div>
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-border bg-background p-4">
        <p className="text-sm font-semibold text-foreground">Infos secondaires</p>
        <p className="mt-1 text-xs text-muted-foreground">Type de point, altitude optionnelle, sac de delestage et note organisateur.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Type</label>
            <select
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={details.stationType}
              onChange={(event) =>
                onChange({
                  ...station,
                  organizerDetails: { ...details, stationType: event.target.value as AidStationType },
                })
              }
            >
              {Object.entries(aidStationTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <NumberField
            label="Altitude optionnelle"
            value={details.altitudeM ?? 0}
            step="1"
            onChange={(value) => onChange({ ...station, organizerDetails: { ...details, altitudeM: value } })}
          />
          <div className="flex items-end">
            <ToggleChip
              checked={details.dropBagAvailable}
              label="Sac de delestage"
              onChange={(checked) => onChange({ ...station, organizerDetails: { ...details, dropBagAvailable: checked } })}
            />
          </div>
          <div className="md:col-span-3">
            <TextAreaField
              label="Note organisateur"
              value={details.organizerNote ?? station.notes ?? ""}
              onChange={(value) => onChange({ ...station, notes: value, organizerDetails: { ...details, organizerNote: value || null } })}
            />
          </div>
        </div>
      </div>

      <div className="mt-4">{productsSlot}</div>
    </div>
  );
}

function StationMetaChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">{children}</span>;
}

function StationServiceChip({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        checked ? "border-brand-border bg-background text-foreground" : "border-border bg-background text-muted-foreground",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded border-border"
      />
      <span>{label}</span>
    </label>
  );
}

function formatOptionalMeters(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value} m`;
}
