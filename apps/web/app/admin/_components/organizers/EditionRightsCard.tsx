"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { EditionBillingSummary } from "../billing/EditionBillingSummary";
import {
  activeTier,
  editionRacebookCounts,
  filterPublicationEvents,
  organizerTierLabel,
  pageNumbersAround,
  publicationOriginLabel,
  publicationRequestMatches,
  PUBLICATION_EVENTS_PER_PAGE,
  type EditionDrawerTab,
  type OrganizerTier,
} from "./organizer-admin-model";
import type { OrganizerAdminData } from "./useOrganizerAdminData";

/**
 * « Droits de publication organisateurs »: editions with their pack, origin and Racebook state, search
 * and pack filter, 10 per page. A row opens the edition drawer (`?edition=<id>`); `editionFilter`
 * (the `?edition=` of a link) narrows the list to that edition.
 */
export function EditionRightsCard({ data, editionFilter, openEditionId, onClearFilter, onOpen }: {
  data: OrganizerAdminData;
  editionFilter: string | null;
  openEditionId: string | null;
  onClearFilter: () => void;
  onOpen: (editionId: string, tab?: EditionDrawerTab) => void;
}) {
  const { publicationEvents, publicationRequests, status } = data;
  const [tierFilter, setTierFilter] = useState<"all" | OrganizerTier>("all");
  const [publicationSearch, setPublicationSearch] = useState("");
  const [publicationPage, setPublicationPage] = useState(1);

  const filteredPublicationEvents = useMemo(
    () => filterPublicationEvents(publicationEvents, { editionId: editionFilter, tier: tierFilter, search: publicationSearch }),
    [editionFilter, publicationEvents, publicationSearch, tierFilter],
  );
  const publicationTotalPages = Math.max(1, Math.ceil(filteredPublicationEvents.length / PUBLICATION_EVENTS_PER_PAGE));
  const paginatedPublicationEvents = filteredPublicationEvents.slice(
    (publicationPage - 1) * PUBLICATION_EVENTS_PER_PAGE,
    publicationPage * PUBLICATION_EVENTS_PER_PAGE
  );
  const publicationPageNumbers = useMemo(() => pageNumbersAround(publicationPage, publicationTotalPages), [publicationPage, publicationTotalPages]);

  useEffect(() => {
    setPublicationPage((current) => Math.min(current, publicationTotalPages));
  }, [publicationTotalPages]);

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Droits de publication organisateurs</CardTitle>
        <CardDescription>
          Choisissez le pack et son origine. Les origines Stripe et virement restent liées à un paiement réellement enregistré. Cliquez sur une édition pour ouvrir sa fiche.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {editionFilter ? (
          <p className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Liste filtrée sur une édition.
            <button type="button" className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={onClearFilter}>
              Afficher toutes les éditions
            </button>
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            type="search"
            value={publicationSearch}
            onChange={(event) => {
              setPublicationSearch(event.target.value);
              setPublicationPage(1);
            }}
            placeholder="Rechercher une course, un lieu ou un format…"
            aria-label="Rechercher dans les droits de publication"
          />
          <select
            aria-label="Filtrer par offre"
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
            value={tierFilter}
            onChange={(event) => {
              setTierFilter(event.target.value as typeof tierFilter);
              setPublicationPage(1);
            }}
          >
            <option value="all">Toutes les offres</option>
            <option value="visibility">Visibilité</option>
            <option value="essential">Essentiel</option>
            <option value="complete">Complet</option>
            <option value="signature">Signature</option>
          </select>
        </div>
        {publicationEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{status === "loading" ? "Chargement…" : "Aucune course disponible."}</p>
        ) : filteredPublicationEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune course ne correspond à votre recherche.</p>
        ) : (
          paginatedPublicationEvents.map((event) => {
            const pendingRequest = publicationRequests.find((request) => publicationRequestMatches(request, event)) ?? null;
            const counts = editionRacebookCounts(event);
            const latestPayment = event.payments[0] ?? null;
            const isOpen = Boolean(event.editionId && event.editionId === openEditionId);

            return (
              <div key={event.editionId ?? event.id} className={`flex flex-col gap-3 rounded-md border bg-background p-4 md:flex-row md:items-center md:justify-between ${isOpen ? "border-brand ring-1 ring-brand" : "border-border"}`}>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {event.editionId ? (
                      <button
                        type="button"
                        className="rounded-sm text-left font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        onClick={() => onOpen(event.editionId as string)}
                      >
                        {event.name}{event.editionYear ? ` · édition ${event.editionYear}` : ""}
                      </button>
                    ) : (
                      <p className="font-semibold text-foreground">{event.name}</p>
                    )}
                    {event.isCurrentEdition ? <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">Édition actuelle</span> : null}
                    {pendingRequest ? (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                        Demande en cours
                      </span>
                    ) : counts.approved > 0 ? (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Autorisation validée
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                        Aucune demande
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {counts.formats} format(s) · {counts.published} {counts.published > 1 ? "Livrets coureurs affichés" : "Livret coureur affiché"}
                    {` · ${counts.complete}/${counts.formats} complet(s)`}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Origine : {event.entitlement?.source ? publicationOriginLabel[event.entitlement.source] : "Aucune activation"}
                    {latestPayment ? ` · dernier paiement ${latestPayment.payment_channel === "bank_transfer" ? "virement" : "Stripe"} (${latestPayment.status})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pack : {organizerTierLabel[activeTier(event)]} · Options offertes : {event.featureGrants.filter((grant) => grant.status === "active").length}
                  </p>
                  {event.races.length > 0 ? (
                    <p className="truncate text-xs text-muted-foreground">{event.races.map((race) => race.name).join(" · ")}</p>
                  ) : null}
                </div>
                <div className="w-full space-y-3 md:w-auto md:min-w-[18rem]">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={status === "saving" || !event.editionId} onClick={() => event.editionId && onOpen(event.editionId, "pack")}>
                      Gérer le pack et les accès
                    </Button>
                    <Button type="button" variant="outline" disabled={!event.editionId} onClick={() => event.editionId && onOpen(event.editionId)}>
                      Fiche
                    </Button>
                  </div>
                  {event.editionId ? <EditionBillingSummary event={event} /> : null}
                </div>
              </div>
            );
          })
        )}
        {filteredPublicationEvents.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <p className="text-sm text-muted-foreground">
              {filteredPublicationEvents.length} édition(s) · page {publicationPage} sur {publicationTotalPages}
            </p>
            {publicationTotalPages > 1 ? (
              <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination des courses organisateurs">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => setPublicationPage((current) => Math.max(1, current - 1))}
                  disabled={publicationPage <= 1}
                >
                  Précédente
                </Button>
                {publicationPageNumbers.map((pageNumber, index) => {
                  const previousPageNumber = publicationPageNumbers[index - 1];
                  return (
                    <span key={pageNumber} className="flex items-center gap-1">
                      {previousPageNumber && pageNumber - previousPageNumber > 1 ? (
                        <span className="px-1 text-muted-foreground" aria-hidden>…</span>
                      ) : null}
                      <Button
                        type="button"
                        variant={pageNumber === publicationPage ? "default" : "outline"}
                        className="h-9 min-w-9 px-2"
                        aria-current={pageNumber === publicationPage ? "page" : undefined}
                        aria-label={`Aller à la page ${pageNumber}`}
                        onClick={() => setPublicationPage(pageNumber)}
                      >
                        {pageNumber}
                      </Button>
                    </span>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => setPublicationPage((current) => Math.min(publicationTotalPages, current + 1))}
                  disabled={publicationPage >= publicationTotalPages}
                >
                  Suivante
                </Button>
              </nav>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
