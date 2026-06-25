import Link from 'next/link';

import { Button } from '../../../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { buildRunnerOrganizerDetails, defaultOrganizerEventDetails } from '../../../../lib/organizer-dashboard-details';
import type { FuelProduct } from '../../../../lib/product-types';
import { formatEventDateRange, formatKm } from './helpers';
import type { AidStationDraft, OrganizerEventDetail, StationProduct } from './types';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event?.name ?? 'Prévisualisation coureur'}</DialogTitle>
          <DialogDescription>{[event?.location, dateLabel].filter(Boolean).join(' - ') || 'Informations à compléter'}</DialogDescription>
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
                      {formatKm(race.distance_km)} - D+ {Math.round(race.elevation_gain_m)} m - {race.gpx_storage_path ? 'GPX disponible' : 'GPX à venir'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            {activeRace ? (
              <section>
                <h3 className="text-sm font-semibold text-foreground">Ravitos - {activeRace.name}</h3>
                {aidStations.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">Ravitos à venir.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {aidStations.map((station) => {
                      const products = station.id ? stationProducts.filter((link) => link.aidStationId === station.id) : [];
                      return (
                        <div key={station.id ?? station.name} className="rounded-md border border-border bg-background p-3">
                          <p className="font-semibold">
                            {station.name} - {formatKm(station.distanceKm)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {station.waterRefill ? 'eau' : 'sans eau'} - {station.solidRefill ? 'solide' : 'sans solide'} - {station.assistanceAllowed ? 'assistance' : 'sans assistance'}
                            {station.organizerDetails.cutoffTime ? ` - barrière ${station.organizerDetails.cutoffTime}` : ''}
                          </p>
                          {products.length > 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Produits: {products.map((link) => productsById.get(link.productId)?.name ?? link.productId).join(', ')}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}
            {runnerDetails ? (
              <>
                <PreviewTextSection
                  title="Matériel commun"
                  values={runnerDetails.commonEquipment.items.map((item) => `${item.label}${item.required ? '' : ' (recommandé)'}`)}
                  empty="Matériel commun à venir."
                />
                <PreviewTextSection
                  title={activeRace ? `Matériel ${activeRace.name}` : 'Matériel format'}
                  values={runnerDetails.raceEquipment.items.map((item) => `${item.label}${item.required ? '' : ' (recommandé)'}`)}
                  empty="Pas de matériel spécifique pour ce format."
                />
                <PreviewTextSection
                  title="Horaires"
                  values={[
                    runnerDetails.schedule.startTime ? `Départ ${runnerDetails.schedule.startTime}` : null,
                    runnerDetails.schedule.finishCutoffTime ? `Limite arrivée ${runnerDetails.schedule.finishCutoffTime}` : null,
                    runnerDetails.schedule.cutoffNote,
                  ]}
                  empty="Horaires à venir."
                />
                <PreviewTextSection
                  title="Dossard"
                  values={[runnerDetails.bibPickup.location, runnerDetails.bibPickup.schedule, runnerDetails.bibPickup.requiredDocuments, runnerDetails.bibPickup.note]}
                  empty="Retrait dossard à venir."
                />
                <PreviewTextSection
                  title="Accès"
                  values={[
                    runnerDetails.access.startAddress,
                    runnerDetails.access.finishAddress,
                    runnerDetails.access.officialParkings,
                    runnerDetails.access.shuttles,
                    runnerDetails.access.roadRestrictions,
                    runnerDetails.access.note,
                  ]}
                  empty="Accès à venir."
                />
                <PreviewTextSection
                  title="Informations format"
                  values={[runnerDetails.runnerInfo.startArea, runnerDetails.runnerInfo.briefing, runnerDetails.runnerInfo.rules, runnerDetails.runnerInfo.note]}
                  empty="Pas d'information spécifique pour ce format."
                />
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
              <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">Le bouton &quot;Créer mon plan&quot; apparaîtra pour un format live.</p>
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
