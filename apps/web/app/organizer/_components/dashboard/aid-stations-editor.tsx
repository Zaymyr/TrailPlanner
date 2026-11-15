import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { AidStationBadge } from "../../../../components/race-planner/AidStationBadge";
import { ChevronDownIcon, ChevronUpIcon } from "../../../../components/race-planner/TimelineIcons";
import { Button } from "../../../../components/ui/button";
import { cn } from "../../../../components/utils";
import type { FuelProduct } from "../../../../lib/product-types";
import { ContextualHelp, NumberField, SegmentedChoice, TextAreaField, TextField } from "./controls";
import { ConfirmDialog, SelectField, SwitchRow } from "./form-kit";
import { formatKm, getGpxCoordinateAtDistance, normalizeClockInputValue } from "./helpers";
import { StationProductsBlock } from "./products-editor";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import { LegacyConversionPanel } from "./legacy-conversion-panel";
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

type EditorView = "all" | "startWaves" | "aidStations" | "supporters" | "relay";
type EditorPanel = "aid" | "supporter" | "startWaves" | "relay";
type TimelineKind = "start" | "sas" | "aid" | "supporter" | "relay" | "finish";

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
  finishCutoffDayOffset,
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
  onFinishCutoffDayOffsetChange,
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
  legacyConversionContext,
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
  finishCutoffDayOffset: number | null;
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
  onFinishCutoffDayOffsetChange: (value: number) => void;
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
  legacyConversionContext?: { eventId: string; editionId: string; headers: HeadersInit };
}) {
  const [viewState, setViewState] = useState<{ scopeKey: string; view: EditorView }>({
    scopeKey: "",
    view: "all",
  });
  const [panel, setPanel] = useState<EditorPanel>("aid");
  const [selectedSupporterIndex, setSelectedSupporterIndex] = useState(0);
  const [stationDraft, setStationDraft] = useState<{ name: string; distanceKm: number } | null>(null);
  const [stationDraftTouched, setStationDraftTouched] = useState(false);
  const [pendingStationRemoval, setPendingStationRemoval] = useState<{ index: number; name: string } | null>(null);
  const [mobileStationOpen, setMobileStationOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{ name: string; distanceKm: number } | null>(null);
  useEffect(() => {
    if (!pendingSelection) return;
    const index = aidStations.findIndex((station) => station.name === pendingSelection.name && station.distanceKm === pendingSelection.distanceKm);
    if (index < 0) return;
    const station = aidStations[index];
    onExpandedStationKeyChange(station.id ?? `new-${index}`);
    if (station.id) setPendingSelection(null);
  }, [aidStations, onExpandedStationKeyChange, pendingSelection]);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023.98px)");
    const sync = () => setIsCompactViewport(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const relayEnabled = participationMode === "relay" || participationMode === "solo_and_relay";
  const viewScopeKey = `${activeRace?.id ?? ""}:${participationMode}`;

  useEffect(() => {
    setViewState({ scopeKey: viewScopeKey, view: "all" });
    setPanel("aid");
    setSelectedSupporterIndex(0);
    setStationDraft(null);
    setStationDraftTouched(false);
  }, [viewScopeKey]);

  if (!activeRace) return <p className="text-sm text-muted-foreground">Sélectionne un format pour gérer ses ravitos.</p>;
  const activeView = viewState.scopeKey === viewScopeKey ? viewState.view : "all";
  const sortedRelayPoints = [...relayPoints].sort((left, right) => left.distanceKm - right.distanceKm);
  const relayBoundaries = [
    { name: "Départ", distanceKm: 0 },
    ...sortedRelayPoints,
    { name: "Arrivée", distanceKm: activeRace.distance_km },
  ];
  const courseTimelinePoints: Array<{ key: string; kind: TimelineKind; name: string; distanceKm: number; time: string; dayOffset: number | null; index: number }> = [
    { key: "start", kind: "start" as const, name: "Départ", distanceKm: 0, time: startTime, dayOffset: 0, index: -1 },
    { key: "sas", kind: "sas" as const, name: startWaveCount > 0 ? `${startWaveCount} SAS de départ` : "Aucun SAS", distanceKm: 0, time: "", dayOffset: null, index: -1 },
    ...aidStations.map((station, index) => ({ key: station.id ?? `new-${index}`, kind: "aid" as const, name: station.name || `Ravito ${index + 1}`, distanceKm: station.distanceKm, time: station.organizerDetails.cutoffTime ?? "", dayOffset: station.organizerDetails.cutoffDayOffset, index })),
    ...supporterPoints.map((point, index) => ({ key: point.id ?? `supporter-${index}`, kind: "supporter" as const, name: point.name || `Suivi ${index + 1}`, distanceKm: point.distanceKm ?? 0, time: "", dayOffset: null, index })),
    ...relayPoints.filter((point) => !point.raceAidStationId).map((point, index) => ({ key: point.id ?? `relay-${index}`, kind: "relay" as const, name: point.name || `Relais ${index + 1}`, distanceKm: point.distanceKm, time: point.cutoffTime, dayOffset: null, index })),
    { key: "finish", kind: "finish" as const, name: "Arrivée", distanceKm: activeRace.distance_km, time: finishCutoffTime, dayOffset: finishCutoffDayOffset, index: -1 },
  ].sort((left, right) => left.distanceKm - right.distanceKm || TIMELINE_KIND_ORDER[left.kind] - TIMELINE_KIND_ORDER[right.kind]);
  const linkedRelayStationIds = new Set(relayPoints.map((point) => point.raceAidStationId).filter(Boolean));
  const visibleTimelinePoints = courseTimelinePoints.filter((point) => {
    if (point.kind === "start" || point.kind === "finish") return true;
    if (activeView === "all") return point.kind !== "sas" || startWaveCount > 0;
    if (activeView === "aidStations") return point.kind === "aid";
    if (activeView === "supporters") return point.kind === "supporter";
    if (activeView === "startWaves") return point.kind === "sas";
    return point.kind === "relay" || (point.kind === "aid" && Boolean(aidStations[point.index]?.id && linkedRelayStationIds.has(aidStations[point.index]?.id)));
  });
  const clampedSupporterIndex = Math.min(selectedSupporterIndex, Math.max(0, supporterPoints.length - 1));
  const changeView = (view: EditorView) => {
    setViewState({ scopeKey: viewScopeKey, view });
    if (view === "aidStations") setPanel("aid");
    else if (view === "supporters") setPanel("supporter");
    else if (view === "startWaves") setPanel("startWaves");
    else if (view === "relay") setPanel("relay");
  };
  const selectPoint = (point: (typeof courseTimelinePoints)[number]) => {
    if (point.kind === "start" || point.kind === "sas") setPanel("startWaves");
    else if (point.kind === "supporter") { setPanel("supporter"); setSelectedSupporterIndex(point.index); }
    else if (point.kind === "relay") setPanel("relay");
    else if (point.kind === "aid") {
      setPanel("aid");
      setStationDraft(null);
      onExpandedStationKeyChange(point.key);
      setMobileStationOpen(true);
    } else {
      document.getElementById("course-finish-cutoff")?.focus();
    }
  };
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
            ["all", "Tout"],
            ["aidStations", `Ravitos ${aidStations.length}`],
            ...(supporterPointsEnabled ? [["supporters", `Suivi ${supporterPoints.length}`]] : []),
            ["startWaves", `SAS ${startWaveCount}`],
            ...(relayEnabled ? [["relay", `Relais ${relayPoints.length}`]] : []),
          ] as Array<[EditorView, string]>).map(([view, label]) => <button key={view} type="button" aria-pressed={activeView === view} onClick={() => changeView(view)} className={cn("min-h-10 rounded-full border px-3 text-sm font-semibold transition", activeView === view ? "border-brand bg-brand-surface text-brand" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{label}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {activeView === "all" || activeView === "aidStations" ? (
            <Button type="button" variant="outline" onClick={() => { setPanel("aid"); setStationDraft({ name: "", distanceKm: 0 }); }}>+ Ravito</Button>
          ) : null}
          {supporterPointsEnabled && (activeView === "all" || activeView === "supporters") ? (
            <Button type="button" variant="outline" onClick={() => { onAddSupporterPoint(); setPanel("supporter"); setSelectedSupporterIndex(supporterPoints.length); }}>+ Point de suivi</Button>
          ) : null}
          {activeView === "relay" ? (
            <Button type="button" variant="outline" onClick={onAddRelayPoint}>+ Point de relais</Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(0,1.3fr)]">
      <section className="rounded-xl border border-border bg-card p-3 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto" aria-label="Ligne de course">
        <div className="relative ml-8 border-l-2 border-brand-border pl-5">
          {visibleTimelinePoints.map((point) => {
            const station = point.kind === "aid" ? aidStations[point.index] : null;
            const supporter = point.kind === "supporter" ? supporterPoints[point.index] : null;
            const isLifeBase = station?.organizerDetails.stationType === "life_base";
            const isSelected = (point.kind === "aid" && panel === "aid" && point.key === selectedAidStationKey)
              || (point.kind === "supporter" && panel === "supporter" && point.index === clampedSupporterIndex)
              || (point.kind === "sas" && panel === "startWaves")
              || (point.kind === "relay" && panel === "relay");
            const showsCutoff = point.kind === "aid" || point.kind === "relay" || point.kind === "finish";
            return (
              <button
                key={`${point.kind}-${point.key}`}
                type="button"
                data-timeline-point
                aria-current={isSelected ? "true" : undefined}
                className={cn(
                  "relative flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  point.kind === "sas" && "min-h-9 py-1",
                  isSelected && (point.kind === "supporter" ? "bg-sky-50 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-800" : "bg-brand-surface")
                )}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                  event.preventDefault();
                  const buttons = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[data-timeline-point]") ?? []);
                  const next = buttons[buttons.indexOf(event.currentTarget) + (event.key === "ArrowDown" ? 1 : -1)];
                  next?.focus();
                  next?.click();
                }}
                onClick={() => selectPoint(point)}
              >
                <TimelineMarker kind={point.kind} lifeBase={isLifeBase} />
                <span className="w-10 shrink-0 pt-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">{point.kind === "sas" ? "" : supporter && supporter.distanceKm === null ? "—" : point.distanceKm.toFixed(1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("truncate text-sm text-foreground", point.kind === "sas" ? "font-medium" : "font-semibold")} title={point.name}>{point.name}</span>
                    {point.kind === "supporter" ? <span className="shrink-0 rounded bg-sky-100 px-1.5 text-[11px] font-semibold leading-5 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">Suivi</span> : null}
                    {point.kind === "relay" ? <span className="shrink-0 rounded bg-violet-100 px-1.5 text-[11px] font-semibold leading-5 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">Relais</span> : null}
                  </span>
                  {point.kind !== "sas" ? (
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      {isLifeBase ? <span className="rounded bg-brand px-1.5 text-[11px] font-semibold leading-5 text-brand-foreground">Base de vie</span> : null}
                      {point.kind === "start" && point.time ? <span className="font-mono text-xs tabular-nums text-muted-foreground">{normalizeClockInputValue(point.time)}</span> : null}
                      {showsCutoff ? <CutoffChip time={normalizeClockInputValue(point.time) ?? ""} dayOffset={point.dayOffset} /> : null}
                      {station ? <ServiceLetters station={station} /> : null}
                      {supporter ? (
                        <span className="text-[11px] text-sky-800 dark:text-sky-200">{[supporter.encouragementAllowed && "Encouragements", supporter.assistanceAllowed && "Assistance"].filter(Boolean).join(" · ") || "À configurer"}</span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-2 text-[11px] text-muted-foreground">
          <span>E eau · S solide · A assistance</span>
          <span className="inline-flex items-center gap-1"><ClockGlyph /> barrière horaire</span>
        </p>
      </section>

      {panel === "startWaves" ? startWavesSlot : panel === "supporter" ? (
        <SupporterPointsEditor
          onlyIndex={clampedSupporterIndex}
          activeRace={activeRace}
          aidStations={aidStations}
          gpxPreview={gpxPreview}
          points={supporterPoints}
          status={status}
          onChange={onUpdateSupporterPoint}
          onRemove={onRemoveSupporterPoint}
        />
      ) : panel === "aid" ? (
        <>
          {stationDraft ? (
            <form noValidate className="space-y-3 rounded-xl border border-dashed border-brand-border bg-brand-surface/30 p-4" aria-label="Nouveau ravito" onSubmit={(event) => {
              event.preventDefault();
              setStationDraftTouched(true);
              if (!stationDraft.name.trim()) return;
              onAddStation({ name: stationDraft.name.trim(), distanceKm: stationDraft.distanceKm });
              setPendingSelection({ name: stationDraft.name.trim(), distanceKm: stationDraft.distanceKm });
              setMobileStationOpen(true);
              setStationDraft(null);
              setStationDraftTouched(false);
            }}>
              <p className="font-semibold text-foreground">Nouveau ravito</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Nom du ravito" value={stationDraft.name} onChange={(name) => setStationDraft((current) => current ? { ...current, name } : current)} invalid={!stationDraft.name.trim()} validationVisible={stationDraftTouched} errorMessage="Indique le nom du ravito." autoFocus />
                <NumberField label="Distance km" value={stationDraft.distanceKm} onChange={(distanceKm) => setStationDraft((current) => current ? { ...current, distanceKm } : current)} emptyWhenZero />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Ajouter le ravito</Button>
                <Button type="button" variant="ghost" onClick={() => { setStationDraft(null); setStationDraftTouched(false); }}>Annuler</Button>
              </div>
            </form>
          ) : null}
          {selectedAidStation && !stationDraft ? ((section: ReactNode) => (mobileStationOpen && isCompactViewport ? createPortal(section, document.body) : section))(
            <section className={cn("rounded-xl border border-border bg-card shadow-sm", mobileStationOpen ? "max-lg:fixed max-lg:inset-0 max-lg:z-50 max-lg:overflow-y-auto max-lg:rounded-none max-lg:border-0" : "max-lg:hidden")} aria-label={`Détails de ${selectedAidStation.name}`}>
              <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <Button type="button" variant="ghost" className="lg:hidden" onClick={() => setMobileStationOpen(false)}>Retour</Button>
                  <div><p className="font-semibold text-foreground">{selectedAidStation.name || `Ravito ${selectedAidStationIndex + 1}`}</p><p className="text-xs text-muted-foreground">{formatKm(selectedAidStation.distanceKm)}</p></div>
                </div>
              </header>
              <StationDetailsPanel station={selectedAidStation} startTime={startTime} onChange={(next) => onUpdateStation(selectedAidStationIndex, next)} onRemove={() => setPendingStationRemoval({ index: selectedAidStationIndex, name: selectedAidStation.name || `Ravito ${selectedAidStationIndex + 1}` })} productsSlot={selectedProductsSlot} legacyConversionContext={legacyConversionContext} servicesSlot={(
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">Sur place</legend>
                  <div className="flex flex-wrap gap-2">
                    <StationServiceChip checked={selectedAidStation.waterRefill} label="Eau" disabled={status === "saving"} onChange={(checked) => onUpdateStation(selectedAidStationIndex, { ...selectedAidStation, waterRefill: checked })} />
                    <StationServiceChip checked={selectedAidStation.solidRefill} label="Solide" disabled={status === "saving"} onChange={(checked) => onUpdateStation(selectedAidStationIndex, { ...selectedAidStation, solidRefill: checked })} />
                    <StationServiceChip checked={selectedAidStation.assistanceAllowed} label="Assistance autorisée" disabled={status === "saving"} onChange={(checked) => onUpdateStation(selectedAidStationIndex, { ...selectedAidStation, assistanceAllowed: checked })} />
                    <StationServiceChip checked={selectedAidStation.organizerDetails.dropBagAvailable} label="Sac de délestage" disabled={status === "saving"} onChange={(checked) => onUpdateStation(selectedAidStationIndex, { ...selectedAidStation, organizerDetails: { ...selectedAidStation.organizerDetails, dropBagAvailable: checked } })} />
                    {([['toilets', 'Toilettes'], ['shelter', 'Abri'], ['medical', 'Soins'], ['hotDrinks', 'Boisson chaude'], ['hotFood', 'Repas chaud']] as const).map(([key, label]) => (
                      <StationServiceChip key={key} checked={selectedAidStation.organizerDetails.amenities[key]} label={label} disabled={status === "saving"} onChange={(checked) => onUpdateStation(selectedAidStationIndex, { ...selectedAidStation, organizerDetails: { ...selectedAidStation.organizerDetails, amenities: { ...selectedAidStation.organizerDetails.amenities, [key]: checked } } })} />
                    ))}
                    {relayEnabled ? (
                      <StationServiceChip
                        checked={Boolean(selectedAidStation.id && relayPoints.some((point) => point.raceAidStationId === selectedAidStation.id))}
                        label="Point de relais"
                        disabled={!selectedAidStation.id || status === "saving"}
                        onChange={(checked) => onToggleStationRelayPoint(selectedAidStation, checked)}
                      />
                    ) : null}
                  </div>
                </fieldset>
              )} />
            </section>
          ) : null}
          {aidStations.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Aucun ravito.</p>
          ) : null}
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
                        <TextField label="Barrière horaire" type="time" value={normalizeClockInputValue(point.cutoffTime) ?? ""} onChange={(value) => onUpdateRelayPoint(index, { ...point, cutoffTime: normalizeClockInputValue(value) ?? value })} />
                        <TextField label="Heure de transmission" type="time" value={normalizeClockInputValue(point.handoverTime) ?? ""} onChange={(value) => onUpdateRelayPoint(index, { ...point, handoverTime: normalizeClockInputValue(value) ?? value })} />
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
      <section className="grid gap-4 rounded-xl border border-border bg-background p-4 md:grid-cols-2" aria-label="Horaires et consignes de course">
        <p className="font-semibold text-foreground md:col-span-2">Horaires et consignes</p>
        <TextField label={startWaveCount > 0 ? "Premier départ" : "Heure de départ"} hint={startWaveCount > 0 ? "Piloté par les SAS : modifie l’heure dans l’onglet SAS." : undefined} type="time" value={normalizeClockInputValue(startTime) ?? ""} onChange={onStartTimeChange} disabled={startWaveCount > 0} />
        <div className="space-y-2">
          <TextField id="course-finish-cutoff" label="Barrière finale" type="time" value={normalizeClockInputValue(finishCutoffTime) ?? ""} onChange={(value) => {
            onFinishCutoffTimeChange(value);
            if (finishCutoffDayOffset === null) onFinishCutoffDayOffsetChange(suggestCutoffDayOffset(startTime, value));
          }} />
          <CutoffDayChoice value={finishCutoffDayOffset ?? suggestCutoffDayOffset(startTime, finishCutoffTime)} onChange={onFinishCutoffDayOffsetChange} />
        </div>
        <TextAreaField label="Consignes de barrières horaires" value={cutoffNote} onChange={onCutoffNoteChange} />
        <TextAreaField label="Contraintes et consignes de course" value={scheduleNote} onChange={onScheduleNoteChange} />
      </section>
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
  onlyIndex,
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
  onlyIndex?: number;
}) {
  if (points.length === 0) {
    return <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Aucun point de suivi coureur.</p>;
  }

  return (
    <div className="space-y-4">
      {points.map((point, index) => {
        if (onlyIndex !== undefined && index !== onlyIndex) return null;
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

function StationDetailsPanel({ station, startTime, onChange, onRemove, productsSlot, servicesSlot, legacyConversionContext }: { station: AidStationDraft; startTime: string; onChange: (station: AidStationDraft) => void; onRemove: () => void; productsSlot: ReactNode; servicesSlot: ReactNode; legacyConversionContext?: { eventId: string; editionId: string; headers: HeadersInit } }) {
  const details = station.organizerDetails;
  return (
    <div className="space-y-5 p-4">
      {servicesSlot}
      <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField label="Nom du ravito" value={station.name} onChange={(value) => onChange({ ...station, name: value })} required />
        </div>
        <NumberField label="Distance km" value={station.distanceKm} step="0.1" onChange={(value) => onChange({ ...station, distanceKm: value })} />
        <NumberField label="D+ cumulé" hint="Calculé automatiquement à partir du tracé GPX de ce format." value={details.cumulativeElevationGainM ?? 0} step="1" readOnly onChange={() => undefined} />
        <NumberField label="D- cumulé" hint="Calculé automatiquement à partir du tracé GPX de ce format." value={details.cumulativeElevationLossM ?? 0} step="1" readOnly onChange={() => undefined} />
        <div className="space-y-1">
          <p className="text-sm font-medium">Type</p>
          <SegmentedChoice
            label="Type de point"
            value={details.stationType === "life_base" ? "life_base" : "aid"}
            options={[{ value: "aid", label: "Ravito" }, { value: "life_base", label: "Base de vie" }] as const}
            onChange={(value) => onChange({
              ...station,
              organizerDetails: {
                ...details,
                stationType: value === "life_base" ? "life_base" : details.stationType !== "life_base" ? details.stationType : station.solidRefill ? "solid" : "water",
              },
            })}
          />
        </div>
        <NumberField label="Altitude (m)" value={details.altitudeM ?? 0} step="1" onChange={(altitudeM) => onChange({ ...station, organizerDetails: { ...details, altitudeM } })} />
        <div className="space-y-2">
          <TextField label="Barrière horaire" type="time" value={normalizeClockInputValue(details.cutoffTime) ?? ""} onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cutoffTime: value || null, cutoffDayOffset: details.cutoffDayOffset ?? suggestCutoffDayOffset(startTime, value) } })} />
          <CutoffDayChoice value={details.cutoffDayOffset ?? suggestCutoffDayOffset(startTime, details.cutoffTime ?? "")} onChange={(cutoffDayOffset) => onChange({ ...station, organizerDetails: { ...details, cutoffDayOffset } })} />
          {details.cutoffTime && normalizeClockInputValue(details.cutoffTime) === null ? <p className="text-xs font-medium text-amber-700">Barrière à vérifier : {details.cutoffTime}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Temps d’arrêt max (min)" value={details.maxStopMinutes ?? 0} emptyWhenZero step="1" onChange={(value) => onChange({ ...station, organizerDetails: { ...details, maxStopMinutes: value > 0 ? Math.round(value) : null } })} />
        <SegmentedChoice label="Accès des accompagnants" value={details.supportersAccess ?? "none"} options={[{ value: "none", label: "Non précisé" }, { value: "allowed", label: "Autorisés" }, { value: "restricted", label: "Zone dédiée" }, { value: "forbidden", label: "Interdits" }] as const} onChange={(supportersAccess) => onChange({ ...station, organizerDetails: { ...details, supportersAccess: supportersAccess === "none" ? null : supportersAccess } })} />
        <p className="text-xs text-muted-foreground sm:col-span-2">L’assistance désigne l’aide matérielle apportée au coureur. L’accès des accompagnants indique si le public peut être présent sur place.</p>
        <div className="sm:col-span-2">
          <TextAreaField label="Note courte" hint={`${(details.note ?? "").length}/200 caractères`} value={details.note ?? ""} onChange={(value) => onChange({ ...station, organizerDetails: { ...details, note: value.slice(0, 200) || null } })} />
        </div>
        {details.organizerNote || station.notes ? <details className="sm:col-span-2 rounded-lg border border-border bg-muted/20 p-3"><summary className="cursor-pointer text-sm font-semibold">Texte à convertir</summary><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{details.organizerNote ?? station.notes}</p>{legacyConversionContext ? <LegacyConversionPanel<{ amenities: typeof details.amenities; dropBagAvailable: boolean; maxStopMinutes: number | null; supportersAccess: typeof details.supportersAccess; cutoffTime: string | null; cutoffDayOffset: number | null; note: string | null }> {...legacyConversionContext} block="aid_station" text={details.organizerNote ?? station.notes ?? ""} onApply={(proposal) => onChange({ ...station, organizerDetails: { ...details, ...proposal } })} /> : null}</details> : null}
      </div>

      <div className="border-t border-border pt-4">{productsSlot}</div>
      <div className="flex justify-end">
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

const TIMELINE_KIND_ORDER: Record<TimelineKind, number> = { start: 0, sas: 1, aid: 2, supporter: 3, relay: 4, finish: 5 };

function TimelineMarker({ kind, lifeBase }: { kind: TimelineKind; lifeBase?: boolean }) {
  const base = "absolute top-3 -translate-x-1/2";
  if (kind === "start" || kind === "finish") return <span className={cn(base, "-left-[1.3rem] h-3.5 w-3.5 rounded-full border-2 border-card bg-brand")} aria-hidden="true" />;
  if (kind === "sas") return <span className={cn(base, "-left-[1.3rem] top-2.5 h-2.5 w-2.5 rounded-full border-2 border-brand bg-card")} aria-hidden="true" />;
  if (kind === "supporter") return <span className={cn(base, "-left-[1.3rem] h-3.5 w-3.5 rounded-full border-[3px] border-sky-600 bg-card")} aria-hidden="true" />;
  if (kind === "relay") return <span className={cn(base, "-left-[1.3rem] h-3 w-3 rotate-45 bg-violet-600")} aria-hidden="true" />;
  return <span className={cn(base, "-left-[1.3rem] rounded-full border-2 border-card bg-brand/70", lifeBase ? "h-4 w-4 bg-brand ring-2 ring-brand/30" : "h-3.5 w-3.5")} aria-hidden="true" />;
}

function ClockGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.6V8l2.3 1.5" strokeLinecap="round" />
    </svg>
  );
}

function CutoffChip({ time, dayOffset }: { time: string; dayOffset?: number | null }) {
  if (!time) return <span className="rounded border border-dashed border-border px-1.5 text-[11px] leading-5 text-muted-foreground" title="Aucune barrière horaire">Sans barrière</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[11px] leading-5 tabular-nums text-foreground" title="Barrière horaire">
      <ClockGlyph />
      {dayOffset && dayOffset > 0 ? `J+${dayOffset} · ${time}` : time}
    </span>
  );
}

function suggestCutoffDayOffset(startTime: string, cutoffTime: string) {
  const start = normalizeClockInputValue(startTime);
  const cutoff = normalizeClockInputValue(cutoffTime);
  return start && cutoff && cutoff < start ? 1 : 0;
}

function CutoffDayChoice({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <SegmentedChoice label="Jour de la barrière" value={String(Math.min(value, 2))} options={[{ value: "0", label: "J" }, { value: "1", label: "J+1" }, { value: "2", label: "J+2" }] as const} onChange={(next) => onChange(Number(next))} />;
}

function ServiceLetters({ station }: { station: AidStationDraft }) {
  return (
    <span className="flex gap-1 text-[11px] font-semibold leading-5" aria-label={`Services : ${[station.waterRefill && "eau", station.solidRefill && "solide", station.assistanceAllowed && "assistance"].filter(Boolean).join(", ") || "aucun"}`}>
      {station.waterRefill ? <span className="rounded bg-brand-surface px-1.5 text-brand" title="Eau">E</span> : null}
      {station.solidRefill ? <span className="rounded bg-brand-surface px-1.5 text-brand" title="Solide">S</span> : null}
      {station.assistanceAllowed ? <span className="rounded bg-brand-surface px-1.5 text-brand" title="Assistance">A</span> : null}
      {station.organizerDetails.dropBagAvailable ? <span className="inline-flex items-center px-1 text-brand" aria-label="Sac de délestage disponible" title="Sac de délestage"><DropBagGlyph /></span> : null}
    </span>
  );
}

function DropBagGlyph() {
  return <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5.5 4V2.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3V4M3.5 5.2h9v8.6h-9z" /><path d="M6.2 8h3.6" strokeLinecap="round" /></svg>;
}
