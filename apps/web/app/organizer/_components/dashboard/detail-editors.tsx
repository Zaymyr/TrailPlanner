import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { cn } from "../../../../components/utils";
import type { OrganizerEventDetails, OrganizerRaceDetails } from "../../../../lib/organizer-dashboard-details";
import { equipmentSuggestions } from "./constants";
import { TextAreaField, TextField, ToggleChip } from "./controls";
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
        onEquipmentChange={(mandatoryEquipment) => onEventChange({ ...eventDetails, mandatoryEquipment })}
      />
    );
  }

  if (!activeRace) {
    return <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Sélectionne un format pour ajouter du matériel spécifique.</p>;
  }

  return (
    <EquipmentFields
      title={`Matériel - ${activeRace.name}`}
      description="Cette liste contient tout le matériel visible sur cette course. Retirer un item partagé l'enlève du commun."
      equipment={raceDetails.mandatoryEquipment}
      sharedWeatherPlan={eventDetails.mandatoryEquipment.weatherPlan}
      onEquipmentChange={(mandatoryEquipment) => onRaceChange({ ...raceDetails, mandatoryEquipment })}
    />
  );
}

function EquipmentFields({
  title,
  description,
  equipment,
  weatherPlanEditable = false,
  sharedWeatherPlan,
  onEquipmentChange,
}: {
  title: string;
  description: string;
  equipment: OrganizerEventDetails["mandatoryEquipment"];
  weatherPlanEditable?: boolean;
  sharedWeatherPlan?: OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"];
  onEquipmentChange: (equipment: OrganizerEventDetails["mandatoryEquipment"]) => void;
}) {
  const updateItems = (items: OrganizerEventDetails["mandatoryEquipment"]["items"]) => onEquipmentChange({ ...equipment, items });
  const updateWeatherPlan = (weatherPlan: OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"]) => onEquipmentChange({ ...equipment, weatherPlan });
  const missingEquipment = equipment.items.length === 0 && !equipment.note?.trim();
  const existingLabels = new Set(equipment.items.map((item) => item.label.trim().toLocaleLowerCase("fr-FR")));
  const availableSuggestions = equipmentSuggestions.filter((suggestion) => !existingLabels.has(suggestion.toLocaleLowerCase("fr-FR")));
  const effectiveWeatherPlan = sharedWeatherPlan ?? equipment.weatherPlan;
  const weatherPlanLabel = effectiveWeatherPlan === "cold" ? "Grand froid" : effectiveWeatherPlan === "heat" ? "Grosse chaleur" : "Normal";

  return (
    <section className={cn("space-y-4 rounded-lg border bg-background p-4", missingEquipment ? "border-amber-300" : "border-border")}>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {weatherPlanEditable ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Plan météo actif</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "normal", label: "Normal" },
              { value: "cold", label: "Grand froid" },
              { value: "heat", label: "Grosse chaleur" },
            ].map((option) => (
              <label
                key={option.value}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  equipment.weatherPlan === option.value ? "border-brand bg-brand/10 text-foreground" : "border-border bg-background text-foreground"
                )}
              >
                <input
                  type="radio"
                  name={`${title}-weather-plan`}
                  value={option.value}
                  checked={equipment.weatherPlan === option.value}
                  onChange={() => updateWeatherPlan(option.value as OrganizerEventDetails["mandatoryEquipment"]["weatherPlan"])}
                  className="h-4 w-4"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Plan météo actif: <span className="font-medium text-foreground">{weatherPlanLabel}</span>
        </div>
      )}
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
          <div key={item.id ?? index} className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-[auto_1fr_auto_auto]">
            <div className="flex flex-col gap-2 md:pt-1">
              <ToggleChip
                checked={item.cold}
                label="Grand froid"
                onChange={(checked) =>
                  updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, cold: checked } : candidate)))
                }
              />
              <ToggleChip
                checked={item.heat}
                label="Grosse chaleur"
                onChange={(checked) =>
                  updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, heat: checked } : candidate)))
                }
              />
            </div>
            <Input
              value={item.label}
              onChange={(event) =>
                updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, label: event.target.value } : candidate)))
              }
            />
            <div className="flex flex-wrap gap-2">
              {[
                { value: "required", label: "Obligatoire" },
                { value: "recommended", label: "Recommandé" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm",
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
            <Button type="button" variant="ghost" onClick={() => updateItems(equipment.items.filter((_, itemIndex) => itemIndex !== index))}>
              Retirer
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => updateItems([...equipment.items, { id: `item-${Date.now()}`, label: "Nouvel item", required: true, cold: false, heat: false, note: null }])}
      >
        Ajouter un item
      </Button>
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
      onBibChange={(bibPickup) => onEventChange({ ...eventDetails, bibPickup })}
    />
  );
}

function BibPickupFields({
  title,
  description,
  bib,
  onBibChange,
}: {
  title: string;
  description: string;
  bib: OrganizerEventDetails["bibPickup"];
  onBibChange: (bib: OrganizerEventDetails["bibPickup"]) => void;
}) {
  const update = (next: Partial<OrganizerEventDetails["bibPickup"]>) => onBibChange({ ...bib, ...next });
  const missingLocation = !bib.location?.trim();
  const missingSchedule = !bib.schedule?.trim();

  return (
    <section className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Lieu de retrait" value={bib.location ?? ""} onChange={(value) => update({ location: value || null })} invalid={missingLocation} />
        <TextField label="Horaires retrait" value={bib.schedule ?? ""} onChange={(value) => update({ schedule: value || null })} invalid={missingSchedule} />
      </div>
      <TextAreaField label="Documents nécessaires" value={bib.requiredDocuments ?? ""} onChange={(value) => update({ requiredDocuments: value || null })} />
      <div className="flex flex-wrap gap-2">
        <ToggleChip checked={bib.thirdPartyPickupAllowed === true} label="Retrait par tiers" onChange={(checked) => update({ thirdPartyPickupAllowed: checked })} />
        <ToggleChip checked={bib.equipmentCheck === true} label="Contrôle matériel" onChange={(checked) => update({ equipmentCheck: checked })} />
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
        onAccessChange={(access) => onEventChange({ ...eventDetails, access })}
        formatMode
        showRunnerInfoToggle={false}
      />
    );
  }

  if (!activeRace) {
    return <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Sélectionne un format pour ajouter un accès ou une information spécifique.</p>;
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-background p-4">
      <AccessFields
        title={`Accès - ${activeRace.name}`}
        description="Renseigne le départ, l'arrivée et active seulement les sections utiles à ce format."
        access={raceDetails.access}
        onAccessChange={(access) => onRaceChange({ ...raceDetails, access })}
        formatMode
      />
      {raceDetails.access.enabledSections.runnerInfo ? (
        <RunnerInfoFields runnerInfo={raceDetails.runnerInfo} onRunnerInfoChange={(runnerInfo) => onRaceChange({ ...raceDetails, runnerInfo })} />
      ) : null}
    </section>
  );
}

function AccessFields({
  title,
  description,
  access,
  onAccessChange,
  formatMode = false,
  showRunnerInfoToggle = formatMode,
}: {
  title: string;
  description: string;
  access: OrganizerEventDetails["access"];
  onAccessChange: (access: OrganizerEventDetails["access"]) => void;
  formatMode?: boolean;
  showRunnerInfoToggle?: boolean;
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

  return (
    <section className="space-y-4">
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Adresse départ" value={access.startAddress ?? ""} onChange={(value) => update({ startAddress: value || null })} invalid={missingStartAddress} />
        <TextField label="Adresse arrivée" value={access.finishAddress ?? ""} onChange={(value) => update({ finishAddress: value || null })} />
      </div>
      {formatMode ? (
        <div className="flex flex-wrap gap-2">
          <ToggleChip checked={access.enabledSections.officialParkings} label="Parkings" onChange={(checked) => updateSection("officialParkings", checked)} />
          <ToggleChip checked={access.enabledSections.shuttles} label="Navettes" onChange={(checked) => updateSection("shuttles", checked)} />
          <ToggleChip checked={access.enabledSections.roadRestrictions} label="Restrictions route" onChange={(checked) => updateSection("roadRestrictions", checked)} />
          <ToggleChip checked={access.enabledSections.mapUrl} label="Carte / Google Maps" onChange={(checked) => updateSection("mapUrl", checked)} />
          {showRunnerInfoToggle ? (
            <ToggleChip checked={access.enabledSections.runnerInfo} label="Infos coureur spécifiques" onChange={(checked) => updateSection("runnerInfo", checked)} />
          ) : null}
        </div>
      ) : null}
      {(!formatMode || access.enabledSections.officialParkings) ? (
        <TextAreaField label="Parkings officiels" value={access.officialParkings ?? ""} onChange={(value) => update({ officialParkings: value || null })} invalid={missingParkingOrShuttle} />
      ) : null}
      {(!formatMode || access.enabledSections.shuttles) ? (
        <>
          <TextAreaField label="Navettes" value={access.shuttles ?? ""} onChange={(value) => update({ shuttles: value || null })} invalid={missingParkingOrShuttle} />
          <TextAreaField label="Horaires navettes" value={access.shuttleSchedule ?? ""} onChange={(value) => update({ shuttleSchedule: value || null })} />
        </>
      ) : null}
      {(!formatMode || access.enabledSections.roadRestrictions) ? (
        <TextAreaField label="Routes fermées / restrictions" value={access.roadRestrictions ?? ""} onChange={(value) => update({ roadRestrictions: value || null })} />
      ) : null}
      {(!formatMode || access.enabledSections.mapUrl) ? (
        <TextField label="Lien Google Maps ou adresse" value={access.mapUrl ?? ""} onChange={(value) => update({ mapUrl: value || null })} placeholder="https://..." />
      ) : null}
      <TextAreaField label="Note accès" value={access.note ?? ""} onChange={(value) => update({ note: value || null })} />
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
      <div>
        <p className="font-semibold text-foreground">Informations coureur spécifiques</p>
        <p className="text-sm text-muted-foreground">Briefing, zone de départ ou consigne propre au format actif.</p>
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

export function PreviewLauncher({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-5">
      <p className="text-sm text-muted-foreground">Ouvre une version simple côté coureur pour vérifier les informations renseignées.</p>
      <Button type="button" className="mt-3" onClick={onPreview}>
        Prévisualiser côté coureur
      </Button>
    </div>
  );
}
