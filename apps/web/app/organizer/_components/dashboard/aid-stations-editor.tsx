import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { AidStationBadge } from "../../../../components/race-planner/AidStationBadge";
import { ChevronDownIcon, ChevronUpIcon } from "../../../../components/race-planner/TimelineIcons";
import { Button } from "../../../../components/ui/button";
import { TabsList } from "../../../../components/ui/tabs";
import { cn } from "../../../../components/utils";
import type { FuelProduct } from "../../../../lib/product-types";
import { NumberField, TextAreaField, TextField } from "./controls";
import { formatKm } from "./helpers";
import { StationProductsBlock } from "./products-editor";
import type {
  AidStationDraft,
  ProductFormValues,
  RaceFormat,
  RaceParticipationMode,
  RelayPointDraft,
  StationProduct,
} from "./types";

type EditorView = "aidStations" | "relay";

export function AidStationsEditor({
  activeRace,
  aidStations,
  participationMode,
  relayPoints,
  startTime,
  finishCutoffTime,
  expandedStationKey,
  onExpandedStationKeyChange,
  onAddStation,
  onAddRelayPoint,
  onStartTimeChange,
  onFinishCutoffTimeChange,
  onUpdateStation,
  onRemoveStation,
  onUpdateRelayPoint,
  onRemoveRelayPoint,
  onToggleStationRelayPoint,
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
  participationMode: RaceParticipationMode | "";
  relayPoints: RelayPointDraft[];
  startTime: string;
  finishCutoffTime: string;
  expandedStationKey: string | null;
  onExpandedStationKeyChange: (key: string | null) => void;
  onAddStation: () => void;
  onAddRelayPoint: () => void;
  onStartTimeChange: (value: string) => void;
  onFinishCutoffTimeChange: (value: string) => void;
  onUpdateStation: (index: number, station: AidStationDraft) => void;
  onRemoveStation: (index: number) => void;
  onUpdateRelayPoint: (index: number, point: RelayPointDraft) => void;
  onRemoveRelayPoint: (index: number) => void;
  onToggleStationRelayPoint: (station: AidStationDraft, checked: boolean) => void;
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
  const [viewState, setViewState] = useState<{ scopeKey: string; view: EditorView }>({
    scopeKey: "",
    view: "aidStations",
  });
  const relayEnabled = participationMode === "relay" || participationMode === "solo_and_relay";
  const viewScopeKey = `${activeRace?.id ?? ""}:${participationMode}`;

  useEffect(() => {
    setViewState({ scopeKey: viewScopeKey, view: "aidStations" });
  }, [viewScopeKey]);

  if (!activeRace) return <p className="text-sm text-muted-foreground">Sélectionne un format pour gérer ses ravitos.</p>;
  const activeView = relayEnabled && viewState.scopeKey === viewScopeKey ? viewState.view : "aidStations";
  const sortedRelayPoints = [...relayPoints].sort((left, right) => left.distanceKm - right.distanceKm);
  const relayBoundaries = [
    { name: "Départ", distanceKm: 0 },
    ...sortedRelayPoints,
    { name: "Arrivée", distanceKm: activeRace.distance_km },
  ];

  return (
    <div className="relative space-y-4">
      <div className="flex flex-wrap justify-end gap-2 md:absolute md:-top-[4.75rem] md:right-0">
        {activeView === "aidStations" ? (
          <Button type="button" variant="outline" onClick={onAddStation}>
            Ajouter un ravito
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onAddRelayPoint}>
            Ajouter un point de relais
          </Button>
        )}
      </div>

      {relayEnabled ? (
        <TabsList
          tabs={[
            { id: "aidStations", label: "Ravitos" },
            { id: "relay", label: "Relais" },
          ]}
          activeTab={activeView}
          onTabChange={(view) => setViewState({ scopeKey: viewScopeKey, view: view as EditorView })}
        />
      ) : null}

      {activeView === "aidStations" ? (
        <>
          <FixedCourseCard
            title="Départ"
            subtitle="Heure de départ commune à ce format."
            value={startTime}
            label="Heure de départ"
            onChange={onStartTimeChange}
          />

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
                        <p className="min-w-0 truncate text-lg font-semibold text-foreground">{station.name || `Ravito ${index + 1}`}</p>
                        {!station.id ? <span className="rounded-full border border-dashed border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">À sauvegarder</span> : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StationMetaChip>{formatKm(station.distanceKm)}</StationMetaChip>
                        <StationMetaChip>D+ {formatOptionalMeters(details.cumulativeElevationGainM)}</StationMetaChip>
                        <StationMetaChip>D- {formatOptionalMeters(details.cumulativeElevationLossM)}</StationMetaChip>
                        <StationMetaChip>Barrière {details.cutoffTime?.trim() || "-"}</StationMetaChip>
                        <StationMetaChip>
                          {productCount} produit{productCount > 1 ? "s" : ""}
                        </StationMetaChip>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StationServiceChip checked={station.waterRefill} label="Eau disponible" disabled={status === "saving"} onChange={(checked) => onUpdateStation(index, { ...station, waterRefill: checked })} />
                        <StationServiceChip checked={station.solidRefill} label="Solide disponible" disabled={status === "saving"} onChange={(checked) => onUpdateStation(index, { ...station, solidRefill: checked })} />
                        <StationServiceChip checked={station.assistanceAllowed} label="Assistance" disabled={status === "saving"} onChange={(checked) => onUpdateStation(index, { ...station, assistanceAllowed: checked })} />
                        {relayEnabled ? (
                          <StationServiceChip
                            checked={Boolean(station.id && relayPoints.some((point) => point.raceAidStationId === station.id))}
                            label="Point de relais"
                            disabled={!station.id || status === "saving"}
                            onChange={(checked) => onToggleStationRelayPoint(station, checked)}
                          />
                        ) : null}
                        <StationServiceChip
                          checked={details.dropBagAvailable}
                          label="Sac de délestage"
                          disabled={status === "saving"}
                          onChange={(checked) => onUpdateStation(index, { ...station, organizerDetails: { ...details, dropBagAvailable: checked } })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button type="button" variant="outline" className="h-10 rounded-full px-4 text-xs font-semibold" onClick={() => station.id && onOpenProductPicker(station.id)} disabled={!station.id || status === "saving"}>
                      Ajouter un produit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 w-10 rounded-full border border-border bg-background p-0"
                      onClick={() => onExpandedStationKeyChange(isExpanded ? null : key)}
                      aria-label={isExpanded ? "Replier le ravito" : "Déplier le ravito"}
                      title={isExpanded ? "Replier le ravito" : "Déplier le ravito"}
                    >
                      {isExpanded ? <ChevronUpIcon className="h-4 w-4" aria-hidden /> : <ChevronDownIcon className="h-4 w-4" aria-hidden />}
                    </Button>
                    <Button type="button" variant="ghost" className="h-10 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700 hover:bg-red-100" onClick={() => onRemoveStation(index)}>
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
                        <p className="mt-3 text-xs text-muted-foreground">Sauvegarde le ravito avant d&apos;y ajouter des produits.</p>
                      )
                    }
                  />
                ) : null}
                  </article>
                );
              })}
            </div>
          )}

          <FixedCourseCard
            title="Arrivée"
            subtitle="Barrière horaire d'arrivée de ce format."
            value={finishCutoffTime}
            label="Barrière horaire d'arrivée"
            onChange={onFinishCutoffTimeChange}
          />
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Tronçons du relais">
            {relayBoundaries.slice(0, -1).map((boundary, index) => {
              const nextBoundary = relayBoundaries[index + 1];
              return (
                <div
                  key={`${boundary.name}-${nextBoundary.name}-${index}`}
                  className="flex min-w-fit shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">T{index + 1}</span>
                  <span className="whitespace-nowrap text-xs font-semibold text-foreground">{boundary.name} → {nextBoundary.name}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{formatKm(Math.max(0, nextBoundary.distanceKm - boundary.distanceKm))}</span>
                </div>
              );
            })}
          </div>

          <section className="space-y-4 rounded-[1.5rem] border border-brand-border/70 bg-brand-surface/20 p-4">
            <div>
              <p className="font-semibold text-foreground">Points et tronçons du relais</p>
              <p className="text-sm text-muted-foreground">Les tronçons sont construits automatiquement entre le départ, les points triés par kilomètre et l&apos;arrivée.</p>
            </div>

            {relayPoints.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Aucun point de relais : le Racebook indiquera un seul tronçon sur toute la course.</p>
            ) : (
              <div className="space-y-3">
                {relayPoints.map((point, index) => {
                  const linkedStation = point.raceAidStationId ? aidStations.find((station) => station.id === point.raceAidStationId) : null;
                  return (
                    <article key={point.id ?? `relay-${index}`} className="rounded-xl border border-border bg-background p-4">
                      <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_minmax(10rem,1fr)_2.5rem]">
                        <TextField label="Nom du point" value={point.name} onChange={(value) => onUpdateRelayPoint(index, { ...point, name: value })} disabled={Boolean(linkedStation)} />
                        <NumberField label="Distance km" value={point.distanceKm} onChange={(value) => onUpdateRelayPoint(index, { ...point, distanceKm: value })} disabled={Boolean(linkedStation)} />
                        <TextField label="Barrière horaire" value={point.cutoffTime} onChange={(value) => onUpdateRelayPoint(index, { ...point, cutoffTime: value })} />
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-10 w-10 shrink-0 px-0 text-red-600 hover:text-red-700"
                          onClick={() => onRemoveRelayPoint(index)}
                          aria-label={`Retirer ${point.name || "ce point de relais"}`}
                          title="Retirer"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
                            <path d="M3.2 4.3 4.3 3.2 8 6.9l3.7-3.7 1.1 1.1L9.1 8l3.7 3.7-1.1 1.1L8 9.1l-3.7 3.7-1.1-1.1L6.9 8 3.2 4.3Z" />
                          </svg>
                        </Button>
                      </div>
                      {linkedStation ? <p className="mt-2 text-xs text-muted-foreground">Lié au ravito {linkedStation.name}. Le nom et le kilomètre suivent ce ravito.</p> : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function FixedCourseCard({
  title,
  subtitle,
  value,
  label,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="w-full md:max-w-sm">
          <TextField label={label} value={value} onChange={onChange} />
        </div>
      </div>
    </section>
  );
}

function StationDetailsPanel({ station, onChange, productsSlot }: { station: AidStationDraft; onChange: (station: AidStationDraft) => void; productsSlot: ReactNode }) {
  const details = station.organizerDetails;
  return (
    <div className="border-t border-border px-4 pb-4 pt-1">
      <div className="grid gap-3 rounded-[1.25rem] border border-dashed border-brand-border/70 bg-background/80 p-4 lg:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <TextField label="Nom du ravito" value={station.name} onChange={(value) => onChange({ ...station, name: value })} required />
        </div>
        <NumberField label="Distance km" value={station.distanceKm} step="0.1" onChange={(value) => onChange({ ...station, distanceKm: value })} />
        <NumberField label="D+ cumulé" value={details.cumulativeElevationGainM ?? 0} step="1" readOnly onChange={() => undefined} />
        <NumberField label="D- cumulé" value={details.cumulativeElevationLossM ?? 0} step="1" readOnly onChange={() => undefined} />
        <div className="xl:col-span-2">
          <TextField label="Barrière horaire" value={details.cutoffTime ?? ""} onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cutoffTime: value || null } })} />
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">Les cumuls D+ / D- sont calculés automatiquement à partir du tracé GPX de ce format.</p>

      <div className="mt-4 rounded-[1.25rem] border border-border bg-background p-4">
        <TextAreaField label="Note organisateur" value={details.organizerNote ?? station.notes ?? ""} onChange={(value) => onChange({ ...station, notes: value, organizerDetails: { ...details, organizerNote: value || null } })} />
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
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
      <span>{label}</span>
    </label>
  );
}

function formatOptionalMeters(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value} m`;
}
