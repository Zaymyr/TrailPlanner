import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../components/utils';
import type { OrganizerEventDetails, OrganizerRaceDetails } from '../../../../lib/organizer-dashboard-details';
import { equipmentSuggestions } from './constants';
import { NumberField, TextAreaField, TextField, ToggleChip } from './controls';
import { formatKm } from './helpers';
import type { AidStationDraft, RaceFormat, RaceFormValues } from './types';

export function EquipmentEditor({
  scope,
  activeRace,
  eventDetails,
  raceDetails,
  onEventChange,
  onRaceChange,
  onSaveEvent,
  onSaveRace,
  status,
}: {
  scope: "event" | "format";
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
  onRaceChange: (details: OrganizerRaceDetails) => void;
  onSaveEvent: () => void;
  onSaveRace: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  if (scope === "event") {
    return (
      <EquipmentFields
        title="Materiel commun a tous les formats"
        description="Renseigne ici uniquement ce qui vaut pour chaque course de l'evenement."
        equipment={eventDetails.mandatoryEquipment}
        onEquipmentChange={(mandatoryEquipment) => onEventChange({ ...eventDetails, mandatoryEquipment })}
        onSave={onSaveEvent}
        saveLabel="Sauvegarder le commun"
        disabled={status === "saving"}
      />
    );
  }

  if (!activeRace) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
        Selectionne un format pour ajouter du materiel specifique.
      </p>
    );
  }

  return (
    <EquipmentFields
      title={`Materiel - ${activeRace.name}`}
      description="Ajoute les obligations ou recommandations propres a ce format."
      equipment={raceDetails.mandatoryEquipment}
      onEquipmentChange={(mandatoryEquipment) => onRaceChange({ ...raceDetails, mandatoryEquipment })}
      onSave={onSaveRace}
      saveLabel="Sauvegarder ce format"
      disabled={status === "saving"}
    />
  );
}

export function EquipmentFields({
  title,
  description,
  equipment,
  onEquipmentChange,
  onSave,
  saveLabel,
  disabled,
}: {
  title: string;
  description: string;
  equipment: OrganizerEventDetails["mandatoryEquipment"];
  onEquipmentChange: (equipment: OrganizerEventDetails["mandatoryEquipment"]) => void;
  onSave: () => void;
  saveLabel: string;
  disabled?: boolean;
}) {
  const updateItems = (items: OrganizerEventDetails["mandatoryEquipment"]["items"]) =>
    onEquipmentChange({ ...equipment, items });
  const missingEquipment = equipment.items.length === 0 && !equipment.note?.trim();

  return (
    <section className={cn("space-y-4 rounded-lg border bg-background p-4", missingEquipment ? "border-amber-300" : "border-border")}>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {equipmentSuggestions.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              if (equipment.items.some((item) => item.label.toLowerCase() === suggestion.toLowerCase())) return;
              updateItems([...equipment.items, { id: `item-${Date.now()}`, label: suggestion, required: true, note: null }]);
            }}
          >
            + {suggestion}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {equipment.items.map((item, index) => (
          <div key={item.id ?? index} className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-[1fr_auto_auto]">
            <Input
              value={item.label}
              onChange={(event) =>
                updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, label: event.target.value } : candidate)))
              }
            />
            <select
              className="h-10 rounded-md border border-border bg-card px-3 text-sm"
              value={item.required ? "required" : "recommended"}
              onChange={(event) =>
                updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, required: event.target.value === "required" } : candidate)))
              }
            >
              <option value="required">Obligatoire</option>
              <option value="recommended">Recommande</option>
            </select>
            <Button type="button" variant="ghost" onClick={() => updateItems(equipment.items.filter((_, itemIndex) => itemIndex !== index))}>
              Retirer
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => updateItems([...equipment.items, { id: `item-${Date.now()}`, label: "Nouvel item", required: true, note: null }])}
      >
        Ajouter un item
      </Button>
      <TextAreaField
        label="Note materiel"
        value={equipment.note ?? ""}
        onChange={(value) => onEquipmentChange({ ...equipment, note: value || null })}
        invalid={missingEquipment}
      />
      <Button type="button" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </Button>
    </section>
  );
}

export function ScheduleEditor({
  activeRace,
  raceForm,
  aidStations,
  onChange,
  onSave,
  status,
}: {
  activeRace: RaceFormat | null;
  raceForm: RaceFormValues;
  aidStations: AidStationDraft[];
  onChange: (next: Partial<RaceFormValues>) => void;
  onSave: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  if (!activeRace) return <p className="text-sm text-muted-foreground">Selectionne un format pour renseigner les horaires.</p>;
  const schedule = raceForm.organizerDetails.schedule;
  const updateSchedule = (next: Partial<OrganizerRaceDetails["schedule"]>) =>
    onChange({ organizerDetails: { ...raceForm.organizerDetails, schedule: { ...schedule, ...next } } });
  const cutoffStations = aidStations.filter((station) => station.organizerDetails.cutoffTime);
  const missingStartTime = !schedule.startTime?.trim();
  const missingFinishCutoff = !schedule.finishCutoffTime?.trim() && !schedule.cutoffNote?.trim();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Heure de depart" value={schedule.startTime ?? ""} onChange={(value) => updateSchedule({ startTime: value || null })} invalid={missingStartTime} />
        <TextField label="Heure limite arrivee" value={schedule.finishCutoffTime ?? ""} onChange={(value) => updateSchedule({ finishCutoffTime: value || null })} invalid={missingFinishCutoff} />
      </div>
      <TextAreaField label="Horaires navettes" value={schedule.shuttleSchedule ?? ""} onChange={(value) => updateSchedule({ shuttleSchedule: value || null })} />
      <TextAreaField label="Note horaires / barrieres" value={schedule.cutoffNote ?? ""} onChange={(value) => updateSchedule({ cutoffNote: value || null })} invalid={missingFinishCutoff} />
      <div className="rounded-md border border-border bg-background p-3">
        <p className="text-sm font-semibold">Barrieres liees aux ravitos</p>
        {cutoffStations.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Aucune barriere renseignee dans les ravitos.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {cutoffStations.map((station) => (
              <li key={station.id ?? station.name}>
                {station.name} - {formatKm(station.distanceKm)} - {station.organizerDetails.cutoffTime}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button type="button" onClick={onSave} disabled={status === "saving"}>
        Sauvegarder les horaires
      </Button>
    </div>
  );
}

export function BibPickupEditor({
  scope,
  activeRace,
  eventDetails,
  raceDetails,
  onEventChange,
  onRaceChange,
  onSaveEvent,
  onSaveRace,
  status,
}: {
  scope: "event" | "format";
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
  onRaceChange: (details: OrganizerRaceDetails) => void;
  onSaveEvent: () => void;
  onSaveRace: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  if (scope === "event") {
    return (
      <BibPickupFields
        title="Retrait dossard commun"
        description="Renseigne les infos valables pour tous les formats."
        bib={eventDetails.bibPickup}
        onBibChange={(bibPickup) => onEventChange({ ...eventDetails, bibPickup })}
        onSave={onSaveEvent}
        saveLabel="Sauvegarder le commun"
        disabled={status === "saving"}
      />
    );
  }

  if (!activeRace) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
        Selectionne un format pour ajouter une consigne dossard specifique.
      </p>
    );
  }

  return (
    <BibPickupFields
      title={`Retrait dossard - ${activeRace.name}`}
      description="Renseigne le retrait, les documents ou le controle propres a ce format."
      bib={raceDetails.bibPickup}
      onBibChange={(bibPickup) => onRaceChange({ ...raceDetails, bibPickup })}
      onSave={onSaveRace}
      saveLabel="Sauvegarder ce format"
      disabled={status === "saving"}
    />
  );
}

export function BibPickupFields({
  title,
  description,
  bib,
  onBibChange,
  onSave,
  saveLabel,
  disabled,
}: {
  title: string;
  description: string;
  bib: OrganizerEventDetails["bibPickup"];
  onBibChange: (bib: OrganizerEventDetails["bibPickup"]) => void;
  onSave: () => void;
  saveLabel: string;
  disabled?: boolean;
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
      <TextAreaField label="Documents necessaires" value={bib.requiredDocuments ?? ""} onChange={(value) => update({ requiredDocuments: value || null })} />
      <div className="flex flex-wrap gap-2">
        <ToggleChip checked={bib.thirdPartyPickupAllowed === true} label="Retrait par tiers" onChange={(checked) => update({ thirdPartyPickupAllowed: checked })} />
        <ToggleChip checked={bib.equipmentCheck === true} label="Controle materiel" onChange={(checked) => update({ equipmentCheck: checked })} />
      </div>
      <TextAreaField label="Note dossard" value={bib.note ?? ""} onChange={(value) => update({ note: value || null })} />
      <Button type="button" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </Button>
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
  onSaveEvent,
  onSaveRace,
  status,
}: {
  scope: "event" | "format";
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
  onRaceChange: (details: OrganizerRaceDetails) => void;
  onSaveEvent: () => void;
  onSaveRace: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  if (scope === "event") {
    return (
      <AccessFields
        title="Acces commun evenement"
        description="Adresse principale, parking et consignes valables pour tous les formats."
        access={eventDetails.access}
        onAccessChange={(access) => onEventChange({ ...eventDetails, access })}
        onSave={onSaveEvent}
        saveLabel="Sauvegarder le commun"
        disabled={status === "saving"}
      />
    );
  }

  if (!activeRace) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
        Selectionne un format pour ajouter un acces ou une information specifique.
      </p>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-background p-4">
      <AccessFields
        title={`Acces - ${activeRace.name}`}
        description="Renseigne le depart, l'arrivee, les navettes ou les restrictions propres a ce format."
        access={raceDetails.access}
        onAccessChange={(access) => onRaceChange({ ...raceDetails, access })}
        onSave={onSaveRace}
        saveLabel="Sauvegarder ce format"
        disabled={status === "saving"}
        embedded
        showSaveButton={false}
      />
      <RunnerInfoFields
        runnerInfo={raceDetails.runnerInfo}
        onRunnerInfoChange={(runnerInfo) => onRaceChange({ ...raceDetails, runnerInfo })}
      />
      <Button type="button" onClick={onSaveRace} disabled={status === "saving"}>
        Sauvegarder les informations du format
      </Button>
    </section>
  );
}

export function AccessFields({
  title,
  description,
  access,
  onAccessChange,
  onSave,
  saveLabel,
  disabled,
  embedded,
  showSaveButton = true,
}: {
  title: string;
  description: string;
  access: OrganizerEventDetails["access"];
  onAccessChange: (access: OrganizerEventDetails["access"]) => void;
  onSave: () => void;
  saveLabel: string;
  disabled?: boolean;
  embedded?: boolean;
  showSaveButton?: boolean;
}) {
  const update = (next: Partial<OrganizerEventDetails["access"]>) => onAccessChange({ ...access, ...next });
  const missingStartAddress = !access.startAddress?.trim();
  const missingParkingOrShuttle = !access.officialParkings?.trim() && !access.shuttles?.trim();

  return (
    <section className={cn("space-y-4", !embedded && "rounded-lg border border-border bg-background p-4")}>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Adresse depart" value={access.startAddress ?? ""} onChange={(value) => update({ startAddress: value || null })} invalid={missingStartAddress} />
        <TextField label="Adresse arrivee" value={access.finishAddress ?? ""} onChange={(value) => update({ finishAddress: value || null })} />
      </div>
      <TextAreaField label="Parkings officiels" value={access.officialParkings ?? ""} onChange={(value) => update({ officialParkings: value || null })} invalid={missingParkingOrShuttle} />
      <TextAreaField label="Navettes" value={access.shuttles ?? ""} onChange={(value) => update({ shuttles: value || null })} invalid={missingParkingOrShuttle} />
      <TextAreaField label="Horaires navettes" value={access.shuttleSchedule ?? ""} onChange={(value) => update({ shuttleSchedule: value || null })} />
      <TextAreaField label="Routes fermees / restrictions" value={access.roadRestrictions ?? ""} onChange={(value) => update({ roadRestrictions: value || null })} />
      <TextField label="Lien Google Maps ou adresse" value={access.mapUrl ?? ""} onChange={(value) => update({ mapUrl: value || null })} placeholder="https://..." />
      <TextAreaField label="Note acces" value={access.note ?? ""} onChange={(value) => update({ note: value || null })} />
      {showSaveButton ? (
        <Button type="button" onClick={onSave} disabled={disabled}>
          {saveLabel}
        </Button>
      ) : null}
    </section>
  );
}

export function RunnerInfoFields({
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
        <p className="font-semibold text-foreground">Informations coureur specifiques</p>
        <p className="text-sm text-muted-foreground">Briefing, zone de depart ou consigne propre au format actif.</p>
      </div>
      <TextField label="Zone de depart" value={runnerInfo.startArea ?? ""} onChange={(value) => update({ startArea: value || null })} />
      <TextAreaField label="Briefing" value={runnerInfo.briefing ?? ""} onChange={(value) => update({ briefing: value || null })} />
      <TextAreaField label="Regles specifiques" value={runnerInfo.rules ?? ""} onChange={(value) => update({ rules: value || null })} />
      <TextAreaField label="Note format" value={runnerInfo.note ?? ""} onChange={(value) => update({ note: value || null })} />
    </div>
  );
}

export function ServicesEditor({
  details,
  onChange,
  onSave,
  status,
}: {
  details: OrganizerEventDetails;
  onChange: (details: OrganizerEventDetails) => void;
  onSave: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  const services = details.services;
  const update = (next: Partial<OrganizerEventDetails["services"]>) => onChange({ ...details, services: { ...services, ...next } });
  return (
    <div className="space-y-4">
      <TextAreaField label="Accompagnants" value={services.supporters ?? ""} onChange={(value) => update({ supporters: value || null })} />
      <TextAreaField label="Hebergements" value={services.accommodations ?? ""} onChange={(value) => update({ accommodations: value || null })} />
      <TextAreaField label="Restaurants" value={services.restaurants ?? ""} onChange={(value) => update({ restaurants: value || null })} />
      <TextAreaField label="Massage / recuperation" value={services.recovery ?? ""} onChange={(value) => update({ recovery: value || null })} />
      <TextAreaField label="Partenaires" value={services.partners ?? ""} onChange={(value) => update({ partners: value || null })} />
      <TextAreaField label="Message derniere minute" value={services.lastMinuteMessage ?? ""} onChange={(value) => update({ lastMinuteMessage: value || null })} />
      <TextAreaField label="Note services" value={services.note ?? ""} onChange={(value) => update({ note: value || null })} />
      <Button type="button" onClick={onSave} disabled={status === "saving"}>
        Sauvegarder les services
      </Button>
    </div>
  );
}

export function PreviewLauncher({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-5">
      <p className="text-sm text-muted-foreground">Ouvre une version simple cote coureur pour verifier les informations renseignees.</p>
      <Button type="button" className="mt-3" onClick={onPreview}>
        Previsualiser cote coureur
      </Button>
    </div>
  );
}
