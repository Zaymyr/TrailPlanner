import { useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { cn } from "../../../../components/utils";
import {
  defaultOrganizerEventDetails,
  getOrganizerBibPickupLocations,
  hasRaceAccessOverride,
  type OrganizerBibPickupLocation,
  type OrganizerBibPickupSlot,
  type OrganizerEventDetails,
  type OrganizerRaceDetails,
} from "../../../../lib/organizer-dashboard-details";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import { equipmentSuggestions } from "./constants";
import { CollapsibleRow, ContextualHelp, OptionalModule, TextAreaField, TextField, ToggleChip } from "./controls";
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
  onEquipmentChange,
}: {
  title: string;
  description: string;
  equipment: OrganizerEventDetails["mandatoryEquipment"];
  weatherPlanEditable?: boolean;
  sharedWeatherPlan?: OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"];
  showHeader?: boolean;
  onEquipmentChange: (equipment: OrganizerEventDetails["mandatoryEquipment"]) => void;
}) {
  const updateItems = (items: OrganizerEventDetails["mandatoryEquipment"]["items"]) => onEquipmentChange({ ...equipment, items });
  const updateWeatherPlan = (weatherPlan: OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"]) => onEquipmentChange({ ...equipment, weatherPlan });
  const missingEquipment = equipment.items.length === 0 && !equipment.note?.trim();
  const existingLabels = new Set(equipment.items.map((item) => item.label.trim().toLocaleLowerCase("fr-FR")));
  const availableSuggestions = equipmentSuggestions.filter((suggestion) => !existingLabels.has(suggestion.toLocaleLowerCase("fr-FR")));
  const effectiveWeatherPlan = sharedWeatherPlan ?? equipment.weatherPlan;
  const weatherPlanLabel = effectiveWeatherPlan === "cold" ? "Grand froid" : effectiveWeatherPlan === "heat" ? "Grosse chaleur" : "Normal";
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null);
  const [weatherVariantsOpen, setWeatherVariantsOpen] = useState(
    equipment.weatherPlan !== "normal" || equipment.items.some((item) => item.cold || item.heat)
  );

  return (
    <section className={cn("space-y-4", missingEquipment && "rounded-lg border border-amber-300 p-4")}>
      {showHeader ? (
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{title}</p>
          <ContextualHelp text={description} />
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Matériel selon la météo : <span className="font-medium text-foreground">{weatherPlanLabel.toLocaleLowerCase("fr-FR")}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {availableSuggestions.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => updateItems([...equipment.items, { id: `item-${Date.now()}`, label: suggestion, required: true, cold: false, heat: false, note: null }])}
          >
            + {suggestion}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {equipment.items.map((item, index) => (
          <CollapsibleRow
            key={item.id ?? index}
            expanded={expandedItemIndex === index}
            onToggle={() => setExpandedItemIndex((current) => current === index ? null : index)}
            summary={`${item.label || `Item ${index + 1}`} · ${item.required ? "Obligatoire" : "Recommandé"}${item.cold ? " · Grand froid" : ""}${item.heat ? " · Grosse chaleur" : ""}`}
            actions={(
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 shrink-0 px-0 text-red-600 hover:text-red-700"
                onClick={() => updateItems(equipment.items.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={`Retirer ${item.label || "cet item"}`}
                title="Retirer"
              >
                ×
              </Button>
            )}
          >
            <div className="space-y-3">
              <Input
                aria-label={`Item de matériel n°${index + 1}`}
                value={item.label}
                onChange={(event) =>
                  updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, label: event.target.value } : candidate)))
                }
                className="h-10"
              />
              {weatherVariantsOpen ? <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={item.cold}
                    onChange={(event) =>
                      updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, cold: event.target.checked } : candidate)))
                    }
                    className="h-4 w-4"
                  />
                  <span>Grand froid</span>
                </label>
                <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={item.heat}
                    onChange={(event) =>
                      updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, heat: event.target.checked } : candidate)))
                    }
                    className="h-4 w-4"
                  />
                  <span>Grosse chaleur</span>
                </label>
              </div> : null}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: "required", label: "Obligatoire" },
                { value: "recommended", label: "Recommandé" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap",
                    (item.required ? "required" : "recommended") === option.value
                      ? "border-brand bg-brand/10 text-foreground"
                      : "border-border bg-background text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name={`equipment-${index}-status`}
                    value={option.value}
                    checked={(item.required ? "required" : "recommended") === option.value}
                    onChange={() =>
                      updateItems(
                        equipment.items.map((candidate, itemIndex) =>
                          itemIndex === index ? { ...candidate, required: option.value === "required" } : candidate
                        )
                      )
                    }
                    className="h-4 w-4"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            </div>
          </CollapsibleRow>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          updateItems([...equipment.items, { id: `item-${Date.now()}`, label: "Nouvel item", required: true, cold: false, heat: false, note: null }]);
          setExpandedItemIndex(equipment.items.length);
        }}
      >
        Ajouter un item
      </Button>
      <TextAreaField
        label="Note matériel"
        value={equipment.note ?? ""}
        onChange={(value) => onEquipmentChange({ ...equipment, note: value || null })}
        invalid={missingEquipment}
      />
      {weatherPlanEditable ? (
        <OptionalModule
          title="les variantes météo"
          active={weatherVariantsOpen}
          onAdd={() => setWeatherVariantsOpen(true)}
          onRemove={() => setWeatherVariantsOpen(false)}
        >
          <p className="text-sm text-muted-foreground">Coche si l’item n’est exigé qu’en cas de grand froid ou de forte chaleur.</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "normal", label: "Conditions normales" },
              { value: "cold", label: "Grand froid" },
              { value: "heat", label: "Grosse chaleur" },
            ].map((option) => (
              <label key={option.value} className={cn("inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm", equipment.weatherPlan === option.value ? "border-brand bg-brand/10" : "border-border")}>
                <input type="radio" name={`${title}-weather-plan`} checked={equipment.weatherPlan === option.value} onChange={() => updateWeatherPlan(option.value as OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"])} />
                {option.label}
              </label>
            ))}
          </div>
        </OptionalModule>
      ) : null}
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
  framed = true,
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
  const [expandedLocationIndex, setExpandedLocationIndex] = useState<number | null>(null);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);
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
    setExpandedLocationIndex(locations.length);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">Lieux et créneaux</p>
          <ContextualHelp text="Ajoute autant de lieux, de jours et de plages horaires que nécessaire." />
        </div>
        <Button type="button" variant="outline" onClick={addLocation}>
          Ajouter un lieu
        </Button>
      </div>
      {locations.length === 0 ? (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50/50 p-4 text-sm text-amber-800">
          Aucun lieu de retrait renseigné.
        </p>
      ) : (
        <div className="space-y-4">
          {locations.map((pickupLocation, locationIndex) => {
            const missingLocation = !pickupLocation.location?.trim();
            return (
              <CollapsibleRow
                key={`bib-location-${locationIndex}`}
                expanded={expandedLocationIndex === locationIndex}
                onToggle={() => setExpandedLocationIndex((current) => current === locationIndex ? null : locationIndex)}
                summary={`${pickupLocation.location || `Lieu de retrait ${locationIndex + 1}`} · ${pickupLocation.slots.length} créneau${pickupLocation.slots.length > 1 ? "x" : ""}`}
                actions={(
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 px-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    onClick={() => updateLocations(locations.filter((_, index) => index !== locationIndex))}
                  >
                    Supprimer
                  </Button>
                )}
              >
                {hideLocationDetails ? (
                  <TextField label="Lieu de retrait" value={pickupLocation.location ?? ""} onChange={(value) => updateLocation(locationIndex, { location: value || null })} />
                ) : (
                  <AddressAutocompleteField
                    label="Adresse du lieu"
                    value={pickupLocation.location ?? ""}
                    location={pickupLocation.locationDetails}
                    biasLocation={pickupLocation.locationDetails}
                    onChange={(value) => updateLocation(locationIndex, { location: value || null })}
                    onLocationChange={(locationDetails) =>
                      updateLocation(locationIndex, { location: locationDetails.label, locationDetails })
                    }
                    invalid={missingLocation}
                  />
                )}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Jours et plages horaires</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setExpandedSlotKey(`${locationIndex}:${pickupLocation.slots.length}`);
                        updateSlots(locationIndex, [
                          ...pickupLocation.slots,
                          { date: null, startTime: null, endTime: null },
                        ]);
                      }}
                    >
                      Ajouter un créneau
                    </Button>
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
                        <CollapsibleRow
                          key={`bib-location-${locationIndex}-slot-${slotIndex}`}
                          expanded={expandedSlotKey === `${locationIndex}:${slotIndex}`}
                          onToggle={() => setExpandedSlotKey((current) => current === `${locationIndex}:${slotIndex}` ? null : `${locationIndex}:${slotIndex}`)}
                          summary={`${slot.date || "Jour à définir"} · ${slot.startTime || "--:--"}–${slot.endTime || "--:--"}`}
                          actions={(
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-9 px-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                              onClick={() => updateSlots(locationIndex, pickupLocation.slots.filter((_, index) => index !== slotIndex))}
                            >
                              Supprimer
                            </Button>
                          )}
                        >
                          <div className="grid gap-3 md:grid-cols-3">
                            <TextField label="Jour" type="date" value={slot.date ?? ""} onChange={(date) => updateSlot({ date: date || null })} invalid={!slot.date} />
                            <TextField label="Début" type="time" value={slot.startTime ?? ""} onChange={(startTime) => updateSlot({ startTime: startTime || null })} invalid={!slot.startTime} />
                            <TextField label="Fin" type="time" value={slot.endTime ?? ""} onChange={(endTime) => updateSlot({ endTime: endTime || null })} invalid={!slot.endTime} />
                          </div>
                        </CollapsibleRow>
                      );
                    })
                  )}
                </div>
              </CollapsibleRow>
            );
          })}
        </div>
      )}
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
          <ToggleChip checked={bib.thirdPartyPickupAllowed === true} label={bib.thirdPartyPickupAllowed ? "Oui" : "Non"} onChange={(checked) => update({ thirdPartyPickupAllowed: checked })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Un contrôle du matériel est-il prévu au retrait ?</p>
          <ToggleChip checked={bib.equipmentCheck === true} label={bib.equipmentCheck ? "Oui" : "Non"} onChange={(checked) => update({ equipmentCheck: checked })} />
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
