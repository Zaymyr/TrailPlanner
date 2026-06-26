import Link from "next/link";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import {
  buildRunnerOrganizerDetails,
  defaultOrganizerEventDetails,
  type OrganizerLocation,
} from "../../../../lib/organizer-dashboard-details";
import { formatCoordinates } from "../../../../lib/location-utils";
import type { FuelProduct } from "../../../../lib/product-types";
import { formatEventDateRange, formatKm } from "./helpers";
import type { AidStationDraft, OrganizerEventDetail, StationProduct } from "./types";

export function RunnerPreviewDialog({
  open,
  onOpenChange,
  event,
  activeRaceId,
  aidStations,
  stationProducts,
  productsById,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: OrganizerEventDetail | null;
  activeRaceId: string | null;
  aidStations: AidStationDraft[];
  stationProducts: StationProduct[];
  productsById: Map<string, FuelProduct>;
}) {
  const activeRace = event?.races.find((race) => race.id === activeRaceId) ?? event?.races.find((race) => race.is_live) ?? event?.races[0] ?? null;
  const runnerDetails = event ? buildRunnerOrganizerDetails(event.organizerDetails ?? defaultOrganizerEventDetails, activeRace?.organizerDetails) : null;
  const dateLabel = formatEventDateRange(event);
  const formatRunnerInfoVisible = runnerDetails?.access.enabledSections.runnerInfo !== false;
  const weatherAlertMessage =
    runnerDetails?.equipmentStatus.weatherPlan === "cold"
      ? "Plan grand froid activé - vérifie le matériel"
      : runnerDetails?.equipmentStatus.weatherPlan === "heat"
        ? "Plan grosse chaleur activé - vérifie le matériel"
        : null;
  const previewAccessValues = runnerDetails
    ? [
        runnerDetails.access.enabledSections.officialParkings ? runnerDetails.access.officialParkings : null,
        runnerDetails.access.enabledSections.shuttles ? runnerDetails.access.shuttles : null,
        runnerDetails.access.enabledSections.shuttles ? runnerDetails.access.shuttleSchedule : null,
        runnerDetails.access.enabledSections.roadRestrictions ? runnerDetails.access.roadRestrictions : null,
        runnerDetails.access.note,
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event?.name ?? "Prévisualisation coureur"}</DialogTitle>
          <DialogDescription>{[event?.location, dateLabel].filter(Boolean).join(" - ") || "Informations à compléter"}</DialogDescription>
        </DialogHeader>
        {!event ? (
          <p className="text-sm text-muted-foreground">Aucun événement chargé.</p>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-semibold text-foreground">Formats disponibles</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {event.races.map((race) => (
                  <div key={race.id} className="rounded-md border border-border bg-background p-3">
                    <p className="font-semibold">{race.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatKm(race.distance_km)} - D+ {Math.round(race.elevation_gain_m)} m - {race.gpx_storage_path ? "GPX disponible" : "GPX à venir"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            {activeRace ? (
              <section>
                <h3 className="text-sm font-semibold text-foreground">Ravitos - {activeRace.name}</h3>
                <div className="mt-2 space-y-2">
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="font-semibold">Départ</p>
                    <p className="text-sm text-muted-foreground">{runnerDetails?.schedule.startTime ? `Départ ${runnerDetails.schedule.startTime}` : "Heure de départ à venir."}</p>
                  </div>
                  {aidStations.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-background p-3 text-sm text-muted-foreground">Ravitos à venir.</p>
                  ) : (
                    aidStations.map((station) => {
                      const products = station.id ? stationProducts.filter((link) => link.aidStationId === station.id) : [];
                      return (
                        <div key={station.id ?? station.name} className="rounded-md border border-border bg-background p-3">
                          <p className="font-semibold">
                            {station.name} - {formatKm(station.distanceKm)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {station.waterRefill ? "eau" : "sans eau"} - {station.solidRefill ? "solide" : "sans solide"} - {station.assistanceAllowed ? "assistance" : "sans assistance"}
                            {station.organizerDetails.cutoffTime ? ` - barrière ${station.organizerDetails.cutoffTime}` : ""}
                          </p>
                          {products.length > 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">Produits: {products.map((link) => productsById.get(link.productId)?.name ?? link.productId).join(", ")}</p>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="font-semibold">Arrivée</p>
                    <p className="text-sm text-muted-foreground">
                      {runnerDetails?.schedule.finishCutoffTime ? `Barrière ${runnerDetails.schedule.finishCutoffTime}` : "Barrière d'arrivée à venir."}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
            {runnerDetails ? (
              <>
                {weatherAlertMessage ? <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{weatherAlertMessage}</p> : null}
                <PreviewLocationSection
                  title="Lieux clés"
                  items={[
                    { label: "Événement", value: event.location ?? null, location: event.organizerDetails?.eventLocation },
                    { label: "Format", value: activeRace?.location_text ?? null, location: activeRace?.organizerDetails?.raceLocation },
                    { label: "Retrait dossard", value: runnerDetails.bibPickup.location, location: runnerDetails.bibPickup.locationDetails },
                    { label: "Départ", value: runnerDetails.access.startAddress, location: runnerDetails.access.startLocation },
                    { label: "Arrivée", value: runnerDetails.access.finishAddress, location: runnerDetails.access.finishLocation },
                  ]}
                />
                <PreviewEquipmentSection title="Matériel commun" items={runnerDetails.equipmentStatus.commonItems} empty="Matériel commun à venir." />
                <PreviewEquipmentSection title={activeRace ? `Matériel ${activeRace.name}` : "Matériel format"} items={runnerDetails.equipmentStatus.raceItems} empty="Pas de matériel spécifique pour ce format." />
                <PreviewTextSection title="Dossard" values={[runnerDetails.bibPickup.location, runnerDetails.bibPickup.schedule, runnerDetails.bibPickup.requiredDocuments, runnerDetails.bibPickup.note]} empty="Retrait dossard à venir." />
                <PreviewTextSection title="Accès" values={previewAccessValues} empty="Accès à venir." />
                {runnerDetails.access.enabledSections.mapUrl && runnerDetails.access.mapUrl ? (
                  <section>
                    <h3 className="text-sm font-semibold text-foreground">Carte</h3>
                    <a
                      href={runnerDetails.access.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex text-sm font-medium text-foreground underline underline-offset-2"
                    >
                      Ouvrir la carte
                    </a>
                  </section>
                ) : null}
                {formatRunnerInfoVisible ? (
                  <PreviewTextSection title="Informations format" values={[runnerDetails.runnerInfo.startArea, runnerDetails.runnerInfo.briefing, runnerDetails.runnerInfo.rules, runnerDetails.runnerInfo.note]} empty="Pas d'information spécifique pour ce format." />
                ) : null}
                <PreviewTextSection
                  title="Services"
                  values={[
                    runnerDetails.services.supporters,
                    runnerDetails.services.accommodations,
                    runnerDetails.services.restaurants,
                    runnerDetails.services.recovery,
                    runnerDetails.services.partners,
                    runnerDetails.services.lastMinuteMessage,
                  ]}
                  empty="Services à venir."
                />
              </>
            ) : null}
            {activeRace?.is_live ? (
              <Link href={`/race-planner?catalogRaceId=${activeRace.id}`}>
                <Button>Créer mon plan</Button>
              </Link>
            ) : (
              <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">Le bouton "Créer mon plan" apparaîtra pour un format live.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PreviewTextSection({ title, values, empty }: { title: string; values: Array<string | null | undefined>; empty: string }) {
  const lines = values.filter((value): value is string => Boolean(value?.trim()));
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {lines.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {lines.map((line, index) => (
            <li key={`${title}-${index}`}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PreviewLocationSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string | null | undefined; location?: OrganizerLocation | null }>;
}) {
  const rows = items.filter(({ value, location }) => Boolean(value?.trim()) || Boolean(location?.googleMapsUrl));

  if (rows.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {rows.map((item) => {
          const gps = formatCoordinates(item.location?.lat, item.location?.lng);
          return (
            <div key={item.label} className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm text-foreground">{item.value?.trim() || item.location?.label || "Adresse à venir."}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {gps ? <span>GPS {gps}</span> : null}
                {item.location?.googleMapsUrl ? (
                  <a href={item.location.googleMapsUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">
                    Ouvrir dans Google Maps
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PreviewEquipmentSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ label: string; required: boolean; active: boolean }>;
  empty: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {items.map((item, index) => (
            <li key={`${title}-${index}-${item.label}`} className={item.active ? "text-muted-foreground" : "text-muted-foreground opacity-50"}>
              {item.label}
              {item.required ? "" : " (recommandé)"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
