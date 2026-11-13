import Image from "next/image";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { GpxRouteMap } from "../../../../components/gpx/GpxRouteMap";
import { Button } from "../../../../components/ui/button";
import { Label } from "../../../../components/ui/label";
import { defaultOrganizerRaceDetails } from "../../../../lib/organizer-dashboard-details";
import type { OrganizerModuleId } from "../completion";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import { ADD_FORMAT_TAB_ID } from "./constants";
import { formatKm } from "./helpers";
import type { EventFormValues, GpxPreview, RaceFormat, RaceFormValues, RaceParticipationMode } from "./types";
import { ContextualHelp, NumberField, OptionalModule, TextField } from "./controls";
import { FieldGroup, FileField, hasSignificantDistanceMismatch, hasSuspiciousEqualElevation, isValidInstagramUrl, normalizeInstagramUrl, SelectField, SwitchRow } from "./form-kit";

const isInvalidHttpsUrl = (value: string) => {
  if (!value.trim()) return false;
  try {
    return new URL(value).protocol !== "https:";
  } catch {
    return true;
  }
};

const isInvalidPhone = (value: string) => Boolean(value.trim() && !/^\+?[0-9][0-9 .()/-]{2,}$/.test(value.trim()));

const toFileInputChangeEvent = (file: File) => ({ target: { files: [file], value: "" } } as unknown as ChangeEvent<HTMLInputElement>);

const fileNameFromUrl = (url: string, fallback: string) => {
  try {
    const fileName = new URL(url).pathname.split("/").pop();
    return fileName ? decodeURIComponent(fileName) : fallback;
  } catch {
    return fallback;
  }
};

export function EventInfoEditor({
  eventForm,
  onChange,
  onUploadImage,
  status,
}: {
  eventForm: EventFormValues;
  onChange: (next: Partial<EventFormValues>, moduleId?: OrganizerModuleId) => void;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  const missingName = !eventForm.name.trim();
  const missingLocation = !eventForm.location.trim();
  const missingStartDate = !eventForm.editionStartDate.trim();
  const missingEndDate = !eventForm.editionEndDate.trim();
  const invalidDateRange = Boolean(eventForm.editionStartDate && eventForm.editionEndDate && eventForm.editionEndDate < eventForm.editionStartDate);
  const officialWebsiteUrl = eventForm.organizerDetails.officialWebsiteUrl ?? "";
  const instagramUrl = eventForm.organizerDetails.instagramUrl ?? "";
  const facebookUrl = eventForm.organizerDetails.facebookUrl ?? "";
  const emergencyContact = eventForm.organizerDetails.emergencyContact;
  const invalidOfficialWebsiteUrl = isInvalidHttpsUrl(officialWebsiteUrl);
  const invalidInstagramUrl = !isValidInstagramUrl(instagramUrl);
  const invalidFacebookUrl = isInvalidHttpsUrl(facebookUrl);
  const invalidEmergencyPhone = isInvalidPhone(emergencyContact.phone ?? "");
  const [socialsOpen, setSocialsOpen] = useState(Boolean(officialWebsiteUrl || instagramUrl || facebookUrl));
  const [imageOpen, setImageOpen] = useState(Boolean(eventForm.thumbnailUrl));

  return (
    <div className="space-y-0">
      <FieldGroup legend="L’événement" description="Nom et lieu affichés en tête du Livret coureur.">
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField id="organizer-event-name" label="Nom" value={eventForm.name} onChange={(value) => onChange({ name: value })} required invalid={missingName} />
          <AddressAutocompleteField
            label="Lieu"
            value={eventForm.location}
            location={eventForm.organizerDetails.eventLocation}
            biasLocation={eventForm.organizerDetails.eventLocation}
            onChange={(value) => onChange({ location: value })}
            onLocationChange={(eventLocation) =>
              onChange(
                {
                  organizerDetails: {
                    ...eventForm.organizerDetails,
                    eventLocation,
                  },
                },
                "event"
              )
            }
            invalid={missingLocation}
          />
        </div>
      </FieldGroup>

      <FieldGroup legend="Liens" description="Site officiel et réseaux utiles aux coureurs." optional>
        <OptionalModule title="Réseaux sociaux" addLabel="+ Ajouter les réseaux sociaux" active={socialsOpen} onAdd={() => setSocialsOpen(true)} onRemove={() => setSocialsOpen(false)}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_minmax(12rem,1fr)_minmax(12rem,1fr)]">
          <TextField
            label="Site officiel"
            type="url"
            value={officialWebsiteUrl}
            invalid={invalidOfficialWebsiteUrl}
            errorMessage="Saisis une adresse complète commençant par https://."
            onChange={(value) =>
              onChange(
                {
                  organizerDetails: {
                    ...eventForm.organizerDetails,
                    officialWebsiteUrl: value || null,
                  },
                },
                "event"
              )
            }
          />
          <TextField
            id="organizer-instagram-url"
            label="Instagram"
            type="url"
            value={instagramUrl}
            invalid={invalidInstagramUrl}
            errorMessage="Saisis un profil Instagram valide, par exemple @montrail ou instagram.com/montrail."
            onBlur={() => {
              const normalized = normalizeInstagramUrl(instagramUrl);
              if (normalized !== instagramUrl) {
                onChange({ organizerDetails: { ...eventForm.organizerDetails, instagramUrl: normalized || null } }, "event");
              }
            }}
            onChange={(value) =>
              onChange(
                {
                  organizerDetails: {
                    ...eventForm.organizerDetails,
                    instagramUrl: value || null,
                  },
                },
                "event"
              )
            }
          />
          <TextField
            label="Facebook"
            type="url"
            value={facebookUrl}
            invalid={invalidFacebookUrl}
            errorMessage="Saisis une adresse Facebook complète commençant par https://."
            onChange={(value) =>
              onChange(
                {
                  organizerDetails: {
                    ...eventForm.organizerDetails,
                    facebookUrl: value || null,
                  },
                },
                "event"
              )
            }
          />
        </div>
        </OptionalModule>
      </FieldGroup>

      <FieldGroup legend="Dates" description="Les formats reprennent ces dates par défaut.">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <TextField id="organizer-edition-start-date" label="Début" type="date" value={eventForm.editionStartDate} onChange={(value) => onChange({ editionStartDate: value })} invalid={missingStartDate || invalidDateRange} errorMessage={invalidDateRange ? "La date de début doit précéder la date de fin." : "Indique la date de début."} />
          <TextField id="organizer-edition-end-date" label="Fin" type="date" value={eventForm.editionEndDate} onChange={(value) => onChange({ editionEndDate: value })} invalid={missingEndDate || invalidDateRange} errorMessage={invalidDateRange ? "La date de fin doit suivre la date de début." : "Indique la date de fin."} />
        </div>
      </FieldGroup>

      <FieldGroup legend="En cas d’urgence" description="Contact visible depuis chaque page du Livret coureur.">
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <TextField
              label="Nom du contact"
              value={emergencyContact.name ?? ""}
              onChange={(value) =>
                onChange(
                  {
                    organizerDetails: {
                      ...eventForm.organizerDetails,
                      emergencyContact: { ...emergencyContact, name: value || null },
                    },
                  },
                  "event"
                )
              }
            />
            <TextField
              label="Téléphone"
              type="tel"
              value={emergencyContact.phone ?? ""}
              invalid={invalidEmergencyPhone}
              errorMessage="Saisis un numéro de téléphone valide."
              onChange={(value) =>
                onChange(
                  {
                    organizerDetails: {
                      ...eventForm.organizerDetails,
                      emergencyContact: { ...emergencyContact, phone: value || null },
                    },
                  },
                  "event"
                )
              }
            />
          </div>
      </FieldGroup>

      <FieldGroup legend="Couverture" description="Illustration affichée dans le catalogue et le Livret." optional>
        <OptionalModule title="Image de couverture" addLabel="+ Ajouter une image de couverture" active={imageOpen} onAdd={() => setImageOpen(true)} onRemove={() => setImageOpen(false)}>
        <div className="mb-4 flex items-center gap-2"><p className="text-sm text-muted-foreground">Format PNG uniquement, 5 Mo maximum.</p></div>
        <div className="flex max-w-2xl flex-col gap-4 sm:flex-row sm:items-center">
          {eventForm.thumbnailUrl ? (
            <div className="h-28 w-full shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-56">
              <Image src={eventForm.thumbnailUrl} alt="" width={224} height={112} sizes="224px" unoptimized className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted px-3 text-sm text-muted-foreground sm:w-56">
              Aucune image
            </div>
          )}
          <div className="min-w-0 flex-1">
            <fieldset disabled={status === "uploading"}>
              <FileField
                label="Choisir l'image de couverture"
                accept="image/png"
                value={eventForm.thumbnailUrl ? { name: fileNameFromUrl(eventForm.thumbnailUrl, "Image de couverture"), previewUrl: eventForm.thumbnailUrl } : null}
                maxSizeLabel="PNG · 5 Mo maximum"
                onChange={(file) => onUploadImage(toFileInputChangeEvent(file))}
              />
            </fieldset>
          </div>
        </div>
        </OptionalModule>
      </FieldGroup>
    </div>
  );
}

export function FormatsEditor({
  activeTab,
  activeRace,
  raceForm,
  newRaceForm,
  newRaceImageName,
  newRaceGpxName,
  onRaceFormChange,
  onNewRaceFormChange,
  onCreateRace,
  onUploadRaceImage,
  onSelectNewRaceImage,
  onSelectNewRaceGpx,
  onUploadGpx,
  onDeleteGpx,
  gpxPreview,
  status,
  editionStartDate,
  eventLocationText,
  eventLocation,
}: {
  activeTab: string;
  activeRace: RaceFormat | null;
  raceForm: RaceFormValues;
  newRaceForm: RaceFormValues;
  newRaceImageName: string | null;
  newRaceGpxName: string | null;
  onRaceFormChange: (next: Partial<RaceFormValues>) => void;
  onNewRaceFormChange: (next: RaceFormValues) => void;
  onCreateRace: (event: FormEvent<HTMLFormElement>) => void;
  onUploadRaceImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectNewRaceImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectNewRaceGpx: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadGpx: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeleteGpx: () => void;
  gpxPreview: GpxPreview | null;
  status: "idle" | "loading" | "saving" | "uploading";
  editionStartDate: string;
  eventLocationText: string;
  eventLocation: EventFormValues["organizerDetails"]["eventLocation"];
}) {
  return (
    <div className="space-y-5">
      {activeTab === ADD_FORMAT_TAB_ID ? (
        <RaceForm
          key="new-format"
          title="Ajouter un format"
          values={newRaceForm}
          biasLocation={eventLocation}
          pendingImageName={newRaceImageName}
          pendingGpxName={newRaceGpxName}
          onChange={onNewRaceFormChange}
          onSubmit={onCreateRace}
          onImageChange={onSelectNewRaceImage}
          onGpxChange={onSelectNewRaceGpx}
          submitLabel="Créer le format"
          disabled={status === "saving" || status === "uploading"}
          requireRaceDate
          validateOnSubmitOnly
          emptyNumericFields
          editionStartDate={editionStartDate}
          gpxPreview={gpxPreview}
          gpxTitle="GPX du format"
          gpxStatus={newRaceGpxName ? "GPX prêt à être importé après création." : "Ajoute un GPX pour préremplir les statistiques et voir le parcours."}
          hasGpx={Boolean(newRaceGpxName)}
          inheritedLocationText={eventLocationText}
        />
      ) : activeRace ? (
        <RaceForm
          key={activeRace.id}
          title="Détails du format"
          values={raceForm}
          biasLocation={eventLocation}
          onChange={(values) => onRaceFormChange(values)}
          onSubmit={(event) => event.preventDefault()}
          onImageChange={onUploadRaceImage}
          onGpxChange={onUploadGpx}
          onDeleteGpx={onDeleteGpx}
          submitLabel=""
          disabled={status === "saving" || status === "uploading"}
          hideSubmit
          gpxPreview={gpxPreview}
          gpxTitle="GPX source"
          gpxStatus={activeRace.gpx_storage_path ? "GPX source présent." : "Aucun GPX source pour ce format."}
          hasGpx={Boolean(activeRace.gpx_storage_path)}
          editionStartDate={editionStartDate}
          inheritedLocationText={eventLocationText}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Selectionne ou ajoute un format.</p>
      )}
    </div>
  );
}

function RaceForm({
  title,
  values,
  biasLocation,
  onChange,
  onSubmit,
  onImageChange,
  onGpxChange,
  onDeleteGpx,
  submitLabel,
  disabled,
  pendingImageName,
  pendingGpxName,
  hideSubmit = false,
  requireRaceDate = false,
  gpxPreview = null,
  gpxTitle = "GPX du format",
  gpxStatus,
  hasGpx = false,
  editionStartDate,
  inheritedLocationText,
  validateOnSubmitOnly = false,
  emptyNumericFields = false,
}: {
  title: string;
  values: RaceFormValues;
  biasLocation: RaceFormValues["organizerDetails"]["raceLocation"] | null;
  onChange: (values: RaceFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGpxChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeleteGpx?: () => void;
  submitLabel: string;
  disabled?: boolean;
  pendingImageName?: string | null;
  pendingGpxName?: string | null;
  hideSubmit?: boolean;
  requireRaceDate?: boolean;
  gpxPreview?: GpxPreview | null;
  gpxTitle?: string;
  gpxStatus?: string;
  hasGpx?: boolean;
  editionStartDate: string;
  inheritedLocationText: string;
  validateOnSubmitOnly?: boolean;
  emptyNumericFields?: boolean;
}) {
  const participationModeId = useId();
  const missingName = !values.name.trim();
  const missingDistance = !Number.isFinite(values.distanceKm) || values.distanceKm <= 0;
  const missingElevationGain = !Number.isFinite(values.elevationGainM) || values.elevationGainM < 0;
  const missingRaceDate = requireRaceDate && !values.raceDate.trim();
  const invalidExternalSiteUrl = isInvalidHttpsUrl(values.externalSiteUrl ?? "");
  const elevationLossM = Number(values.elevationLossM || 0);
  const distanceMismatch = hasSignificantDistanceMismatch(values.distanceKm, gpxPreview?.stats?.distanceKm);
  const suspiciousElevation = hasSuspiciousEqualElevation(values.elevationGainM, elevationLossM);
  const previewRace = buildPreviewRace(values, hasGpx);
  const formRef = useRef<HTMLFormElement>(null);
  const hasValidationError = missingName || missingDistance || missingElevationGain || missingRaceDate || invalidExternalSiteUrl;
  const [usesCustomRaceDate, setUsesCustomRaceDate] = useState(Boolean(values.raceDate && editionStartDate && values.raceDate !== editionStartDate));
  const [usesCustomLocation, setUsesCustomLocation] = useState(
    Boolean(values.locationText.trim() && values.locationText.trim() !== inheritedLocationText.trim())
  );
  const [validationVisible, setValidationVisible] = useState(!validateOnSubmitOnly);

  useEffect(() => {
    setUsesCustomRaceDate(Boolean(values.raceDate && editionStartDate && values.raceDate !== editionStartDate));
  }, [editionStartDate, values.raceDate]);

  useEffect(() => {
    setUsesCustomLocation(Boolean(values.locationText.trim() && values.locationText.trim() !== inheritedLocationText.trim()));
  }, [inheritedLocationText, values.locationText]);

  return (
    <form
      ref={formRef}
      className="min-w-0 space-y-4"
      noValidate
      onSubmit={(event) => {
        setValidationVisible(true);
        if (hasValidationError) {
          event.preventDefault();
          window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
          return;
        }
        onSubmit(event);
      }}
    >
      <div className="flex items-center gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">Ajoute d’abord les fichiers, renseigne les informations du format, puis vérifie le parcours et le profil.</p>
      </div>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 space-y-4">
          <div className="min-w-0 space-y-4 rounded-lg border border-border/70 bg-background px-4 py-4">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informations du format</p>
              <ContextualHelp text="Nom, métriques, date et lieu propres à ce parcours." />
            </div>
            <div className="grid min-w-0 gap-3 [&>*]:min-w-0 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <TextField
                  label="Nom du format"
                  value={values.name}
                  onChange={(value) => onChange({ ...values, name: value, seriesName: value })}
                  required
                  invalid={missingName}
                  validationVisible={validationVisible}
                  errorMessage="Indique le nom du format."
                  disabled={disabled}
                />
              </div>
              <div className="lg:col-span-2">
                <NumberField label="Distance km" value={values.distanceKm} onChange={(value) => onChange({ ...values, distanceKm: value })} step="0.1" invalid={missingDistance} validationVisible={validationVisible} errorMessage="Indique une distance supérieure à 0 km." emptyWhenZero={emptyNumericFields} disabled={disabled} />
                {distanceMismatch ? <p className="mt-1 text-xs font-medium text-amber-700">La distance saisie diffère nettement des {gpxPreview?.stats?.distanceKm.toFixed(1)} km mesurés sur le GPX.</p> : null}
              </div>
              <div className="lg:col-span-2">
                <NumberField label="D+" value={values.elevationGainM} onChange={(value) => onChange({ ...values, elevationGainM: value })} step="0.1" invalid={missingElevationGain} validationVisible={validationVisible} errorMessage="Indique un dénivelé positif valide." emptyWhenZero={emptyNumericFields} disabled={disabled} />
                {suspiciousElevation ? <p className="mt-1 text-xs font-medium text-amber-700">D+ et D- sont identiques. Vérifie les dénivelés avant publication.</p> : null}
              </div>
              <div className="lg:col-span-2">
                <TextField label="D-" type="number" step="0.1" value={values.elevationLossM} onChange={(value) => onChange({ ...values, elevationLossM: value })} disabled={disabled} />
              </div>
              <div className="space-y-1 lg:col-span-6 lg:col-start-7 lg:row-start-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={participationModeId}>Type de participation</Label>
                  <ContextualHelp text="Pour un relais, les points de passage se configurent ensuite dans Ravitos et points de course." />
                </div>
                <SelectField
                  id={participationModeId}
                  value={values.participationMode}
                  onValueChange={(value) => onChange({ ...values, participationMode: value as RaceParticipationMode })}
                  disabled={disabled}
                  options={[
                    { value: "", label: "À confirmer" },
                    { value: "solo", label: "Solo" },
                    { value: "relay", label: "Relais" },
                    { value: "solo_and_relay", label: "Solo et relais" },
                  ]}
                />
              </div>
              <div className="space-y-2 lg:col-span-4">
                {editionStartDate ? (
                  <div className="flex items-center justify-between gap-2 text-sm"><span>Date de l’édition <span className="font-mono text-xs text-muted-foreground">{editionStartDate}</span></span><Button type="button" variant="ghost" className="!min-h-9 !px-2" disabled={disabled} onClick={() => { const next = !usesCustomRaceDate; setUsesCustomRaceDate(next); if (!next) onChange({ ...values, raceDate: editionStartDate }); }}>{usesCustomRaceDate ? "Utiliser l’édition" : "Changer"}</Button></div>
                ) : null}
                {usesCustomRaceDate || !editionStartDate ? (
                  <TextField
                    label="Date du format"
                    type="date"
                    value={values.raceDate}
                    onChange={(value) => onChange({ ...values, raceDate: value })}
                    required={requireRaceDate}
                    invalid={validationVisible && missingRaceDate}
                    errorMessage="Indique la date du format."
                    disabled={disabled}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Date héritée : {editionStartDate}</p>
                )}
              </div>
              <div className="space-y-2 lg:col-span-8">
                {inheritedLocationText ? (
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="truncate">Lieu hérité : {inheritedLocationText}</span><Button type="button" variant="ghost" className="!min-h-9 !px-2" disabled={disabled} onClick={() => {
                        const next = !usesCustomLocation;
                        setUsesCustomLocation(next);
                        if (!next) {
                          onChange({
                            ...values,
                            locationText: inheritedLocationText,
                            organizerDetails: {
                              ...values.organizerDetails,
                              raceLocation: biasLocation
                                ? { ...biasLocation }
                                : { ...defaultOrganizerRaceDetails.raceLocation },
                            },
                          });
                        }
                      }}>{usesCustomLocation ? "Utiliser l’événement" : "Modifier"}</Button></div>
                ) : null}
                {usesCustomLocation || !inheritedLocationText ? (
                  <AddressAutocompleteField
                    label="Lieu du format"
                    value={values.locationText}
                    location={values.organizerDetails.raceLocation}
                    biasLocation={biasLocation ?? undefined}
                    onChange={(value) => onChange({ ...values, locationText: value })}
                    onLocationChange={(raceLocation) =>
                      onChange({
                        ...values,
                        organizerDetails: {
                          ...values.organizerDetails,
                          raceLocation,
                        },
                      })
                    }
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Lieu hérité : {inheritedLocationText}</p>
                )}
              </div>
              <div className="lg:col-span-12 lg:max-w-2xl">
                <TextField
                  label="Site officiel du format (facultatif)"
                  type="url"
                  value={values.externalSiteUrl ?? ""}
                  onChange={(value) => onChange({ ...values, externalSiteUrl: value })}
                  invalid={invalidExternalSiteUrl}
                  errorMessage="Saisis une adresse complète commençant par https://."
                  placeholder="https://www.exemple.fr/course"
                  disabled={disabled}
                  hint="Ajoute la page officielle si ce format en possède une. Aucun lien ne sera affiché si le champ reste vide."
                />
              </div>
            </div>
          </div>
          {!hideSubmit ? (
            <div className="flex items-end pt-1">
              <Button type="submit" disabled={disabled}>
                {submitLabel}
              </Button>
            </div>
          ) : null}
        </div>
        {onGpxChange ? (
          <OrganizerGpxPanel
            title={gpxTitle}
            statusText={gpxStatus}
            fileLabel={pendingGpxName ?? (hasGpx ? "Remplacer le GPX source" : "Ajouter un GPX")}
            pendingGpxName={pendingGpxName}
            onGpxChange={onGpxChange}
            onDeleteGpx={onDeleteGpx}
            disabled={disabled}
            preview={gpxPreview}
            activeRace={previewRace}
            hasGpx={hasGpx}
            pendingImageName={pendingImageName}
            thumbnailUrl={values.thumbnailUrl}
            onImageChange={onImageChange}
            showRouteInRacebook={values.organizerDetails.gpxDisplay.showRoute}
            showElevationProfileInRacebook={values.organizerDetails.gpxDisplay.showElevationProfile}
            onShowRouteInRacebookChange={(showRoute) =>
              onChange({
                ...values,
                organizerDetails: {
                  ...values.organizerDetails,
                  gpxDisplay: { ...values.organizerDetails.gpxDisplay, showRoute },
                },
              })
            }
            onShowElevationProfileInRacebookChange={(showElevationProfile) =>
              onChange({
                ...values,
                organizerDetails: {
                  ...values.organizerDetails,
                  gpxDisplay: { ...values.organizerDetails.gpxDisplay, showElevationProfile },
                },
              })
            }
          />
        ) : null}
      </div>
    </form>
  );
}

function buildPreviewRace(values: RaceFormValues, hasGpx: boolean): RaceFormat {
  return {
    id: "draft",
    edition_group_id: "draft",
    series_name: values.seriesName,
    name: values.name,
    distance_km: values.distanceKm,
    elevation_gain_m: values.elevationGainM,
    elevation_loss_m: values.elevationLossM ? Number(values.elevationLossM) : 0,
    gpx_storage_path: hasGpx ? "draft" : null,
    is_live: values.isLive,
  };
}

function OrganizerGpxPanel({
  title,
  statusText,
  fileLabel,
  pendingGpxName,
  onGpxChange,
  onDeleteGpx,
  disabled,
  preview,
  activeRace,
  hasGpx,
  pendingImageName,
  thumbnailUrl,
  onImageChange,
  showRouteInRacebook,
  showElevationProfileInRacebook,
  onShowRouteInRacebookChange,
  onShowElevationProfileInRacebookChange,
}: {
  title: string;
  statusText?: string;
  fileLabel: string;
  pendingGpxName?: string | null;
  onGpxChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeleteGpx?: () => void;
  disabled?: boolean;
  preview: GpxPreview | null;
  activeRace: RaceFormat;
  hasGpx: boolean;
  pendingImageName?: string | null;
  thumbnailUrl?: string | null;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  showRouteInRacebook: boolean;
  showElevationProfileInRacebook: boolean;
  onShowRouteInRacebookChange: (checked: boolean) => void;
  onShowElevationProfileInRacebookChange: (checked: boolean) => void;
}) {
  return (
    <aside className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">Tracé</p>
            </div>
            {statusText ? <span className="text-xs font-medium text-muted-foreground">{statusText}</span> : null}
          </div>
        </div>
        <MiniGpxMap preview={preview} activeRace={activeRace} hasGpx={hasGpx} />
        <MiniElevationProfile preview={preview} activeRace={activeRace} hasGpx={hasGpx} />
        <div className="space-y-2 border-t border-border pt-3">
          <fieldset disabled={disabled}>
            <FileField
              label={fileLabel}
              accept=".gpx,application/gpx+xml"
              value={hasGpx || pendingGpxName ? { name: pendingGpxName ?? "GPX source importé" } : null}
              maxSizeLabel="Format GPX"
              onChange={(file) => onGpxChange(toFileInputChangeEvent(file))}
              onRemove={hasGpx && onDeleteGpx ? onDeleteGpx : undefined}
            />
          </fieldset>
        </div>
        <div className="space-y-3 border-t border-border pt-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Affichage dans le Livret coureur</p>
            <p className="text-xs text-muted-foreground">Choisis les visuels GPX visibles par les coureurs.</p>
          </div>
          <SwitchRow
            label="Afficher le parcours"
            checked={showRouteInRacebook}
            onCheckedChange={onShowRouteInRacebookChange}
            disabled={disabled || !hasGpx}
          />
          <SwitchRow
            label="Afficher le profil altimétrique"
            checked={showElevationProfileInRacebook}
            onCheckedChange={onShowElevationProfileInRacebookChange}
            disabled={disabled || !hasGpx}
          />
        </div>
        <div className="space-y-3 border-t border-border pt-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Image du format</p>
              <span className="text-xs text-muted-foreground">Optionnel</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">Image format</p>
              <ContextualHelp text={`JPEG, PNG, WebP ou AVIF, 5 Mo maximum.${pendingImageName && !thumbnailUrl ? " L’image sera envoyée après la création du format." : ""}`} />
            </div>
            <fieldset disabled={disabled}>
              <FileField
                label="Choisir l'image du format"
                accept="image/png,image/jpeg,image/webp,image/avif"
                value={thumbnailUrl ? { name: fileNameFromUrl(thumbnailUrl, "Image du format"), previewUrl: thumbnailUrl } : pendingImageName ? { name: pendingImageName } : null}
                maxSizeLabel="PNG, JPEG, WebP ou AVIF · 5 Mo maximum"
                onChange={(file) => onImageChange(toFileInputChangeEvent(file))}
              />
            </fieldset>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MiniElevationProfile({
  preview,
  activeRace,
  hasGpx,
}: {
  preview: GpxPreview | null;
  activeRace: RaceFormat;
  hasGpx: boolean;
}) {
  const profile = preview?.elevationProfile ?? [];
  const hasProfile = profile.length >= 2;
  const distanceKm = preview?.stats?.distanceKm ?? activeRace.distance_km;
  const gainM = preview?.stats?.gainM ?? activeRace.elevation_gain_m;
  const lossM = preview?.stats?.lossM ?? activeRace.elevation_loss_m ?? 0;

  if (!hasGpx) {
    return <div className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-sm text-muted-foreground">La courbe apparaîtra après l&apos;ajout d&apos;un GPX.</div>;
  }

  if (!hasProfile) {
    return <div className="rounded-md border border-border/70 bg-background px-3 py-4 text-sm text-muted-foreground">GPX present. Courbe de niveau indisponible pour ce fichier.</div>;
  }

  const width = 720;
  const height = 180;
  const paddingX = 28;
  const paddingTop = 18;
  const paddingBottom = 34;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxDistance = Math.max(distanceKm, profile.at(-1)?.distanceKm ?? 0, 1);
  const elevations = profile.map((point) => point.elevationM);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const xScale = (distance: number) => paddingX + (Math.min(Math.max(distance, 0), maxDistance) / maxDistance) * (width - paddingX * 2);
  const yScale = (elevation: number) => paddingTop + chartHeight - ((elevation - minElevation) / elevationRange) * chartHeight;
  const path = profile
    .map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.distanceKm).toFixed(1)},${yScale(point.elevationM).toFixed(1)}`)
    .join(" ");
  const firstProfilePoint = profile[0];
  const lastProfilePoint = profile.at(-1);
  const areaPath = `${path} L${xScale(lastProfilePoint?.distanceKm ?? 0).toFixed(1)},${height - paddingBottom} L${xScale(firstProfilePoint?.distanceKm ?? 0).toFixed(1)},${height - paddingBottom} Z`;

  return (
    <section className="overflow-hidden rounded-md border border-border bg-background px-2 py-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold text-foreground">Profil altitude</p>
        <p className="text-xs font-medium text-muted-foreground">{formatKm(distanceKm)}</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full text-brand" role="img" aria-label="Mini profil altimétrique GPX">
        <defs>
          <linearGradient id="organizerElevationGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <line x1={paddingX} x2={width - paddingX} y1={height - paddingBottom} y2={height - paddingBottom} stroke="hsl(var(--border))" />
        <path d={areaPath} fill="url(#organizerElevationGradient)" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x={paddingX} y={height - 10} fontSize="11" fill="hsl(var(--muted-foreground))">
          0 km
        </text>
        <text x={width - paddingX} y={height - 10} fontSize="11" fill="hsl(var(--muted-foreground))" textAnchor="end">
          {maxDistance.toFixed(1)} km
        </text>
        <text x={paddingX} y={paddingTop + 4} fontSize="11" fill="hsl(var(--muted-foreground))">
          {Math.round(maxElevation)} m
        </text>
        <text x={paddingX} y={height - paddingBottom - 6} fontSize="11" fill="hsl(var(--muted-foreground))">
          {Math.round(minElevation)} m
        </text>
        {preview?.detectedAidStations.map((station) => {
          const x = xScale(station.distanceKm);
          return (
            <g key={`${station.name}-${station.distanceKm}`}>
              <line x1={x} x2={x} y1={paddingTop} y2={height - paddingBottom} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 4" />
              <circle cx={x} cy={height - paddingBottom} r="4" fill="hsl(var(--muted-foreground))" />
            </g>
          );
        })}
      </svg>
      {preview?.detectedAidStations.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {preview.detectedAidStations.length} waypoint{preview.detectedAidStations.length > 1 ? "s" : ""} ravito detecte{preview.detectedAidStations.length > 1 ? "s" : ""}.
        </p>
      ) : null}
    </section>
  );
}

function MiniGpxMap({
  preview,
  activeRace,
  hasGpx,
}: {
  preview: GpxPreview | null;
  activeRace: RaceFormat;
  hasGpx: boolean;
}) {
  const points = (preview?.elevationProfile ?? []).filter(
    (point): point is GpxPreview["elevationProfile"][number] & { lat: number; lon: number } =>
      typeof point.lat === "number" && typeof point.lon === "number"
  );

  if (!hasGpx) {
    return <div className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-sm text-muted-foreground">La carte apparaîtra après l&apos;ajout d&apos;un GPX.</div>;
  }

  if (points.length < 2) {
    return <div className="rounded-md border border-border/70 bg-background px-3 py-4 text-sm text-muted-foreground">GPX present. Carte du parcours indisponible pour ce fichier.</div>;
  }

  return (
    <section className="overflow-hidden rounded-md border border-border bg-background px-2 py-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold text-foreground">Carte du parcours</p>
        <p className="text-xs font-medium text-muted-foreground">{points.length} points</p>
      </div>
      <GpxRouteMap points={points} aidStations={preview?.detectedAidStations ?? []} heightClassName="h-[7.5rem]" />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Vert : départ</span>
        <span>Rouge : arrivée</span>
        {preview?.detectedAidStations.length ? <span>Orange: ravitos detectes</span> : null}
      </div>
    </section>
  );
}
