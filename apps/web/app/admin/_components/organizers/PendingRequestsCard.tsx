"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { ClaimItem, EditionRequestItem, PublicationRequestItem } from "./OrganizerRequestItems";
import type { OrganizerAdminData } from "./useOrganizerAdminData";

/** « Publications en attente » (publication + new-edition requests) or « Demandes d’accès » (claims). */
export function PendingRequestsCard({ view, data }: { view: "publication" | "access"; data: OrganizerAdminData }) {
  const { claims, editionRequests, publicationRequests, status } = data;
  const pendingRequestCount = view === "publication" ? publicationRequests.length + editionRequests.length : claims.length;

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{view === "publication" ? "Publications en attente" : "Demandes d’accès"}</CardTitle>
        <CardDescription>
          {pendingRequestCount} demande(s) à traiter dans cet onglet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {status === "loading" ? <p className="text-sm text-muted-foreground">Chargement...</p> : null}
        {pendingRequestCount === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
        ) : (
          <>
            {view === "publication" ? <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Demandes de publication</h3>
                <span className="text-xs text-muted-foreground">{publicationRequests.length} en attente</span>
              </div>
              {publicationRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune publication en attente.</p>
              ) : (
                publicationRequests.map((publicationRequest) => <PublicationRequestItem key={publicationRequest.id} request={publicationRequest} data={data} />)
              )}
            </section> : null}

            {view === "access" ? <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Claims d&apos;acces</h3>
                <span className="text-xs text-muted-foreground">{claims.length} en attente</span>
              </div>
              {claims.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun claim en attente.</p>
              ) : (
                claims.map((claim) => <ClaimItem key={claim.id} claim={claim} data={data} />)
              )}
            </section> : null}

            {view === "publication" && editionRequests.length > 0 ? <section className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Nouvelles editions</h3>
                <span className="text-xs text-muted-foreground">{editionRequests.length} en attente</span>
              </div>
              {editionRequests.map((editionRequest) => <EditionRequestItem key={editionRequest.id} request={editionRequest} data={data} />)}
            </section> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
