"use client";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import {
  claimStatusLabel,
  type OrganizerClaim,
  type OrganizerEditionRequest,
  type OrganizerPublicationRequest,
} from "./organizer-admin-model";
import type { OrganizerAdminData } from "./useOrganizerAdminData";

/**
 * One pending organizer request with its review note and actions (same requests as before lot 5),
 * used by « Publications en attente » / « Demandes d’accès » and by the Demandes tab of the edition
 * drawer.
 */

export function PublicationRequestItem({ request, data }: { request: OrganizerPublicationRequest; data: OrganizerAdminData }) {
  const { status, notes, reviewPublication } = data;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50/40 p-4">
      <p className="font-semibold text-foreground">
        {request.race_events?.name ?? request.event_id}
      </p>
      {request.requested_race ? (
        <p className="text-sm font-medium text-foreground">
          Format : {request.requested_race.name}
          {request.requested_race.race_date ? ` · ${request.requested_race.race_date}` : ""}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Demandeur {request.user_id} · {request.race_events?.location ?? "Lieu non renseigné"}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input
          value={notes.publicationRequests[request.id] ?? ""}
          onChange={(event) => notes.setPublicationRequest(request.id, event.target.value)}
          placeholder="Note de validation"
          aria-label="Note de validation"
        />
        <Button
          type="button"
          disabled={status === "saving"}
          onClick={() => reviewPublication(request.id, "approved")}
        >
          Mettre en ligne
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={status === "saving"}
          onClick={() => reviewPublication(request.id, "rejected")}
        >
          Refuser
        </Button>
      </div>
    </div>
  );
}

export function ClaimItem({ claim, data }: { claim: OrganizerClaim; data: OrganizerAdminData }) {
  const { status, notes, runAction } = data;
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{claim.race_events?.name ?? claim.event_id}</p>
          <p className="text-sm text-muted-foreground">
            {claim.user?.label ?? claim.user_id} · {claim.organization_name} · {claim.role_title}
          </p>
          <p className="break-all text-sm text-muted-foreground">{claim.contact_email}</p>
          {claim.official_site_url ? (
            <a className="break-all text-sm text-brand underline-offset-4 hover:underline" href={claim.official_site_url} target="_blank" rel="noreferrer">
              {claim.official_site_url}
            </a>
          ) : null}
          {claim.message ? <p className="mt-2 text-sm text-foreground">{claim.message}</p> : null}
        </div>
        <span className="self-start rounded-full border border-border px-2 py-1 text-xs uppercase text-muted-foreground">
          {claimStatusLabel[claim.status]}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input
          value={notes.claims[claim.id] ?? ""}
          onChange={(event) => notes.setClaim(claim.id, event.target.value)}
          placeholder="Note de revue"
          aria-label="Note de revue"
        />
        <Button
          type="button"
          disabled={status === "saving" || claim.status === "approved"}
          onClick={() => runAction({ action: "approve", claimId: claim.id, reviewerNotes: notes.claims[claim.id] ?? "" })}
        >
          Approuver
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={status === "saving" || claim.status === "rejected"}
          onClick={() => runAction({ action: "reject", claimId: claim.id, reviewerNotes: notes.claims[claim.id] ?? "" })}
        >
          Refuser
        </Button>
      </div>
    </div>
  );
}

export function EditionRequestItem({ request, data }: { request: OrganizerEditionRequest; data: OrganizerAdminData }) {
  const { status, notes, runAction } = data;
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{request.race_events?.name ?? request.event_id}</p>
          <p className="text-sm text-muted-foreground">
            {request.user?.label ?? request.user_id} · edition source {request.source_year}
          </p>
          <p className="text-sm text-muted-foreground">Depart demande: {request.requested_start_date}</p>
        </div>
        <span className="self-start rounded-full border border-border px-2 py-1 text-xs uppercase text-muted-foreground">
          {claimStatusLabel[request.status]}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input
          value={notes.editionRequests[request.id] ?? ""}
          onChange={(event) => notes.setEditionRequest(request.id, event.target.value)}
          placeholder="Note de revue"
          aria-label="Note de revue"
        />
        <Button
          type="button"
          disabled={status === "saving" || request.status === "approved"}
          onClick={() =>
            runAction({
              action: "approveEditionRequest",
              editionRequestId: request.id,
              reviewerNotes: notes.editionRequests[request.id] ?? "",
            })
          }
        >
          Approuver
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={status === "saving" || request.status === "rejected"}
          onClick={() =>
            runAction({
              action: "rejectEditionRequest",
              editionRequestId: request.id,
              reviewerNotes: notes.editionRequests[request.id] ?? "",
            })
          }
        >
          Refuser
        </Button>
      </div>
    </div>
  );
}
