import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { AidStationBadge } from "../../../../components/race-planner/AidStationBadge";
import { ChevronDownIcon, ChevronUpIcon } from "../../../../components/race-planner/TimelineIcons";
import { Button } from "../../../../components/ui/button";
import { cn } from "../../../../components/utils";
import type { FuelProduct } from "../../../../lib/product-types";
import { ContextualHelp, NumberField, TextAreaField, TextField } from "./controls";
import { ConfirmDialog, SelectField, SwitchRow } from "./form-kit";
import { formatKm, getGpxCoordinateAtDistance, normalizeClockInputValue } from "./helpers";
import { StationProductsBlock } from "./products-editor";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import type {
  AidStationDraft,
  ProductFormValues,
  RaceFormat,
  RaceParticipationMode,
  RelayPointDraft,
  StationProduct,
  SupporterPointDraft,
  GpxPreview,
} from "./types";

type EditorView = "startWaves" | "aidStations" | "supporters" | "relay";

export function AidStationsEditor({
  activeRace,
  aidStations,
  participationMode,
  relayPoints,
  supporterPoints,
  supporterPointsEnabled,
  gpxPreview,
  startTime,
  startWaveCount,
  finishCutoffTime,
  cutoffNote,
  scheduleNote,
  startWavesSlot,
  expandedStationKey,
  onExpandedStationKeyChange,
  onAddStation,
  onAddRelayPoint,
  onAddSupporterPoint,
  onStartTimeChange,
  onFinishCutoffTimeChange,
  onCutoffNoteChange,
  onScheduleNoteChange,
  onUpdateStation,
  onRemoveStation,
  onUpdateRelayPoint,
  onRemoveRelayPoint,
  onUpdateSupporterPoint,
  onRemoveSupporterPoint,
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
  supporterPoints: SupporterPointDraft[];
  supporterPointsEnabled: boolean;
  gpxPreview: GpxPreview | null;
  startTime: string;
  startWaveCount: number;
  finishCutoffTime: string;
  cutoffNote: string;
  scheduleNote: string;
  startWavesSlot: ReactNode;
  expandedStationKey: string | null;
  onExpandedStationKeyChange: (key: string | null) => void;
  onAddStation: (draft: Pick<AidStationDraft, "name" | "distanceKm">) => void;
  onAddRelayPoint: () => void;
  onAddSupporterPoint: () => void;
  onStartTimeChange: (value: string) => void;
  onFinishCutoffTimeChange: (value: string) => void;
  onCutoffNoteChange: (value: string) => void;
  onScheduleNoteChange: (value: string) => void;
  onUpdateStation: (index: number, station: AidStationDraft) => void;
  onRemoveStation: (index: number) => void;
  onUpdateRelayPoint: (index: number, point: RelayPointDraft) => void;
  onRemoveRelayPoint: (index: number) => void;
  onUpdateSupporterPoint: (index: number, point: SupporterPointDraft) => void;
  onRemoveSupporterPoint: (index: number) => void;
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
  const [stationDraft, setStationDraft] = useState<{ name: string; distanceKm: number } | null>(null);
  const [stationDraftTouched, setStationDraftTouched] = useState(false);
  const [pendingStationRemoval, setPendingStationRemoval] = useState<{ index: number; name: string } | null>(null);
  const [mobileStationOpen, setMobileStationOpen] = useState(false);
  const relayEnabled = participationMode === "relay" || participationMode === "solo_and_relay";
  const viewScopeKey = `${activeRace?.id ?? ""}:${participationMode}`;

  useEffect(() => {
    setViewState({ scopeKey: viewScopeKey, view: "aidStations" });
    setStationDraft(null);
    setStationDraftTouched(false);
  }, [viewScopeKey]);

  if (!activeRace) return <p className="text-sm text-muted-foreground">Sélectionne un format pour gérer ses ravitos.</p>;
  const activeView = viewState.scopeKey === viewScopeKey ? viewState.view : "aidStations";
  const sortedRelayPoints = [...relayPoints].sort((left, right) => left.distanceKm - right.distanceKm);
  const relayBoundaries = [
    { name: "Départ", distanceKm: 0 },
    ...sortedRelayPoints,
    { name: "Arrivée", distanceKm: activeRace.distance_km },
  ];
  const courseTimelinePoints = [
    { key: "start", kind: "start" as const, name: "Départ", distanceKm: 0, time: startTime, index: -1 },
    ...aidStations.map((station, index) => ({ key: station.id ?? `new-${index}`, kind: "aid" as const, name: station.name || `Ravito ${index + 1}`, distanceKm: station.distanceKm, time: station.organizerDetails.cutoffTime ?? "", index })),
    ...supporterPoints.map((point, index) => ({ key: point.id ?? `supporter-${index}`, kind: "supporter" as const, name: point.name || `Suivi ${index + 1}`, distanceKm: point.distanceKm ?? 0, time: "", index })),
    ...relayPoints.filter((point) => !point.raceAidStationId).map((point, index) => ({ key: point.id ?? `relay-${index}`, kind: "relay" as const, name: point.name || `Relais ${index + 1}`, distanceKm: point.distanceKm, time: point.cutoffTime, index })),
    { key: "finish", kind: "finish" as const, name: "Arrivée", distanceKm: activeRace.distance_km, time: finishCutoffTime, index: -1 },
  ].sort((left, right) => left.distanceKm - right.distanceKm || (left.kind === "start" ? -1 : right.kind === "finish" ? -1 : 0));
  const selectedAidStationIndex = Math.max(0, aidStations.findIndex((station, index) => (station.id ?? `new-${index}`) === expandedStationKey));
  const selectedAidStation = aidStations[selectedAidStationIndex] ?? null;
  const selectedAidStationKey = selectedAidStation ? selectedAidStation.id ?? `new-${selectedAidStationIndex}` : null;
  const selectedProductsSlot = selectedAidStation?.id ? (
    <StationProductsBlock
      station={selectedAidStation}
      stationProducts={stationProducts}
      productsById={productsById}
      onOpenProductPicker={() => onOpenProductPicker(selectedAidStation.id as string)}
      onRemoveProduct={(productId) => onRemoveProduct(selectedAidStation.id as string, productId)}
      productFormOpen={productStationId === selectedAidStation.id}
      onToggleProductForm={() => onToggleProductForm(selectedAidStation.id as string)}
      productForm={productForm}
      onProductFormChange={onProductFormChange}
      onCreateProduct={onCreateProduct}
      disabled={status === "saving"}
    />
  ) : <p className="mt-3 text-xs text-muted-foreground">Sauvegarde le ravito avant d&apos;y ajouter des produits.</p>;

  return (
    <div className="relative space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Filtrer la ligne de course">
          {([
            ["aidStations", `Ravitos ${aidStations.length}`],
            ["startWaves", `SAS ${startWaveCount}`],
            ...(supporterPointsEnabled ? [["supporters", `Suivi ${supporterPoints.length}`]] : []),
            ...(relayEnabled ? [["relay", `Relais ${relayPoints.length}`]] : []),
          ] as Array<[EditorView, string]>).map(([view, label]) => <button key={view} type="button" aria-pressed={activeView === view} onClick={() => setViewState({ scopeKey: viewScopeKey, view })} className={cn("min-h-10 rounded-full border px-3 text-sm font-semibold transition", activeView === view ? "border-brand bg-brand-surface text-brand" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{label}</button>)}
        </div>
        {activeView !== "startWaves" ? (
          activeView === "aidStations" ? (
            <Button type="button" variant="outline" onClick={() => setStationDraft({ name: "", distanceKm: 0 })}>
              Ajouter un ravito
            </Button>
          ) : activeView === "supporters" ? (
            <Button type="button" variant="outline" onClick={onAddSupporterPoint}>
              Ajouter un point de suivi
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onAddRelayPoint}>
              Ajouter un point de relais
            </Button>
          )
        ) : null}
      </div>

      <div className={cn(activeView === "aidStations" && "grid items-start gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.4fr)]")}>
      <section className="rounded-xl border border-border bg-card p-3 lg:sticky lg:top-3" aria-label="Ligne de course">
        <div className="relative ml-8 border-l-2 border-brand-border pl-5">
          {courseTimelinePoints.map((point) => {
            const station = point.kind === "aid" ? aidStations[point.index] : null;
            const isSelected = point.kind === "aid" && point.key === selectedAidStationKey;
            return <button key={`${point.kind}-${point.key}`} type="button" data-station-index={point.kind === "aid" ? point.index : undefined} aria-selected={point.kind === "aid" ? isSelected : undefined} className={cn("relative flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", isSelected && "bg-brand-surface text-brand")} onKeyDown={(event) => {
              if (point.kind !== "aid" || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
              event.preventDefault();
              const nextIndex = event.key === "ArrowDown" ? Math.min(aidStations.length - 1, point.index + 1) : Math.max(0, point.index - 1);
              const nextStation = aidStations[nextIndex];
              if (!nextStation) return;
              onExpandedStationKeyChange(nextStation.id ?? `new-${nextIndex}`);
              document.querySelector<HTMLElement>(`[data-station-index="${nextIndex}"]`)?.focus();
            }} onClick={() => {
              if (point.kind === "start") setViewState({ scopeKey: viewScopeKey, view: "startWaves" });
              else if (point.kind === "supporter") setViewState({ scopeKey: viewScopeKey, view: "supporters" });
              else if (point.kind === "relay") setViewState({ scopeKey: viewScopeKey, view: "relay" });
              else {
                setViewState({ scopeKey: viewScopeKey, view: "aidStations" });
                if (point.kind === "aid") {
                  onExpandedStationKeyChange(point.key);
                  setMobileStationOpen(true);
                }
              }
            }}><span className={cn("absolute -left-[1.72rem] h-3.5 w-3.5 rounded-full border-2 border-card", point.kind === "start" || point.kind === "finish" ? "bg-brand" : "bg-muted-foreground/45")} aria-hidden="true" /><span className="w-12 shrink-0 font-mono text-xs font-semibold text-muted-foreground">{point.distanceKm.toFixed(1)}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{point.name}</span>{station ? <span className="flex flex-wrap justify-end gap-1 text-[10px] font-bold" aria-label={`Services : ${[station.waterRefill && "eau", station.solidRefill && "solide", station.assistanceAllowed && "assistance"].filter(Boolean).join(", ") || "aucun"}`}>{station.waterRefill ? <span className="rounded bg-brand-surface px-1 text-brand">E<span className="sr-only"> eau</span></span> : null}{station.solidRefill ? <span className="rounded bg-brand-surface px-1 text-brand">S<span className="sr-only"> solide</span></span> : null}{station.assistanceAllowed ? <span className="rounded bg-brand-surface px-1 text-brand">A<span className="sr-only"> assistance</span></span> : null}</span> : null}{point.time ? <span className="font-mono text-xs text-muted-foreground">{normalizeClockInputValue(point.time)}</span> : null}</button>;
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">E eau · S solide · A assistance. Sélectionne un point pour modifier ses détails.</p>
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <TextField label={startWaveCount > 0 ? "Premier départ (piloté par les SAS)" : "Heure de départ"} type="time" value={normalizeClockInputValue(startTime) ?? ""} onChange={onStartTimeChange} disabled={startWaveCount > 0} />
          <TextField label="Barrière finale" type="time" value={normalizeClockInputValue(finishCutoffTime) ?? ""} onChange={onFinishCutoffTimeChange} />
        </div>
      </section>

      {activeView === "startWaves" ? startWavesSlot : activeView === "supporters" ? (
        <SupporterPointsEditor
          activeRace={activeRace}
          aidStations={aidStations}
          gpxPreview={gpxPreview}
          points={supporterPoints}
          status={status}
          onChange={onUpdateSupporterPoint}
          onRemove={onRemoveSupporterPoint}
        />
      ) : activeView === "aidStations" ? (
        <>
          {stationDraft ? (
            <section className="space-y-3 rounded-xl border border-dashed border-brand-border bg-brand-surface/30 p-4">
              <p className="font-semibold text-foreground">Nouveau ravito</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Nom du ravito" value={stationDraft.name} onChange={(name) => setStationDraft((current) => current ? { ...current, name } : current)} invalid={!stationDraft.name.trim()} validationVisible={stationDraftTouched} errorMessage="Indique le nom du ravito." autoFocus />
                <NumberField label="Distance km" value={stationDraft.distanceKm} onChange={(distanceKm) => setStationDraft((current) => current ? { ...current, distanceKm } : current)} emptyWhenZero />
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => {
                  setStationDraftTouched(true);
                  if (!stationDraft.name.trim()) return;
                  onAddStation({ name: stationDraft.name.trim(), distanceKm: stationDraft.distanceKm });
                  setStationDraft(null);
                  setStationDraftTouched(false);
                }}>Enregistrer le ravito</Button>
                <Button type="button" variant="ghost" onClick={() => { setStationDraft(null); setStationDraftTouched(false); }}>Annuler</Button>
              </div>
            </section>
          ) : null}
          {selectedAidStation ? (
            <section className={cn("rounded-xl border border-border bg-card shadow-sm", mobileStationOpen ? "max-lg:fixed max-lg:inset-0 max-lg:z-50 max-lg:overflow-y-auto max-lg:rounded-none" : "max-lg:hidden")} aria-label={`Détails de ${selectedAidStation.name}`}>
              <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <Button type="button" variant="ghost" className="lg:hidden" onClick={() => setMobileStationOpen(false)}>Retour</Button>
                  <div><p className="font-semibold text-foreground">{selectedAidStation.name || `Ravito ${selectedAidStationIndex + 1}`}</p><p className="text-xs text-muted-foreground">{formatKm(selectedAidStation.distanceKm)}</p></div>
                </div>
              </header>
              <StationDetailsPanel station={selectedAidStation} onChange={(next) => onUpdateStation(selectedAidStationIndex, next)} onRemove={() => setPendingStationRemoval({ index: selectedAidStationIndex, name: selectedAidStation.name || `Ravito ${selectedAidStationIndex + 1}` })} productsSlot={selectedProductsSlot} />
            </section>
          ) : null}
          {aidStations.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Aucun ravito.</p>
          ) : null}
          {false ? (
            <div className="space-y-4">
              {aidStations.map((station, index) => {
                if (pendingStationRemoval?.index === index) return null;
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
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 rounded-full border border-border bg-background px-4 text-xs font-semibold"
                      onClick={() => onExpandedStationKeyChange(isExpanded ? null : key)}
                      aria-label={isExpanded ? "Replier le ravito" : "Déplier le ravito"}
                      title={isExpanded ? "Replier le ravito" : "Déplier le ravito"}
                    >
                      {isExpanded ? "Masquer" : "Détails"}
                      {isExpanded ? <ChevronUpIcon className="h-4 w-4" aria-hidden /> : <ChevronDownIcon className="h-4 w-4" aria-hidden />}
                    </Button>
                  </div>
                </div>

                {isExpanded ? (
                  <StationDetailsPanel
                    station={station}
                    onChange={(next) => onUpdateStation(index, next)}
                    onRemove={() => setPendingStationRemoval({ index, name: station.name || `Ravito ${index + 1}` })}
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
          ) : null}
          <section className="grid gap-4 rounded-[1.5rem] border border-border bg-background p-4 md:grid-cols-2">
            <TextAreaField label="Consignes de barrières horaires" value={cutoffNote} onChange={onCutoffNoteChange} />
            <TextAreaField label="Contraintes et consignes de course" value={scheduleNote} onChange={onScheduleNoteChange} />
          </section>
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
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">Points et tronçons du relais</p>
              <ContextualHelp text="Les tronçons sont construits automatiquement entre le départ, les points triés par kilomètre et l’arrivée." />
            </div>

            {relayPoints.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Aucun point de relais : le Livret coureur indiquera un seul tronçon sur toute la course.</p>
            ) : (
              <div className="space-y-3">
                {relayPoints.map((point, index) => {
                  const linkedStation = point.raceAidStationId ? aidStations.find((station) => station.id === point.raceAidStationId) : null;
                  return (
                    <article key={point.id ?? `relay-${index}`} className="rounded-xl border border-border bg-background p-4">
                      <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_2.5rem]">
                        <TextField label="Nom du point" value={point.name} onChange={(value) => onUpdateRelayPoint(index, { ...point, name: value })} disabled={Boolean(linkedStation)} />
                        <NumberField label="Distance km" value={point.distanceKm} onChange={(value) => onUpdateRelayPoint(index, { ...point, distanceKm: value })} disabled={Boolean(linkedStation)} />
                        <TextField label="Barrière horaire" value={point.cutoffTime} onChange={(value) => onUpdateRelayPoint(index, { ...point, cutoffTime: value })} />
                        <TextField label="Heure de transmission" type="time" value={point.handoverTime} onChange={(value) => onUpdateRelayPoint(index, { ...point, handoverTime: value })} />
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
                      {linkedStation ? (
                        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          Lié au ravito {linkedStation.name}
                          <ContextualHelp text="Le nom et le kilomètre sont synchronisés avec ce ravito." />
                        </div>
                      ) : null}
                      <div className="mt-3"><TextAreaField label="Consignes relais" value={point.notes} onChange={(value) => onUpdateRelayPoint(index, { ...point, notes: value })} /></div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
      </div>
      <ConfirmDialog
        open={pendingStationRemoval !== null}
        onOpenChange={(open) => { if (!open) setPendingStationRemoval(null); }}
        title={`Supprimer ${pendingStationRemoval?.name ?? "ce ravito"} ?`}
        description="Le ravito et ses produits associés seront retirés de ce format."
        confirmLabel="Supprimer le ravito"
        onConfirm={() => {
          if (!pendingStationRemoval) return;
          onRemoveStation(pendingStationRemoval.index);
          setPendingStationRemoval(null);
          setMobileStationOpen(false);
        }}
      />
    </div>
  );
}

function SupporterPointsEditor({
  activeRace,
  aidStations,
  gpxPreview,
  points,
  status,
  onChange,
  onRemove,
}: {
  activeRace: RaceFormat;
  aidStations: AidStationDraft[];
  gpxPreview: GpxPreview | null;
  points: SupporterPointDraft[];
  status: "idle" | "loading" | "saving" | "uploading";
  onChange: (index: number, point: SupporterPointDraft) => void;
  onRemove: (index: number) => void;
}) {
  if (points.length === 0) {
    return <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Aucun point de suivi coureur.</p>;
  }

  return (
    <div className="space-y-4">
      {points.map((point, index) => {
        const matchingStationIndex = aidStations.findIndex((station) =>
          station.name.trim() === point.name.trim()
          && point.distanceKm !== null
          && Math.abs(station.distanceKm - point.distanceKm) < 0.001
        );
        const applyCourseAccess = (nextPoint: SupporterPointDraft) => {
          if (!nextPoint.accessOnCourse || nextPoint.distanceKm === null) return nextPoint;
          const coordinate = getGpxCoordinateAtDistance(gpxPreview, nextPoint.distanceKm);
          return {
            ...nextPoint,
            accessLabel: nextPoint.name.trim() || `Point au km ${nextPoint.distanceKm}`,
            latitude: coordinate?.latitude ?? null,
            longitude: coordinate?.longitude ?? null,
            googleMapsUrl: coordinate
              ? `https://www.google.com/maps/dir/?api=1&destination=${coordinate.latitude},${coordinate.longitude}`
              : null,
          };
        };
        const publishable = Boolean(
          point.name.trim()
          && point.distanceKm !== null
          && point.distanceKm >= 0
          && point.distanceKm <= activeRace.distance_km
          && point.latitude !== null
          && point.longitude !== null
          && (point.encouragementAllowed || point.assistanceAllowed)
        );
        return (
          <article key={point.id ?? `supporter-${index}`} className="space-y-4 rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AidStationBadge step={index + 1} variant="ravito" />
                <div>
                  <p className="font-semibold text-foreground">{point.name || `Point supporter ${index + 1}`}</p>
                  <p className="text-xs text-muted-foreground">Position du coureur : {point.distanceKm === null ? "non renseignée" : formatKm(point.distanceKm)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", publishable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                  {publishable ? "Publiable" : "Brouillon incomplet"}
                </span>
                <Button type="button" variant="ghost" className="text-red-700" onClick={() => onRemove(index)}>Retirer</Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor={`supporter-source-${index}`}>Point de course</label>
                <SelectField
                  id={`supporter-source-${index}`}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={matchingStationIndex >= 0 ? String(matchingStationIndex) : ""}
                  options={[
                    { value: "", label: "Créer un nouveau point" },
                    ...aidStations.map((station, stationIndex) => ({
                      value: String(stationIndex),
                      label: `${station.name} · ${formatKm(station.distanceKm)}`,
                    })),
                  ]}
                  onValueChange={(value) => {
                    if (value === "") return;
                    const stationIndex = Number(value);
                    const station = Number.isInteger(stationIndex) ? aidStations[stationIndex] : null;
                    if (!station) return;
                    onChange(index, applyCourseAccess({
                      ...point,
                      name: station.name,
                      distanceKm: station.distanceKm,
                      accessOnCourse: true,
                    }));
                  }}
                />
              </div>
              <TextField label="Nom du point" value={point.name} onChange={(name) => onChange(index, applyCourseAccess({ ...point, name }))} invalid={!point.name.trim()} />
              <TextField
                label="Distance depuis le départ (km)"
                type="number"
                step="0.1"
                value={point.distanceKm === null ? "" : String(point.distanceKm)}
                onChange={(value) => onChange(index, applyCourseAccess({ ...point, distanceKm: value.trim() === "" ? null : Number(value) }))}
                invalid={point.distanceKm === null || point.distanceKm < 0 || point.distanceKm > activeRace.distance_km}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <StationServiceChip checked={point.encouragementAllowed} label="Encouragement autorisé" disabled={status === "saving"} onChange={(checked) => onChange(index, { ...point, encouragementAllowed: checked })} />
              <StationServiceChip checked={point.assistanceAllowed} label="Ravitaillement / assistance autorisé" disabled={status === "saving"} onChange={(checked) => onChange(index, { ...point, assistanceAllowed: checked })} />
            </div>
            {!point.encouragementAllowed && !point.assistanceAllowed ? <p className="text-xs font-medium text-amber-700">Choisis au moins une autorisation pour publier ce point.</p> : null}

            <SwitchRow
              label="Accès supporters au même endroit que le point de course"
              description="Les coordonnées sont prises automatiquement sur le tracé GPX à cette distance."
              checked={point.accessOnCourse === true}
              disabled={status === "saving"}
              onCheckedChange={(checked) => onChange(index, checked
                ? applyCourseAccess({ ...point, accessOnCourse: true })
                : { ...point, accessOnCourse: false, accessLabel: "", latitude: null, longitude: null, googleMapsUrl: null })}
            />

            {point.accessOnCourse ? (
              point.latitude !== null && point.longitude !== null ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Accès positionné automatiquement sur le parcours au km {point.distanceKm === null ? "-" : formatKm(point.distanceKm)}.
                </p>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Impossible de trouver ce point sur le tracé GPX. Ajoute un GPX ou décoche cette option pour renseigner une adresse.
                </p>
              )
            ) : (
              <AddressAutocompleteField
                label="Adresse d’accès supporters"
                value={point.accessLabel}
                location={{
                  label: point.accessLabel || null,
                  lat: point.latitude,
                  lng: point.longitude,
                  googleMapsUrl: point.googleMapsUrl,
                  source: point.latitude !== null ? "autocomplete" : "manual",
                }}
                onChange={(accessLabel) => onChange(index, { ...point, accessLabel })}
                onLocationChange={(location) => onChange(index, {
                  ...point,
                  accessLabel: location.label ?? "",
                  latitude: location.lat,
                  longitude: location.lng,
                  googleMapsUrl: location.googleMapsUrl,
                })}
                invalid={point.latitude === null || point.longitude === null}
                placeholder="Rechercher une adresse ou un lieu"
              />
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <TextAreaField label="Consignes d’accès" value={point.accessNote} onChange={(accessNote) => onChange(index, { ...point, accessNote })} />
              <TextField label="Lien vers un plan (optionnel)" type="url" value={point.planUrl} onChange={(planUrl) => onChange(index, { ...point, planUrl })} placeholder="https://…" />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FixedCourseCard({
  title,
  subtitle,
  value,
  label,
  onChange,
  disabled = false,
  timeInput = false,
}: {
  title: string;
  subtitle: string;
  value: string;
  label: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  timeInput?: boolean;
}) {
  const normalizedTimeValue = timeInput ? normalizeClockInputValue(value) : null;
  const hasUnconvertibleLegacyValue = timeInput && Boolean(value.trim()) && normalizedTimeValue === null;

  return (
    <section className="rounded-[1.5rem] border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <ContextualHelp text={subtitle} />
        </div>
        <div className="w-full md:max-w-sm">
          <TextField
            label={label}
            value={timeInput ? normalizedTimeValue ?? "" : value}
            onChange={onChange}
            disabled={disabled}
            type={timeInput ? "time" : "text"}
            step={timeInput ? "60" : undefined}
          />
          {hasUnconvertibleLegacyValue ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Ancienne valeur conservée : {value}. Choisis une heure précise ou configure les départs dans l’onglet SAS.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StationDetailsPanel({ station, onChange, onRemove, productsSlot }: { station: AidStationDraft; onChange: (station: AidStationDraft) => void; onRemove: () => void; productsSlot: ReactNode }) {
  const details = station.organizerDetails;
  return (
    <div className="border-t border-border px-4 pb-4 pt-1">
      <div className="grid gap-3 rounded-[1.25rem] border border-dashed border-brand-border/70 bg-background/80 p-4 lg:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <TextField label="Nom du ravito" value={station.name} onChange={(value) => onChange({ ...station, name: value })} required />
        </div>
        <NumberField label="Distance km" value={station.distanceKm} step="0.1" onChange={(value) => onChange({ ...station, distanceKm: value })} />
        <NumberField label="D+ cumulé" hint="Calculé automatiquement à partir du tracé GPX de ce format." value={details.cumulativeElevationGainM ?? 0} step="1" readOnly onChange={() => undefined} />
        <NumberField label="D- cumulé" hint="Calculé automatiquement à partir du tracé GPX de ce format." value={details.cumulativeElevationLossM ?? 0} step="1" readOnly onChange={() => undefined} />
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`station-type-${station.id ?? station.name}`}>Type de ravito</label>
          <SelectField id={`station-type-${station.id ?? station.name}`} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={details.stationType} onValueChange={(value) => onChange({ ...station, organizerDetails: { ...details, stationType: value as typeof details.stationType } })} options={[{ value: "water", label: "Eau" }, { value: "solid", label: "Solide" }, { value: "assistance", label: "Assistance" }, { value: "life_base", label: "Base de vie" }, { value: "other", label: "Autre" }]} />
        </div>
        <NumberField label="Altitude (m)" value={details.altitudeM ?? 0} step="1" onChange={(altitudeM) => onChange({ ...station, organizerDetails: { ...details, altitudeM } })} />
        <div className="xl:col-span-2">
          <TextField label="Barrière horaire" value={details.cutoffTime ?? ""} onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cutoffTime: value || null } })} />
        </div>
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-border bg-background p-4">
        <TextAreaField label="Note organisateur" value={details.organizerNote ?? station.notes ?? ""} onChange={(value) => onChange({ ...station, notes: value, organizerDetails: { ...details, organizerNote: value || null } })} />
      </div>

      <div className="mt-4">{productsSlot}</div>
      <div className="mt-4 flex justify-end border-t border-border pt-4">
        <details className="relative">
          <summary aria-label="Actions du ravito" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border border-border text-lg font-bold marker:content-none">⋯</summary>
          <div className="absolute bottom-12 right-0 z-10 w-52 rounded-lg border border-border bg-card p-2 shadow-xl">
            <Button type="button" variant="ghost" className="w-full justify-start text-red-700 hover:bg-red-50 hover:text-red-800" onClick={onRemove}>Supprimer le ravito</Button>
          </div>
        </details>
      </div>
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        checked ? "border-brand-border bg-background text-foreground" : "border-border bg-background text-muted-foreground",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", checked ? "bg-brand" : "bg-muted-foreground/40")} />
      <span>{label}</span>
    </button>
  );
}

function formatOptionalMeters(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value} m`;
}
