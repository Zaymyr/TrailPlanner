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
import { ContextualHelp, InlineEditableRow, NumberField, OptionalModule, SegmentedChoice, TextAreaField, TextField, ToggleChip } from "./controls";
import { isOutsideDateRange, SelectField, SwitchRow } from "./form-kit";
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
function RequiredToggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-muted")} aria-hidden="true">
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-sm transition", checked ? "left-[1.125rem]" : "left-0.5")} />
      </span>
      <span className={cn("w-[4.75rem] text-left", checked ? "text-foreground" : "text-muted-foreground")}>{checked ? "Obligatoire" : "Recommandé"}</span>
    </button>
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
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemRequired, setNewItemRequired] = useState(true);
  const addItem = (label: string, required: boolean) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    updateItems([{ id: `item-${Date.now()}`, label: trimmed, required, cold: false, heat: false, note: null }, ...equipment.items]);
  };
  const requiredCount = equipment.items.filter((item) => item.required).length;
  const recommendedCount = equipment.items.length - requiredCount;
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
      <form
        className="space-y-2 rounded-lg border border-brand-border/70 bg-brand-surface/40 p-3"
        aria-label="Ajouter un item de matériel"
        onSubmit={(event) => { event.preventDefault(); addItem(newItemLabel, newItemRequired); setNewItemLabel(""); }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Nouvel item de matériel"
            value={newItemLabel}
            onChange={(event) => setNewItemLabel(event.target.value)}
            placeholder="Ajouter un item, puis Entrée"
            className="h-9 min-w-0 flex-1 basis-56 bg-card"
          />
          <RequiredToggle checked={newItemRequired} onChange={setNewItemRequired} label="Nouvel item obligatoire" />
          <Button type="submit" className="h-9" disabled={!newItemLabel.trim()}>Ajouter</Button>
        </div>
        {availableSuggestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Suggestions :</span>
            {availableSuggestions.map((suggestion) => (
              <button key={suggestion} type="button" className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-brand hover:border-brand-border" onClick={() => addItem(suggestion, newItemRequired)}>+ {suggestion}</button>
            ))}
          </div>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{requiredCount} obligatoire{requiredCount > 1 ? "s" : ""} · {recommendedCount} recommandé{recommendedCount > 1 ? "s" : ""}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Variantes météo</span>
          <ContextualHelp text="Affiche une condition par ligne lorsque certains équipements ne concernent que le froid ou la chaleur." />
          <button
            type="button"
            role="switch"
            aria-checked={weatherVariantsOpen}
            aria-label="Variantes météo"
            onClick={() => setWeatherVariantsOpen((current) => !current)}
            className={cn("relative h-5 w-9 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", weatherVariantsOpen ? "bg-brand" : "bg-muted")}
          >
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-sm transition", weatherVariantsOpen ? "left-[1.125rem]" : "left-0.5")} />
          </button>
          {weatherVariantsOpen ? (
            weatherPlanEditable ? (
              <div className="w-44">
              <SelectField
                aria-label="Conditions appliquées"
                value={equipment.weatherPlan}
                onValueChange={(value) => updateWeatherPlan(value as OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"])}
                className="h-8 w-auto rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground"
                options={[{ value: "normal", label: "Conditions normales" }, { value: "cold", label: "Grand froid" }, { value: "heat", label: "Grosse chaleur" }]}
              />
              </div>
            ) : (
              <span>Conditions : {effectiveWeatherPlan === "cold" ? "grand froid" : effectiveWeatherPlan === "heat" ? "grosse chaleur" : "normales"}</span>
            )
          ) : null}
        </div>
      </div>

      <ul className="divide-y divide-border/70 rounded-lg border border-border bg-card" aria-label="Liste du matériel">
        {equipment.items.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">Aucun item pour l’instant.</li> : null}
        {equipment.items.map((item, index) => (
          <li key={item.id ?? index} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1">
            <Input
              title={item.label}
              aria-label={`Item de matériel n°${index + 1}`}
              value={item.label}
              onChange={(event) => updateItem(index, { label: event.target.value })}
              className="order-1 h-8 min-w-0 flex-1 basis-[calc(100%-2.75rem)] border-transparent sm:basis-0 sm:min-w-[12rem] bg-transparent px-2 text-sm shadow-none hover:border-border focus-visible:border-brand-border"
            />
            <div className="order-3 sm:order-2"><RequiredToggle checked={item.required} onChange={(required) => updateItem(index, { required })} label={`${item.label || `Item ${index + 1}`} obligatoire`} /></div>
            {weatherVariantsOpen ? (
              <div className="order-3 w-[6.75rem] shrink-0 sm:w-32">
              <SelectField
                aria-label={`Météo de ${item.label || `l’item ${index + 1}`}`}
                value={weatherValue(item)}
                onValueChange={(value) => updateWeather(index, value)}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                options={[
                  { value: "always", label: "Toujours" },
                  { value: "cold", label: "Grand froid" },
                  { value: "heat", label: "Grosse chaleur" },
                  ...(item.cold && item.heat ? [{ value: "cold_heat", label: "Froid + chaleur" }] : []),
                ]}
              />
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="order-2 h-8 w-8 shrink-0 px-0 sm:order-4 text-muted-foreground hover:bg-red-50 hover:text-red-700 focus-visible:text-red-700"
              onClick={() => updateItems(equipment.items.filter((_, itemIndex) => itemIndex !== index))}
              aria-label={`Retirer ${item.label || "cet item"}`}
              title="Retirer"
            >×</Button>
          </li>
        ))}
      </ul>
      {removedSharedItems.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Retirés pour ce format</p>
          {removedSharedItems.map((item, index) => (
            <div key={`removed-${item.id ?? item.label}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1 text-sm">
              <span className="truncate text-muted-foreground line-through">{item.label}</span>
              <Button type="button" variant="ghost" className="h-7 px-2 text-xs text-brand" onClick={() => updateItems([...equipment.items, { ...item }])} aria-label={`Restaurer ${item.label}`}>Restaurer</Button>
            </div>
          ))}
        </div>
      ) : null}
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
  editionStartDate,
  editionEndDate,
  onEventChange,
}: {
  eventDetails: OrganizerEventDetails;
  editionStartDate: string;
  editionEndDate: string;
  onEventChange: (details: OrganizerEventDetails) => void;
}) {
  return (
    <BibPickupFields
      title="Retrait dossard commun"
      description="Renseigne les infos valables pour tous les formats."
      bib={eventDetails.bibPickup}
      editionStartDate={editionStartDate}
      editionEndDate={editionEndDate}
      showHeader={false}
      onBibChange={(bibPickup) => onEventChange({ ...eventDetails, bibPickup })}
    />
  );
}

export function RaceBibPickupEditor({
  activeRace,
  eventDetails,
  raceDetails,
  editionStartDate,
  editionEndDate,
  onRaceChange,
}: {
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  editionStartDate: string;
  editionEndDate: string;
  onRaceChange: (details: OrganizerRaceDetails) => void;
}) {
  if (!activeRace) {
    return <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Sélectionne un format pour ajouter un retrait spécifique.</p>;
  }

  const bib = raceDetails.bibPickup;
  if (!bib.overrideEnabled) {
    const inheritedLocations = getOrganizerBibPickupLocations(eventDetails.bibPickup);
    const inheritedSlotCount = inheritedLocations.reduce((count, location) => count + location.slots.length, 0);
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-sm font-semibold text-foreground">Retrait hérité de l’événement</p>
        <p className="text-sm text-muted-foreground">
          {inheritedLocations[0]?.location || "Lieu à compléter"} · {inheritedSlotCount} {inheritedSlotCount === 1 ? "créneau" : "créneaux"}{eventDetails.bibPickup.equipmentCheck ? " · contrôle matériel" : ""}
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
      editionStartDate={editionStartDate}
      editionEndDate={editionEndDate}
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
  editionStartDate,
  editionEndDate,
}: {
  title: string;
  description: string;
  bib: OrganizerEventDetails["bibPickup"];
  onBibChange: (bib: OrganizerEventDetails["bibPickup"]) => void;
  hideLocationDetails?: boolean;
  showHeader?: boolean;
  framed?: boolean;
  editionStartDate: string;
  editionEndDate: string;
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
  const [removedSlot, setRemovedSlot] = useState<{ locationIndex: number; slotIndex: number; slot: OrganizerBibPickupSlot } | null>(null);
  const removeSlot = (locationIndex: number, slotIndex: number) => {
    const slots = locations[locationIndex]?.slots ?? [];
    const slot = slots[slotIndex];
    if (!slot) return;
    updateSlots(locationIndex, slots.filter((_, index) => index !== slotIndex));
    setRemovedSlot({ locationIndex, slotIndex, slot });
  };
  const restoreRemovedSlot = () => {
    if (!removedSlot) return;
    const slots = [...(locations[removedSlot.locationIndex]?.slots ?? [])];
    slots.splice(Math.min(removedSlot.slotIndex, slots.length), 0, removedSlot.slot);
    updateSlots(removedSlot.locationIndex, slots);
    setRemovedSlot(null);
  };
  const addSlot = (locationIndex: number) => {
    const slots = locations[locationIndex]?.slots ?? [];
    const defaultDate = slots[slots.length - 1]?.date ?? (editionStartDate || null);
    updateSlots(locationIndex, [...slots, { date: defaultDate, startTime: null, endTime: null }]);
    setRemovedSlot(null);
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`input[aria-label="Début du créneau ${slots.length + 1}, lieu ${locationIndex + 1}"]`)?.focus();
    }, 50);
  };

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
                      const dateOutsideEdition = isOutsideDateRange(slot.date ?? "", editionStartDate, editionEndDate);
                      const updateSlot = (next: Partial<OrganizerBibPickupSlot>) =>
                        updateSlots(
                          locationIndex,
                          pickupLocation.slots.map((currentSlot, index) =>
                            index === slotIndex ? { ...currentSlot, ...next } : currentSlot
                          )
                        );
                      return (
                        <InlineEditableRow key={`bib-location-${locationIndex}-slot-${slotIndex}`} className="grid grid-cols-[minmax(0,1fr)_2rem] gap-2 sm:grid-cols-[10rem_6.25rem_1rem_6.25rem_2rem] sm:items-center">
                          <div>
                            <Input aria-label={`Jour du créneau ${slotIndex + 1}, lieu ${locationIndex + 1}`} type="date" value={slot.date ?? ""} onChange={(event) => updateSlot({ date: event.target.value || null })} aria-invalid={!slot.date || undefined} className={cn("h-9 min-w-0 font-mono text-sm tabular-nums", !slot.date && "border-red-500")} />
                            {dateOutsideEdition ? <p className="mt-1 text-xs font-medium text-amber-700">Cette date est hors de la période de l’édition.</p> : null}
                          </div>
                          <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-center gap-2 sm:contents">
                            <Input aria-label={`Début du créneau ${slotIndex + 1}, lieu ${locationIndex + 1}`} type="time" value={slot.startTime ?? ""} onChange={(event) => updateSlot({ startTime: event.target.value || null })} aria-invalid={!slot.startTime || undefined} className={cn("h-9 min-w-0 font-mono text-sm tabular-nums", !slot.startTime && "border-amber-400")} />
                            <span className="text-center text-xs text-muted-foreground" aria-hidden>→</span>
                            <Input aria-label={`Fin du créneau ${slotIndex + 1}, lieu ${locationIndex + 1}`} type="time" value={slot.endTime ?? ""} onChange={(event) => updateSlot({ endTime: event.target.value || null })} aria-invalid={!slot.endTime || undefined} className={cn("h-9 min-w-0 font-mono text-sm tabular-nums", !slot.endTime && "border-amber-400")} />
                          </div>
                          <Button type="button" variant="ghost" className="col-start-2 row-start-1 h-8 w-8 px-0 text-muted-foreground hover:bg-red-50 hover:text-red-700 focus-visible:text-red-700 sm:col-start-auto sm:row-start-auto" onClick={() => removeSlot(locationIndex, slotIndex)} aria-label={`Supprimer le créneau ${slotIndex + 1}, lieu ${locationIndex + 1}`} title="Supprimer le créneau">×</Button>
                        </InlineEditableRow>
                      );
                    })
                  )}
                  {removedSlot?.locationIndex === locationIndex ? (
                    <p className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground" role="status">
                      Créneau supprimé{removedSlot.slot.date ? ` (${removedSlot.slot.date.split("-").reverse().join("/")}${removedSlot.slot.startTime ? ` · ${removedSlot.slot.startTime}` : ""})` : ""}.
                      <Button type="button" variant="ghost" className="h-7 px-2 text-xs font-semibold text-brand" onClick={restoreRemovedSlot}>Annuler</Button>
                    </p>
                  ) : null}
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs font-semibold text-brand" onClick={() => addSlot(locationIndex)}>+ Ajouter un créneau</Button>
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
      <DocumentKindChips title="À apporter au retrait" values={bib.requiredDocumentKinds} options={[['id_card', 'Pièce d’identité'], ['registration_qr', 'QR d’inscription'], ['medical_certificate', 'Certificat médical'], ['license_or_pps', 'Licence ou PPS'], ['parental_authorization', 'Autorisation parentale'], ['other', 'Autre']]} onChange={(requiredDocumentKinds) => update({ requiredDocumentKinds })} />
      {bib.requiredDocumentKinds.includes('other') ? <TextAreaField label="Autre document" hint={`${(bib.requiredDocumentsOther ?? '').length}/200 caractères`} value={bib.requiredDocumentsOther ?? ''} onChange={(requiredDocumentsOther) => update({ requiredDocumentsOther: requiredDocumentsOther.slice(0, 200) || null })} /> : null}
      {bib.requiredDocuments ? <LegacyText text={bib.requiredDocuments} /> : null}
      <div className="space-y-3 border-t border-border pt-4">
        <SwitchRow label="Retrait par un tiers" description="Une autre personne peut récupérer le dossard." checked={bib.thirdPartyPickupAllowed === true} onCheckedChange={(thirdPartyPickupAllowed) => update({ thirdPartyPickupAllowed })} />
        {bib.thirdPartyPickupAllowed === true ? <div className="ml-0 space-y-3 border-l-2 border-brand-border pl-4 sm:ml-4"><DocumentKindChips title="Documents pour le retrait par un tiers" values={bib.thirdPartyDocumentKinds} options={[['id_copy', 'Copie de la pièce d’identité'], ['proxy_letter', 'Procuration'], ['registration_qr', 'QR d’inscription'], ['other', 'Autre']]} onChange={(thirdPartyDocumentKinds) => update({ thirdPartyDocumentKinds })} />{bib.thirdPartyDocumentKinds.includes('other') ? <TextAreaField label="Autre document tiers" hint={`${(bib.thirdPartyDocumentsOther ?? '').length}/200 caractères`} value={bib.thirdPartyDocumentsOther ?? ''} onChange={(thirdPartyDocumentsOther) => update({ thirdPartyDocumentsOther: thirdPartyDocumentsOther.slice(0, 200) || null })} /> : null}{bib.thirdPartyPickupConditions ? <LegacyText text={bib.thirdPartyPickupConditions} /> : null}</div> : null}
        <SwitchRow label="Contrôle du matériel au retrait" checked={bib.equipmentCheck === true} onCheckedChange={(equipmentCheck) => update({ equipmentCheck })} />
      </div>
      <TextAreaField label="Note dossard" value={bib.note ?? ""} onChange={(value) => update({ note: value || null })} />
    </section>
  );
}

function DocumentKindChips<T extends string>({ title, values, options, onChange }: { title: string; values: T[]; options: readonly (readonly [T, string])[]; onChange: (values: T[]) => void }) {
  return <fieldset className="space-y-2"><legend className="text-sm font-semibold">{title}</legend><div className="flex flex-wrap gap-2">{options.map(([value, label]) => <ToggleChip key={value} checked={values.includes(value)} label={label} onChange={(checked) => onChange(checked ? [...values, value] : values.filter((item) => item !== value))} />)}</div></fieldset>;
}

export function AccessEditor({
  scope,
  activeRace,
  eventDetails,
  raceDetails,
  onEventChange,
  onRaceChange,
  editionStartDate,
}: {
  scope: "event" | "format";
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
  onRaceChange: (details: OrganizerRaceDetails) => void;
  editionStartDate?: string | null;
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
        showHeader={false}
        editionStartDate={editionStartDate}
        editionEndDate={eventDetails.dateRange.endDate}
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
        editionStartDate={editionStartDate}
        editionEndDate={eventDetails.dateRange.endDate}
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
  editionStartDate,
  editionEndDate,
}: {
  title: string;
  description: string;
  access: OrganizerEventDetails["access"];
  biasLocation?: OrganizerEventDetails["eventLocation"];
  onAccessChange: (access: OrganizerEventDetails["access"]) => void;
  formatMode?: boolean;
  showRunnerInfoToggle?: boolean;
  showHeader?: boolean;
  editionStartDate?: string | null;
  editionEndDate?: string | null;
}) {
  const update = (next: Partial<OrganizerEventDetails["access"]>) => onAccessChange({ ...access, ...next });
  const updateSection = (key: keyof OrganizerEventDetails["access"]["enabledSections"], checked: boolean) =>
    update({ enabledSections: { ...access.enabledSections, [key]: checked } });
  const missingStartAddress = !access.startAddress?.trim();
  const finishMatchesStart = Boolean(access.startAddress?.trim() && access.startAddress.trim() === access.finishAddress?.trim());
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
          {finishMatchesStart ? null : <AddressAutocompleteField
            label="Adresse arrivée"
            value={access.finishAddress ?? ""}
            location={access.finishLocation}
            biasLocation={biasLocation}
            onChange={(value) => update({ finishAddress: value || null })}
            onLocationChange={(finishLocation) => update({ finishLocation })}
          />}
      </div>
      <SwitchRow
        label="Arrivée au même endroit que le départ"
        checked={finishMatchesStart}
        onCheckedChange={(checked) => update(checked
          ? { finishAddress: access.startAddress, finishLocation: access.startLocation }
          : { finishAddress: null, finishLocation: { label: null, lat: null, lng: null, googleMapsUrl: null, source: "manual" } })}
      />

      <TextAreaField label="Information prioritaire" hint="À réserver aux consignes critiques : dernière navette, accès fermé ou horaire important." value={access.note ?? ""} onChange={(value) => update({ note: value || null })} />

      <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2">
      <OptionalModule
        title="Carte générale"
        addLabel="+ Ajouter une carte générale"
        active={mapOpen}
        onAdd={() => { setMapOpen(true); updateSection("mapUrl", true); }}
        onRemove={() => { setMapOpen(false); updateSection("mapUrl", false); }}
      >
          <TextField label="Lien vers une carte générale (optionnel)" value={access.mapUrl ?? ""} onChange={(value) => update({ mapUrl: value || null })} placeholder="https://..." />
      </OptionalModule>

      <OptionalModule
        title="Routes fermées"
        addLabel="+ Ajouter les routes fermées"
        active={restrictionsOpen}
        onAdd={() => { setRestrictionsOpen(true); updateSection("roadRestrictions", true); }}
        onRemove={() => { setRestrictionsOpen(false); updateSection("roadRestrictions", false); }}
      >
          <TextAreaField label="Routes fermées / restrictions" value={access.roadRestrictions ?? ""} onChange={(value) => update({ roadRestrictions: value || null })} />
      </OptionalModule>

      <OptionalModule
        title="Parkings"
        addLabel="+ Ajouter les parkings"
        active={parkingsOpen}
        onAdd={() => { setParkingsOpen(true); updateSection("officialParkings", true); }}
        onRemove={() => { setParkingsOpen(false); updateSection("officialParkings", false); }}
      >
          <ParkingCards parkings={access.parkings} biasLocation={biasLocation} onChange={(parkings) => update({ parkings })} />
          {access.officialParkings ? <LegacyText text={access.officialParkings} /> : null}
      </OptionalModule>

      <div className="sm:col-span-2">
      <OptionalModule
        title="Navettes"
        addLabel="+ Ajouter les navettes"
        active={shuttlesOpen}
        onAdd={() => { setShuttlesOpen(true); updateSection("shuttles", true); }}
        onRemove={() => { setShuttlesOpen(false); updateSection("shuttles", false); }}
      >
          <ShuttleCards lines={access.shuttleLines} editionDays={editionDays(editionStartDate, editionEndDate)} biasLocation={biasLocation} onChange={(shuttleLines) => update({ shuttleLines })} />
          {access.shuttles || access.shuttleSchedule ? <LegacyText text={[access.shuttles, access.shuttleSchedule].filter(Boolean).join("\n\n")} /> : null}
      </OptionalModule>
      </div>
      </div>

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

function LegacyText({ text }: { text: string }) {
  return <details className="rounded-lg border border-border bg-muted/20 p-3"><summary className="cursor-pointer text-sm font-semibold">Texte à convertir</summary><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{text}</p></details>;
}

function editionDays(start?: string | null, end?: string | null) {
  if (!start) return [];
  const first = new Date(`${start}T12:00:00Z`);
  const last = end ? new Date(`${end}T12:00:00Z`) : first;
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime()) || last < first) return [];
  const days: string[] = [];
  for (let cursor = first; cursor <= last && days.length < 14; cursor = new Date(cursor.getTime() + 86_400_000)) days.push(cursor.toISOString().slice(0, 10));
  return days;
}

function ParkingCards({ parkings, biasLocation, onChange }: { parkings: OrganizerEventDetails['access']['parkings']; biasLocation?: OrganizerEventDetails['eventLocation']; onChange: (value: OrganizerEventDetails['access']['parkings']) => void }) {
  const patch = (index: number, next: Partial<(typeof parkings)[number]>) => onChange(parkings.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));
  return <div className="space-y-3">{parkings.map((parking, index) => <article key={parking.id} className="space-y-3 rounded-xl border border-border bg-background p-3"><div className="flex gap-2"><div className="min-w-0 flex-1"><TextField label={`Parking ${index + 1}`} value={parking.name} onChange={(name) => patch(index, { name })} /></div><Button type="button" variant="ghost" onClick={() => onChange(parkings.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Supprimer ${parking.name}`}>×</Button></div><AddressAutocompleteField label="Adresse" value={parking.location.label ?? ''} location={parking.location} biasLocation={biasLocation} onChange={(label) => patch(index, { location: { ...parking.location, label: label || null } })} onLocationChange={(location) => patch(index, { location })} /><div className="grid gap-3 sm:grid-cols-2"><NumberField label="Capacité" value={parking.capacity ?? 0} emptyWhenZero step="1" onChange={(capacity) => patch(index, { capacity: capacity > 0 ? Math.round(capacity) : null })} /><SegmentedChoice label="Tarif" value={parking.paid === null ? 'unknown' : parking.paid ? 'paid' : 'free'} options={[{ value: 'unknown', label: 'Non précisé' }, { value: 'free', label: 'Gratuit' }, { value: 'paid', label: 'Payant' }] as const} onChange={(value) => patch(index, { paid: value === 'unknown' ? null : value === 'paid' })} /></div><TextAreaField label="Note courte" hint={`${(parking.note ?? '').length}/200 caractères`} value={parking.note ?? ''} onChange={(note) => patch(index, { note: note.slice(0, 200) || null })} /></article>)}<Button type="button" variant="ghost" onClick={() => onChange([...parkings, { id: crypto.randomUUID(), name: `Parking ${parkings.length + 1}`, location: { label: null, lat: null, lng: null, googleMapsUrl: null, source: null }, capacity: null, paid: null, note: null }])}>+ Parking</Button></div>;
}

function ShuttleCards({ lines, editionDays: days, biasLocation, onChange }: { lines: OrganizerEventDetails['access']['shuttleLines']; editionDays: string[]; biasLocation?: OrganizerEventDetails['eventLocation']; onChange: (value: OrganizerEventDetails['access']['shuttleLines']) => void }) {
  const patch = (index: number, next: Partial<(typeof lines)[number]>) => onChange(lines.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));
  return <div className="space-y-3">{lines.map((line, index) => <article key={line.id} className="space-y-3 rounded-xl border border-border bg-background p-3"><div className="flex justify-between"><p className="font-semibold">Ligne {index + 1}</p><Button type="button" variant="ghost" onClick={() => onChange(lines.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Supprimer la ligne ${index + 1}`}>×</Button></div><div className="grid gap-3 sm:grid-cols-2"><AddressAutocompleteField label="De" value={line.from.label ?? ''} location={line.from} biasLocation={biasLocation} onChange={(label) => patch(index, { from: { ...line.from, label: label || null } })} onLocationChange={(from) => patch(index, { from })} /><AddressAutocompleteField label="À" value={line.to.label ?? ''} location={line.to} biasLocation={biasLocation} onChange={(label) => patch(index, { to: { ...line.to, label: label || null } })} onLocationChange={(to) => patch(index, { to })} /></div><div className="flex flex-wrap gap-2">{days.map((day) => <button type="button" key={day} className={cn('rounded-full border px-3 py-1 text-xs', line.days.includes(day) && 'border-brand bg-brand-surface text-brand')} onClick={() => patch(index, { days: line.days.includes(day) ? line.days.filter((item) => item !== day) : [...line.days, day] })}>{day.split('-').reverse().join('/')}</button>)}</div><div className="grid gap-3 sm:grid-cols-3"><TextField label="Début" type="time" value={line.startTime ?? ''} onChange={(startTime) => patch(index, { startTime: startTime || null })} /><TextField label="Fin" type="time" value={line.endTime ?? ''} onChange={(endTime) => patch(index, { endTime: endTime || null })} /><NumberField label="Fréquence (min)" value={line.frequencyMinutes ?? 0} emptyWhenZero step="1" onChange={(frequencyMinutes) => patch(index, { frequencyMinutes: frequencyMinutes > 0 ? Math.round(frequencyMinutes) : null })} /></div><div className="grid gap-3 sm:grid-cols-2"><TextField label="Réservation" type="url" value={line.bookingUrl ?? ''} onChange={(bookingUrl) => patch(index, { bookingUrl: bookingUrl || null })} /><SegmentedChoice label="Tarif" value={line.free === null ? 'unknown' : line.free ? 'free' : 'paid'} options={[{ value: 'unknown', label: 'Non précisé' }, { value: 'free', label: 'Gratuite' }, { value: 'paid', label: 'Payante' }] as const} onChange={(value) => patch(index, { free: value === 'unknown' ? null : value === 'free' })} /></div><TextAreaField label="Note courte" hint={`${(line.note ?? '').length}/200 caractères`} value={line.note ?? ''} onChange={(note) => patch(index, { note: note.slice(0, 200) || null })} /></article>)}<Button type="button" variant="ghost" onClick={() => onChange([...lines, { id: crypto.randomUUID(), from: { label: null, lat: null, lng: null, googleMapsUrl: null, source: null }, to: { label: null, lat: null, lng: null, googleMapsUrl: null, source: null }, days: [], startTime: null, endTime: null, frequencyMinutes: null, bookingUrl: null, free: null, note: null }])}>+ Ligne de navette</Button></div>;
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
