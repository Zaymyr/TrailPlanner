import { useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { cn } from "../../../../components/utils";
import {
  defaultOrganizerEventDetails,
  getOrganizerBibPickupLocations,
  hasOrganizerEquipmentLabelPrefix,
  hasRaceAccessOverride,
  normalizeOrganizerEquipmentLabel,
  type OrganizerBibPickupLocation,
  type OrganizerBibPickupSlot,
  type OrganizerEventDetails,
  type OrganizerRaceDetails,
} from "../../../../lib/organizer-dashboard-details";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import { equipmentSuggestions } from "./constants";
import { ContextualHelp, InlineEditableRow, OptionalModule, SegmentedChoice, TextAreaField, TextField, ToggleChip } from "./controls";
import type { RaceFormat } from "./types";

export function EquipmentEditor({
  scope,
  activeRace,
  eventDetails,
  raceDetails,
  onEventChange,
  onRaceChange,
}: {
  scope: "event" | "format";
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
  onRaceChange: (details: OrganizerRaceDetails) => void;
}) {
  if (scope === "event") {
    return (
      <EquipmentFields
        title="Matériel"
        description="Chaque ajout ici sera reporté sur toutes les courses de l'événement."
        equipment={eventDetails.mandatoryEquipment}
        weatherPlanEditable
        showHeader={false}
        onEquipmentChange={(mandatoryEquipment) => onEventChange({ ...eventDetails, mandatoryEquipment })}
      />
    );
  }

  if (!activeRace) {
    return <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Sélectionne un format pour ajouter du matériel spécifique.</p>;
  }

  const hasEquipmentOverride = raceDetails.mandatoryEquipment.overrideEnabled;

  if (!hasEquipmentOverride) {
    const commonItems = eventDetails.mandatoryEquipment.items;
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-sm font-semibold text-foreground">Matériel hérité de l’événement</p>
        <p className="text-sm text-muted-foreground">
          {commonItems.length} item{commonItems.length > 1 ? "s" : ""} · Matériel selon la météo : {eventDetails.mandatoryEquipment.weatherPlan === "normal" ? "conditions normales" : eventDetails.mandatoryEquipment.weatherPlan === "cold" ? "grand froid" : "forte chaleur"}
        </p>
        <Button type="button" variant="outline" onClick={() => onRaceChange({
          ...raceDetails,
          mandatoryEquipment: {
            ...eventDetails.mandatoryEquipment,
            items: eventDetails.mandatoryEquipment.items.map((item) => ({ ...item })),
            overrideEnabled: true,
          },
        })}>
          Personnaliser pour ce format
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasEquipmentOverride ? (
        <EquipmentFields
          title={`Matériel - ${activeRace.name}`}
          description="La liste est initialisée avec le matériel de l'événement. Tu peux ensuite la modifier pour ce format."
          equipment={raceDetails.mandatoryEquipment}
          sharedWeatherPlan={eventDetails.mandatoryEquipment.weatherPlan}
          sharedItems={eventDetails.mandatoryEquipment.items}
          showHeader={false}
          onEquipmentChange={(mandatoryEquipment) => onRaceChange({ ...raceDetails, mandatoryEquipment: { ...mandatoryEquipment, overrideEnabled: true } })}
        />
      ) : null}
    </div>
  );
}
function EquipmentFields({
  title,
  description,
  equipment,
  weatherPlanEditable = false,
  sharedWeatherPlan,
  showHeader = true,
  sharedItems,
  onEquipmentChange,
}: {
  title: string;
  description: string;
  equipment: OrganizerEventDetails["mandatoryEquipment"];
  weatherPlanEditable?: boolean;
  sharedWeatherPlan?: OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"];
  showHeader?: boolean;
  sharedItems?: OrganizerEventDetails["mandatoryEquipment"]["items"];
  onEquipmentChange: (equipment: OrganizerEventDetails["mandatoryEquipment"]) => void;
}) {
  const updateItems = (items: OrganizerEventDetails["mandatoryEquipment"]["items"]) => onEquipmentChange({ ...equipment, items });
  const updateWeatherPlan = (weatherPlan: OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"]) => onEquipmentChange({ ...equipment, weatherPlan });
  const missingEquipment = equipment.items.length === 0 && !equipment.note?.trim();
  const isSameItem = (
    first: OrganizerEventDetails["mandatoryEquipment"]["items"][number],
    second: OrganizerEventDetails["mandatoryEquipment"]["items"][number]
  ) => Boolean(first.id && second.id && first.id === second.id) || normalizeOrganizerEquipmentLabel(first.label) === normalizeOrganizerEquipmentLabel(second.label);
  const availableSuggestions = equipmentSuggestions.filter((suggestion) => !hasOrganizerEquipmentLabelPrefix(equipment.items, suggestion));
  const effectiveWeatherPlan = sharedWeatherPlan ?? equipment.weatherPlan;
  const [weatherVariantsOpen, setWeatherVariantsOpen] = useState(
    equipment.weatherPlan !== "normal" || equipment.items.some((item) => item.cold || item.heat)
  );
  const indexedItems = equipment.items.map((item, index) => ({ item, index }));
  const groups = [
    { required: true, label: "Obligatoire", rows: indexedItems.filter(({ item }) => item.required) },
    { required: false, label: "Recommandé", rows: indexedItems.filter(({ item }) => !item.required) },
  ];
  const removedSharedItems = sharedItems?.filter((sharedItem) => !equipment.items.some((item) => isSameItem(item, sharedItem))) ?? [];
  const updateItem = (index: number, next: Partial<OrganizerEventDetails["mandatoryEquipment"]["items"][number]>) =>
    updateItems(equipment.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));
  const weatherValue = (item: OrganizerEventDetails["mandatoryEquipment"]["items"][number]) =>
    item.cold && item.heat ? "cold_heat" : item.cold ? "cold" : item.heat ? "heat" : "always";
  const updateWeather = (index: number, value: string) => updateItem(index, {
    cold: value === "cold" || value === "cold_heat",
    heat: value === "heat" || value === "cold_heat",
  });

  return (
    <section className={cn("space-y-4", missingEquipment && "rounded-lg border border-amber-300 p-4")}>
      {showHeader ? (
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{title}</p>
          <ContextualHelp text={description} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Variantes météo</span>
          <ContextualHelp text="Affiche une condition par ligne lorsque certains équipements ne concernent que le froid ou la chaleur." />
          <button
            type="button"
            role="switch"
            aria-checked={weatherVariantsOpen}
            onClick={() => setWeatherVariantsOpen((current) => !current)}
            className={cn("relative h-6 w-11 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", weatherVariantsOpen ? "bg-brand" : "bg-muted")}
          >
            <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-card shadow-sm transition", weatherVariantsOpen ? "left-6" : "left-1")} />
          </button>
        </div>
        {weatherVariantsOpen ? (
          weatherPlanEditable ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Conditions appliquées
              <select
                value={equipment.weatherPlan}
                onChange={(event) => updateWeatherPlan(event.target.value as OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"])}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground"
              >
                <option value="normal">Normales</option>
                <option value="cold">Grand froid</option>
                <option value="heat">Grosse chaleur</option>
              </select>
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">Conditions appliquées : {effectiveWeatherPlan === "cold" ? "grand froid" : effectiveWeatherPlan === "heat" ? "grosse chaleur" : "normales"}</span>
          )
        ) : null}
      </div>
      <div className={cn("hidden px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:items-center sm:gap-3", weatherVariantsOpen ? "sm:grid-cols-[minmax(0,1fr)_auto_9rem_2rem]" : "sm:grid-cols-[minmax(0,1fr)_auto_2rem]")}>
        <span>Item</span><span>Statut</span>{weatherVariantsOpen ? <span>Météo</span> : null}<span className="sr-only">Action</span>
      </div>
      <div className="space-y-6">
        {groups.map((group) => {
          const removedRows = removedSharedItems.filter((item) => item.required === group.required);
          if (group.rows.length === 0 && removedRows.length === 0) return null;
          return (
            <section key={group.label} className="space-y-1">
              <div className="flex items-center gap-2 pb-1">
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", group.required ? "border-brand-border bg-brand-surface text-brand" : "border-border bg-surface-muted text-muted-foreground")}>{group.label}</span>
                <span className="text-xs font-semibold text-muted-foreground">({group.rows.length})</span>
              </div>
              {group.rows.map(({ item, index }) => {
                const added = Boolean(sharedItems && !sharedItems.some((sharedItem) => isSameItem(item, sharedItem)));
                return (
                  <InlineEditableRow key={item.id ?? index} className={cn("grid grid-cols-[minmax(0,1fr)_2rem] gap-2 sm:items-center sm:gap-3", weatherVariantsOpen ? "sm:grid-cols-[minmax(0,1fr)_auto_9rem_2rem]" : "sm:grid-cols-[minmax(0,1fr)_auto_2rem]")}>
                    <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                      <Input
                        aria-label={`Item de matériel n°${index + 1}`}
                        value={item.label}
                        onChange={(event) => updateItem(index, { label: event.target.value })}
                        className="h-9 min-w-0 border-transparent bg-transparent px-2 shadow-none hover:border-border focus-visible:border-brand-border"
                      />
                      {added ? <span className="shrink-0 rounded-full border border-brand-border bg-brand-surface px-2 py-0.5 text-[10px] font-semibold text-brand">Ajouté</span> : null}
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:contents">
                      <SegmentedChoice
                        label={`Statut de ${item.label || `l’item ${index + 1}`}`}
                        value={item.required ? "required" : "recommended"}
                        options={[{ value: "required", label: "Obligatoire" }, { value: "recommended", label: "Recommandé" }] as const}
                        onChange={(value) => updateItem(index, { required: value === "required" })}
                      />
                      {weatherVariantsOpen ? (
                        <select
                          aria-label={`Météo de ${item.label || `l’item ${index + 1}`}`}
                          value={weatherValue(item)}
                          onChange={(event) => updateWeather(index, event.target.value)}
                          className="h-8 min-w-32 flex-1 rounded-md border border-border bg-card px-2 text-xs text-foreground sm:w-full sm:flex-none"
                        >
                          <option value="always">Toujours</option>
                          <option value="cold">Grand froid</option>
                          <option value="heat">Grosse chaleur</option>
                          {item.cold && item.heat ? <option value="cold_heat">Froid + chaleur</option> : null}
                        </select>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="col-start-2 row-start-2 h-8 w-8 justify-self-end px-0 text-muted-foreground hover:bg-red-50 hover:text-red-700 focus-visible:text-red-700 sm:col-start-auto sm:row-start-auto"
                      onClick={() => updateItems(equipment.items.filter((_, itemIndex) => itemIndex !== index))}
                      aria-label={`Retirer ${item.label || "cet item"}`}
                      title="Retirer"
                    >×</Button>
                  </InlineEditableRow>
                );
              })}
              {removedRows.map((item, index) => (
                <InlineEditableRow key={`removed-${item.id ?? item.label}-${index}`} className={cn("grid gap-2 opacity-70 sm:items-center sm:gap-3", weatherVariantsOpen ? "sm:grid-cols-[minmax(0,1fr)_auto_9rem_2rem]" : "sm:grid-cols-[minmax(0,1fr)_auto_2rem]")}>
                  <div className="flex min-w-0 items-center gap-2 px-2 text-sm text-foreground line-through"><span className="truncate">{item.label}</span><span className="shrink-0 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground no-underline">Retiré</span></div>
                  <span className="text-xs text-muted-foreground">{item.required ? "Obligatoire" : "Recommandé"}</span>
                  {weatherVariantsOpen ? <span className="text-xs text-muted-foreground">{item.cold ? "Grand froid" : item.heat ? "Grosse chaleur" : "Toujours"}</span> : null}
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-brand" onClick={() => updateItems([...equipment.items, { ...item }])} aria-label={`Restaurer ${item.label}`}>↺</Button>
                </InlineEditableRow>
              ))}
            </section>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" className="h-8 px-2 text-xs font-semibold text-brand" onClick={() => updateItems([...equipment.items, { id: `item-${Date.now()}`, label: "Nouvel item", required: true, cold: false, heat: false, note: null }])}>+ Ajouter un item</Button>
        {availableSuggestions.length > 0 ? <span className="text-xs text-muted-foreground">Suggestions :</span> : null}
        {availableSuggestions.map((suggestion) => (
          <Button key={suggestion} type="button" variant="ghost" className="h-8 px-2 text-xs text-brand" onClick={() => updateItems([...equipment.items, { id: `item-${Date.now()}`, label: suggestion, required: true, cold: false, heat: false, note: null }])}>+ {suggestion}</Button>
        ))}
      </div>
      <TextAreaField
        label="Note matériel"
        value={equipment.note ?? ""}
        onChange={(value) => onEquipmentChange({ ...equipment, note: value || null })}
        invalid={missingEquipment}
      />
    </section>
  );
}

export function BibPickupEditor({
  eventDetails,
  onEventChange,
}: {
  eventDetails: OrganizerEventDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
}) {
  return (
    <BibPickupFields
      title="Retrait dossard commun"
      description="Renseigne les infos valables pour tous les formats."
      bib={eventDetails.bibPickup}
      showHeader={false}
      onBibChange={(bibPickup) => onEventChange({ ...eventDetails, bibPickup })}
    />
  );
}

export function RaceBibPickupEditor({
  activeRace,
  eventDetails,
  raceDetails,
  onRaceChange,
}: {
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onRaceChange: (details: OrganizerRaceDetails) => void;
}) {
  if (!activeRace) {
    return <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Sélectionne un format pour ajouter un retrait spécifique.</p>;
  }

  const bib = raceDetails.bibPickup;
  if (!bib.overrideEnabled) {
    const inheritedLocations = getOrganizerBibPickupLocations(eventDetails.bibPickup);
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-sm font-semibold text-foreground">Retrait hérité de l’événement</p>
        <p className="text-sm text-muted-foreground">
          {inheritedLocations[0]?.location || "Lieu à compléter"} · {inheritedLocations.reduce((count, location) => count + location.slots.length, 0)} créneau(x){eventDetails.bibPickup.equipmentCheck ? " · contrôle matériel" : ""}
        </p>
        <Button type="button" variant="outline" onClick={() => onRaceChange({
          ...raceDetails,
          bibPickup: {
            ...eventDetails.bibPickup,
            locations: inheritedLocations.map((location) => ({ ...location, slots: location.slots.map((slot) => ({ ...slot })) })),
            overrideEnabled: true,
          },
        })}>
          Personnaliser pour ce format
        </Button>
      </div>
    );
  }

  return (
    <BibPickupFields
      title="Retrait spécifique au format"
      description="Renseigne uniquement les différences applicables à ce format."
      bib={bib}
      hideLocationDetails
      showHeader={false}
      framed={false}
      onBibChange={(bibPickup) => onRaceChange({ ...raceDetails, bibPickup: { ...bibPickup, overrideEnabled: true } })}
    />
  );
}

function BibPickupFields({
  title,
  description,
  bib,
  onBibChange,
  hideLocationDetails,
  showHeader = true,
  framed = false,
}: {
  title: string;
  description: string;
  bib: OrganizerEventDetails["bibPickup"];
  onBibChange: (bib: OrganizerEventDetails["bibPickup"]) => void;
  hideLocationDetails?: boolean;
  showHeader?: boolean;
  framed?: boolean;
}) {
  const update = (next: Partial<OrganizerEventDetails["bibPickup"]>) => onBibChange({ ...bib, ...next });
  const locations = getOrganizerBibPickupLocations(bib);
  const emptyLocationDetails = defaultOrganizerEventDetails.bibPickup.locationDetails;
  const updateLocations = (nextLocations: OrganizerBibPickupLocation[]) => {
    const firstLocation = nextLocations[0];
    update({
      locations: nextLocations,
      location: firstLocation?.location ?? null,
      locationDetails: firstLocation?.locationDetails ?? emptyLocationDetails,
      ...(nextLocations.length === 0 ? { schedule: null } : null),
    });
  };
  const addLocation = () => {
    updateLocations([
      ...locations,
      {
        location: null,
        locationDetails: { ...emptyLocationDetails },
        slots: [],
      },
    ]);
  };
  const updateLocation = (locationIndex: number, next: Partial<OrganizerBibPickupLocation>) => {
    updateLocations(locations.map((location, index) => (index === locationIndex ? { ...location, ...next } : location)));
  };
  const updateSlots = (locationIndex: number, slots: OrganizerBibPickupSlot[]) => updateLocation(locationIndex, { slots });

  return (
    <section className={cn("space-y-4", framed && "rounded-lg border border-border bg-background p-4")}>
      {showHeader ? (
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{title}</p>
          <ContextualHelp text={description} />
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">Ajoute chaque lieu puis ses jours et plages horaires. Toutes les informations restent visibles et modifiables ici.</p>
      {locations.length === 0 ? (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50/50 p-4 text-sm text-amber-800">
          Aucun lieu de retrait renseigné.
        </p>
      ) : (
        <div className="space-y-6">
          {locations.map((pickupLocation, locationIndex) => {
            const missingLocation = !pickupLocation.location?.trim();
            return (
              <section key={`bib-location-${locationIndex}`} className="space-y-3 border-t border-border pt-6 first:border-t-0 first:pt-0">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {hideLocationDetails ? (
                      <Input
                        aria-label={`Lieu de retrait ${locationIndex + 1}`}
                        value={pickupLocation.location ?? ""}
                        onChange={(event) => updateLocation(locationIndex, { location: event.target.value || null })}
                        className={cn("h-9 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-border focus-visible:border-brand-border", missingLocation && "border-amber-400")}
                      />
                    ) : (
                      <AddressAutocompleteField
                        label={`Adresse du lieu ${locationIndex + 1}`}
                        labelClassName="sr-only"
                        inputClassName="h-9 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-border focus-visible:border-brand-border"
                        value={pickupLocation.location ?? ""}
                        location={pickupLocation.locationDetails}
                        biasLocation={pickupLocation.locationDetails}
                        onChange={(value) => updateLocation(locationIndex, { location: value || null })}
                        onLocationChange={(locationDetails) => updateLocation(locationIndex, { location: locationDetails.label, locationDetails })}
                        invalid={missingLocation}
                      />
                    )}
                  </div>
                  <details className="group/menu relative shrink-0">
                    <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Actions pour ${pickupLocation.location || `le lieu ${locationIndex + 1}`}`} title="Actions du lieu">⋯</summary>
                    <div className="absolute right-0 top-9 z-20 w-40 rounded-md border border-border bg-card p-1 shadow-lg">
                      <button type="button" className="w-full rounded px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-red-50 hover:text-red-700 focus-visible:bg-red-50 focus-visible:text-red-700" onClick={() => updateLocations(locations.filter((_, index) => index !== locationIndex))}>Supprimer le lieu</button>
                    </div>
                  </details>
                </div>
                <div className="space-y-1">
                  <div className="hidden grid-cols-[10rem_6.25rem_1rem_6.25rem_2rem] items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                    <span>Jour</span><span>Début</span><span aria-hidden>→</span><span>Fin</span><span className="sr-only">Action</span>
                  </div>
                  {pickupLocation.slots.length === 0 ? (
                    <p className="rounded-md border border-dashed border-amber-300 bg-amber-50/50 p-3 text-sm text-amber-800">
                      Aucun jour ni horaire pour ce lieu.
                    </p>
                  ) : (
                    pickupLocation.slots.map((slot, slotIndex) => {
                      const updateSlot = (next: Partial<OrganizerBibPickupSlot>) =>
                        updateSlots(
                          locationIndex,
                          pickupLocation.slots.map((currentSlot, index) =>
                            index === slotIndex ? { ...currentSlot, ...next } : currentSlot
                          )
                        );
                      return (
                        <InlineEditableRow key={`bib-location-${locationIndex}-slot-${slotIndex}`} className="grid grid-cols-[minmax(0,1fr)_2rem] gap-2 sm:grid-cols-[10rem_6.25rem_1rem_6.25rem_2rem] sm:items-center">
                          <Input aria-label={`Jour du créneau ${slotIndex + 1}, lieu ${locationIndex + 1}`} type="date" value={slot.date ?? ""} onChange={(event) => updateSlot({ date: event.target.value || null })} aria-invalid={!slot.date || undefined} className={cn("h-9 min-w-0 font-mono text-sm tabular-nums", !slot.date && "border-amber-400")} />
                          <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-center gap-2 sm:contents">
                            <Input aria-label={`Début du créneau ${slotIndex + 1}, lieu ${locationIndex + 1}`} type="time" value={slot.startTime ?? ""} onChange={(event) => updateSlot({ startTime: event.target.value || null })} aria-invalid={!slot.startTime || undefined} className={cn("h-9 min-w-0 font-mono text-sm tabular-nums", !slot.startTime && "border-amber-400")} />
                            <span className="text-center text-xs text-muted-foreground" aria-hidden>→</span>
                            <Input aria-label={`Fin du créneau ${slotIndex + 1}, lieu ${locationIndex + 1}`} type="time" value={slot.endTime ?? ""} onChange={(event) => updateSlot({ endTime: event.target.value || null })} aria-invalid={!slot.endTime || undefined} className={cn("h-9 min-w-0 font-mono text-sm tabular-nums", !slot.endTime && "border-amber-400")} />
                          </div>
                          <Button type="button" variant="ghost" className="col-start-2 row-start-1 h-8 w-8 px-0 text-muted-foreground hover:bg-red-50 hover:text-red-700 focus-visible:text-red-700 sm:col-start-auto sm:row-start-auto" onClick={() => updateSlots(locationIndex, pickupLocation.slots.filter((_, index) => index !== slotIndex))} aria-label={`Supprimer le créneau ${slotIndex + 1}, lieu ${locationIndex + 1}`} title="Supprimer le créneau">×</Button>
                        </InlineEditableRow>
                      );
                    })
                  )}
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs font-semibold text-brand" onClick={() => updateSlots(locationIndex, [...pickupLocation.slots, { date: null, startTime: null, endTime: null }])}>+ Ajouter un créneau</Button>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Button type="button" variant="ghost" className="h-9 px-2 text-sm font-semibold text-brand" onClick={addLocation}>+ Ajouter un lieu</Button>
      {bib.schedule ? (
        <TextAreaField
          label="Informations horaires existantes"
          value={bib.schedule}
          onChange={(value) => update({ schedule: value || null })}
        />
      ) : null}
      <TextAreaField label="Documents nécessaires" value={bib.requiredDocuments ?? ""} onChange={(value) => update({ requiredDocuments: value || null })} />
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Une autre personne peut-elle retirer le dossard ?</p>
          <SegmentedChoice label="Retrait par un tiers" value={bib.thirdPartyPickupAllowed === true ? "yes" : "no"} options={[{ value: "no", label: "Non" }, { value: "yes", label: "Oui" }] as const} onChange={(value) => update({ thirdPartyPickupAllowed: value === "yes" })} />
        </div>
        {bib.thirdPartyPickupAllowed === true ? <div className="ml-0 border-l-2 border-brand-border pl-4 sm:ml-4"><TextAreaField label="Conditions du retrait par un tiers" value={bib.thirdPartyPickupConditions ?? ""} onChange={(value) => update({ thirdPartyPickupConditions: value || null })} /></div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Un contrôle du matériel est-il prévu au retrait ?</p>
          <SegmentedChoice label="Contrôle du matériel au retrait" value={bib.equipmentCheck === true ? "yes" : "no"} options={[{ value: "no", label: "Non" }, { value: "yes", label: "Oui" }] as const} onChange={(value) => update({ equipmentCheck: value === "yes" })} />
        </div>
      </div>
      <TextAreaField label="Note dossard" value={bib.note ?? ""} onChange={(value) => update({ note: value || null })} />
    </section>
  );
}

export function AccessEditor({
  scope,
  activeRace,
  eventDetails,
  raceDetails,
  onEventChange,
  onRaceChange,
}: {
  scope: "event" | "format";
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
  onRaceChange: (details: OrganizerRaceDetails) => void;
}) {
  if (scope === "event") {
    return (
      <AccessFields
        title="Accès commun événement"
        description="Adresse principale, parking et consignes valables pour tous les formats."
        access={eventDetails.access}
        biasLocation={eventDetails.eventLocation}
        onAccessChange={(access) => onEventChange({ ...eventDetails, access })}
        formatMode
        showRunnerInfoToggle={false}
      />
    );
  }

  if (!activeRace) {
    return <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Sélectionne un format pour ajouter un accès ou une information spécifique.</p>;
  }

  if (!hasRaceAccessOverride(raceDetails.access)) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-sm font-semibold text-foreground">Accès hérité de l’événement</p>
        <p className="text-sm text-muted-foreground">
          Départ : {eventDetails.access.startAddress || "à compléter"} · Arrivée : {eventDetails.access.finishAddress || "à compléter"}
          {eventDetails.access.officialParkings ? " · parkings" : ""}{eventDetails.access.shuttles ? " · navettes" : ""}
        </p>
        <Button type="button" variant="outline" onClick={() => onRaceChange({
          ...raceDetails,
          access: { ...eventDetails.access, enabledSections: { ...eventDetails.access.enabledSections }, overrideEnabled: true },
        })}>
          Personnaliser pour ce format
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AccessFields
        title={`Accès - ${activeRace.name}`}
        description="Renseigne le départ, l'arrivée et active seulement les sections utiles à ce format."
        access={raceDetails.access}
        biasLocation={raceDetails.raceLocation.label ? raceDetails.raceLocation : eventDetails.eventLocation}
        onAccessChange={(access) => onRaceChange({ ...raceDetails, access })}
        formatMode
        showHeader={false}
      />
      {raceDetails.access.enabledSections.runnerInfo ? (
        <RunnerInfoFields runnerInfo={raceDetails.runnerInfo} onRunnerInfoChange={(runnerInfo) => onRaceChange({ ...raceDetails, runnerInfo })} />
      ) : null}
    </div>
  );
}

function AccessFields({
  title,
  description,
  access,
  biasLocation,
  onAccessChange,
  formatMode = false,
  showRunnerInfoToggle = formatMode,
  showHeader = true,
}: {
  title: string;
  description: string;
  access: OrganizerEventDetails["access"];
  biasLocation?: OrganizerEventDetails["eventLocation"];
  onAccessChange: (access: OrganizerEventDetails["access"]) => void;
  formatMode?: boolean;
  showRunnerInfoToggle?: boolean;
  showHeader?: boolean;
}) {
  const update = (next: Partial<OrganizerEventDetails["access"]>) => onAccessChange({ ...access, ...next });
  const updateSection = (key: keyof OrganizerEventDetails["access"]["enabledSections"], checked: boolean) =>
    update({ enabledSections: { ...access.enabledSections, [key]: checked } });
  const missingStartAddress = !access.startAddress?.trim();
  const transportEnabled = !formatMode || access.enabledSections.officialParkings || access.enabledSections.shuttles;
  const missingParkingOrShuttle =
    transportEnabled &&
    (!access.enabledSections.officialParkings || !access.enabledSections.shuttles
      ? false
      : !access.officialParkings?.trim() && !access.shuttles?.trim() && !access.shuttleSchedule?.trim());
  const [mapOpen, setMapOpen] = useState(access.enabledSections.mapUrl || Boolean(access.mapUrl?.trim()));
  const [restrictionsOpen, setRestrictionsOpen] = useState(access.enabledSections.roadRestrictions || Boolean(access.roadRestrictions?.trim()));
  const [parkingsOpen, setParkingsOpen] = useState(access.enabledSections.officialParkings || Boolean(access.officialParkings?.trim()));
  const [shuttlesOpen, setShuttlesOpen] = useState(access.enabledSections.shuttles || Boolean(access.shuttles?.trim() || access.shuttleSchedule?.trim()));

  return (
    <section className="space-y-4">
      {showHeader ? (
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{title}</p>
          <ContextualHelp text={description} />
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">Renseigne d’abord les lieux indispensables, puis ajoute uniquement les informations utiles aux coureurs.</p>
      <div className="grid gap-3 md:grid-cols-2">
          <AddressAutocompleteField
            label="Adresse départ"
            value={access.startAddress ?? ""}
            location={access.startLocation}
            biasLocation={biasLocation}
            onChange={(value) => update({ startAddress: value || null })}
            onLocationChange={(startLocation) => update({ startLocation })}
            invalid={missingStartAddress}
          />
          <AddressAutocompleteField
            label="Adresse arrivée"
            value={access.finishAddress ?? ""}
            location={access.finishLocation}
            biasLocation={biasLocation}
            onChange={(value) => update({ finishAddress: value || null })}
            onLocationChange={(finishLocation) => update({ finishLocation })}
          />
      </div>

      <OptionalModule
        title="une carte générale"
        active={mapOpen}
        onAdd={() => { setMapOpen(true); updateSection("mapUrl", true); }}
        onRemove={() => { setMapOpen(false); updateSection("mapUrl", false); }}
      >
          <TextField label="Lien vers une carte générale (optionnel)" value={access.mapUrl ?? ""} onChange={(value) => update({ mapUrl: value || null })} placeholder="https://..." />
      </OptionalModule>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-semibold text-foreground">À retenir</p>
        <TextAreaField label="Information prioritaire" hint="À réserver aux consignes critiques : dernière navette, accès fermé ou horaire important." value={access.note ?? ""} onChange={(value) => update({ note: value || null })} />
      </div>

      <OptionalModule
        title="les routes fermées"
        active={restrictionsOpen}
        onAdd={() => { setRestrictionsOpen(true); updateSection("roadRestrictions", true); }}
        onRemove={() => { setRestrictionsOpen(false); updateSection("roadRestrictions", false); }}
      >
          <TextAreaField label="Routes fermées / restrictions" value={access.roadRestrictions ?? ""} onChange={(value) => update({ roadRestrictions: value || null })} />
      </OptionalModule>

      <OptionalModule
        title="les parkings"
        active={parkingsOpen}
        onAdd={() => { setParkingsOpen(true); updateSection("officialParkings", true); }}
        onRemove={() => { setParkingsOpen(false); updateSection("officialParkings", false); }}
      >
          <TextAreaField label="Parkings officiels" value={access.officialParkings ?? ""} onChange={(value) => update({ officialParkings: value || null })} invalid={missingParkingOrShuttle} />
      </OptionalModule>

      <OptionalModule
        title="les navettes"
        active={shuttlesOpen}
        onAdd={() => { setShuttlesOpen(true); updateSection("shuttles", true); }}
        onRemove={() => { setShuttlesOpen(false); updateSection("shuttles", false); }}
      >
          <div className="grid gap-3 md:grid-cols-2">
            <TextAreaField label="Fonctionnement des navettes" value={access.shuttles ?? ""} onChange={(value) => update({ shuttles: value || null })} invalid={missingParkingOrShuttle} />
            <TextAreaField label="Horaires des navettes" value={access.shuttleSchedule ?? ""} onChange={(value) => update({ shuttleSchedule: value || null })} />
          </div>
      </OptionalModule>

      {formatMode && showRunnerInfoToggle ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-background p-4">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">Informations propres au format</p>
            <ContextualHelp text="Briefing, zone de départ ou règle qui ne concerne que cette course." />
          </div>
          <ToggleChip checked={access.enabledSections.runnerInfo} label="Activer" onChange={(checked) => updateSection("runnerInfo", checked)} />
        </div>
      ) : null}
    </section>
  );
}

function RunnerInfoFields({
  runnerInfo,
  onRunnerInfoChange,
}: {
  runnerInfo: OrganizerRaceDetails["runnerInfo"];
  onRunnerInfoChange: (runnerInfo: OrganizerRaceDetails["runnerInfo"]) => void;
}) {
  const update = (next: Partial<OrganizerRaceDetails["runnerInfo"]>) => onRunnerInfoChange({ ...runnerInfo, ...next });
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-foreground">Informations coureur spécifiques</p>
        <ContextualHelp text="Briefing, zone de départ ou consigne propre au format actif." />
      </div>
      <TextField label="Zone de départ" value={runnerInfo.startArea ?? ""} onChange={(value) => update({ startArea: value || null })} />
      <TextAreaField label="Briefing" value={runnerInfo.briefing ?? ""} onChange={(value) => update({ briefing: value || null })} />
      <TextAreaField label="Règles spécifiques" value={runnerInfo.rules ?? ""} onChange={(value) => update({ rules: value || null })} />
      <TextAreaField label="Note format" value={runnerInfo.note ?? ""} onChange={(value) => update({ note: value || null })} />
    </div>
  );
}

export function ServicesEditor({
  details,
  onChange,
}: {
  details: OrganizerEventDetails;
  onChange: (details: OrganizerEventDetails) => void;
}) {
  const services = details.services;
  const update = (next: Partial<OrganizerEventDetails["services"]>) => onChange({ ...details, services: { ...services, ...next } });
  return (
    <div className="space-y-4">
      <TextAreaField label="Accompagnants" value={services.supporters ?? ""} onChange={(value) => update({ supporters: value || null })} />
      <TextAreaField label="Hébergements" value={services.accommodations ?? ""} onChange={(value) => update({ accommodations: value || null })} />
      <TextAreaField label="Restaurants" value={services.restaurants ?? ""} onChange={(value) => update({ restaurants: value || null })} />
      <TextAreaField label="Massage / récupération" value={services.recovery ?? ""} onChange={(value) => update({ recovery: value || null })} />
      <TextAreaField label="Partenaires" value={services.partners ?? ""} onChange={(value) => update({ partners: value || null })} />
      <TextAreaField label="Message dernière minute" value={services.lastMinuteMessage ?? ""} onChange={(value) => update({ lastMinuteMessage: value || null })} />
      <TextAreaField label="Note services" value={services.note ?? ""} onChange={(value) => update({ note: value || null })} />
    </div>
  );
}
