"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { LiveToggle } from "../../organizer/_components/dashboard/controls";

type OrganizerUserSummary = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  label: string;
};

type OrganizerClaim = {
  id: string;
  created_at: string;
  user_id: string;
  user?: OrganizerUserSummary;
  event_id: string;
  organization_name: string;
  role_title: string;
  contact_email: string;
  official_site_url?: string | null;
  message?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: {
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
};

type OrganizerMembership = {
  id: string;
  created_at: string;
  user_id: string;
  user?: OrganizerUserSummary;
  event_id: string;
  role: string;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  race_events?: {
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
};

type OrganizerEditionRequest = {
  id: string;
  created_at: string;
  user_id: string;
  user?: OrganizerUserSummary;
  event_id: string;
  source_year: number;
  requested_start_date: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: {
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
};

type OrganizerPublicationRequest = {
  id: string;
  created_at: string;
  user_id: string;
  event_id: string;
  race_id?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: {
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
  requested_race?: {
    name: string;
    race_date?: string | null;
  } | null;
};

type RaceEventOption = {
  id: string;
  name: string;
  location?: string | null;
  race_date?: string | null;
};

type RacebookPublicationEvent = RaceEventOption & {
  editionId: string | null;
  entitlement: {
    edition_id: string;
    tier: "visibility" | "racebook" | "pro";
    source: "system" | "stripe" | "admin" | "legacy_admin";
    status: "active" | "revoked";
  } | null;
  payment: {
    status: "pending" | "paid" | "failed" | "expired" | "refunded" | "disputed";
    amount_total?: number | null;
    currency: string;
    created_at: string;
  } | null;
  races: Array<{
    id: string;
    name: string;
    race_date?: string | null;
    racebook_is_live: boolean;
    racebook_publication_approved_at?: string | null;
    data_status?: "draft" | "complete" | null;
    missing_required_fields?: string[] | null;
  }>;
};

type Props = {
  accessToken: string | null;
};

export function AdminOrganizerClaimsTab({ accessToken }: Props) {
  const [claims, setClaims] = useState<OrganizerClaim[]>([]);
  const [editionRequests, setEditionRequests] = useState<OrganizerEditionRequest[]>([]);
  const [publicationRequests, setPublicationRequests] = useState<OrganizerPublicationRequest[]>([]);
  const [memberships, setMemberships] = useState<OrganizerMembership[]>([]);
  const [events, setEvents] = useState<RaceEventOption[]>([]);
  const [publicationEvents, setPublicationEvents] = useState<RacebookPublicationEvent[]>([]);
  const [tierFilter, setTierFilter] = useState<"all" | "visibility" | "racebook" | "pro">("all");
  const [assignmentEmail, setAssignmentEmail] = useState("");
  const [assignmentEventId, setAssignmentEventId] = useState("");
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [notesByClaim, setNotesByClaim] = useState<Record<string, string>>({});
  const [notesByEditionRequest, setNotesByEditionRequest] = useState<Record<string, string>>({});
  const [notesByPublicationRequest, setNotesByPublicationRequest] = useState<Record<string, string>>({});
  const [revokeReasonByMembership, setRevokeReasonByMembership] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const claimStatusLabel: Record<OrganizerClaim["status"], string> = {
    pending: "En attente",
    approved: "Approuve",
    rejected: "Refuse",
  };

  const pendingRequestCount = claims.length + publicationRequests.length;

  const load = async () => {
    if (!accessToken) return;
    setStatus("loading");
    setError(null);
    try {
      const [response, publicationResponse] = await Promise.all([
        fetch("/api/admin/organizer-claims", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }),
        fetch("/api/admin/event-publication-requests", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }),
      ]);
      const data = (await response.json().catch(() => null)) as {
        claims?: OrganizerClaim[];
        editionRequests?: OrganizerEditionRequest[];
        memberships?: OrganizerMembership[];
        events?: RaceEventOption[];
        message?: string;
      } | null;
      const publicationData = (await publicationResponse.json().catch(() => null)) as {
        publicationRequests?: OrganizerPublicationRequest[];
        events?: RacebookPublicationEvent[];
        message?: string;
      } | null;
      if (!response.ok || !publicationResponse.ok) {
        setError(data?.message ?? publicationData?.message ?? "Unable to load organizer requests.");
        return;
      }
      setClaims(data?.claims ?? []);
      setEditionRequests(data?.editionRequests ?? []);
      setMemberships(data?.memberships ?? []);
      const loadedEvents = data?.events ?? [];
      setEvents(loadedEvents);
      setAssignmentEventId((current) => current || loadedEvents[0]?.id || "");
      setPublicationRequests(publicationData?.publicationRequests ?? []);
      setPublicationEvents(publicationData?.events ?? []);
    } catch (caught) {
      console.error("Unable to load organizer claims", caught);
      setError("Unable to load organizer claims.");
    } finally {
      setStatus("idle");
    }
  };

  const assignOrganizer = async () => {
    if (!accessToken || !assignmentEventId || !assignmentEmail.trim()) return;
    setStatus("saving");
    setError(null);
    setAssignmentSuccess(null);
    try {
      const response = await fetch("/api/admin/organizer-claims", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "assign",
          eventId: assignmentEventId,
          email: assignmentEmail.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
        event?: RaceEventOption;
        user?: { email?: string | null };
      } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible d’attribuer l’accès organisateur.");
        return;
      }
      setAssignmentSuccess(
        `${data?.user?.email ?? assignmentEmail.trim()} peut maintenant éditer ${data?.event?.name ?? "cette course"}.`
      );
      setAssignmentEmail("");
      await load();
    } catch (caught) {
      console.error("Unable to assign organizer access", caught);
      setError("Impossible d’attribuer l’accès organisateur.");
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    void load();
  }, [accessToken]);

  const runAction = async (payload: Record<string, unknown>) => {
    if (!accessToken) return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/admin/organizer-claims", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Unable to update organizer claim.");
        return;
      }
      await load();
    } catch (caught) {
      console.error("Unable to update organizer claim", caught);
      setError("Unable to update organizer claim.");
    } finally {
      setStatus("idle");
    }
  };

  const reviewPublication = async (requestId: string, reviewStatus: "approved" | "rejected") => {
    if (!accessToken) return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/admin/event-publication-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          requestId,
          status: reviewStatus,
          reviewerNotes: notesByPublicationRequest[requestId] ?? "",
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Unable to review publication request.");
        return;
      }
      await load();
    } finally {
      setStatus("idle");
    }
  };

  const setRacebookVisibility = async (eventId: string, isLive: boolean) => {
    if (!accessToken) return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/admin/event-publication-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: "setRacebookVisibility", eventId, isLive }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible de modifier la visibilité des Racebooks.");
        return;
      }
      await load();
    } finally {
      setStatus("idle");
    }
  };

  const setEditionTier = async (editionId: string, tier: "visibility" | "racebook" | "pro") => {
    if (!accessToken) return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/admin/event-publication-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: "setEditionTier", editionId, tier }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible de modifier l’offre de l’édition.");
        return;
      }
      await load();
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Revue en attente</CardTitle>
          <CardDescription>{pendingRequestCount} demande(s) a traiter pour les acces historiques et les publications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {status === "loading" ? <p className="text-sm text-muted-foreground">Chargement...</p> : null}
          {pendingRequestCount === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Demandes de publication</h3>
                  <span className="text-xs text-muted-foreground">{publicationRequests.length} en attente</span>
                </div>
                {publicationRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune publication en attente.</p>
                ) : (
                  publicationRequests.map((publicationRequest) => (
                    <div key={publicationRequest.id} className="rounded-md border border-amber-300 bg-amber-50/40 p-4">
                      <p className="font-semibold text-foreground">
                        {publicationRequest.race_events?.name ?? publicationRequest.event_id}
                      </p>
                      {publicationRequest.requested_race ? (
                        <p className="text-sm font-medium text-foreground">
                          Format : {publicationRequest.requested_race.name}
                          {publicationRequest.requested_race.race_date ? ` · ${publicationRequest.requested_race.race_date}` : ""}
                        </p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        Demandeur {publicationRequest.user_id} · {publicationRequest.race_events?.location ?? "Lieu non renseigné"}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <Input
                          value={notesByPublicationRequest[publicationRequest.id] ?? ""}
                          onChange={(event) =>
                            setNotesByPublicationRequest((current) => ({
                              ...current,
                              [publicationRequest.id]: event.target.value,
                            }))
                          }
                          placeholder="Note de validation"
                        />
                        <Button
                          type="button"
                          disabled={status === "saving"}
                          onClick={() => reviewPublication(publicationRequest.id, "approved")}
                        >
                          Mettre en ligne
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={status === "saving"}
                          onClick={() => reviewPublication(publicationRequest.id, "rejected")}
                        >
                          Refuser
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Claims d&apos;acces</h3>
                  <span className="text-xs text-muted-foreground">{claims.length} en attente</span>
                </div>
                {claims.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun claim en attente.</p>
                ) : (
                  claims.map((claim) => (
                    <div key={claim.id} className="rounded-md border border-border bg-background p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{claim.race_events?.name ?? claim.event_id}</p>
                          <p className="text-sm text-muted-foreground">
                            {claim.user?.label ?? claim.user_id} · {claim.organization_name} · {claim.role_title}
                          </p>
                          <p className="text-sm text-muted-foreground">{claim.contact_email}</p>
                          {claim.official_site_url ? (
                            <a className="text-sm text-brand underline-offset-4 hover:underline" href={claim.official_site_url} target="_blank" rel="noreferrer">
                              {claim.official_site_url}
                            </a>
                          ) : null}
                          {claim.message ? <p className="mt-2 text-sm text-foreground">{claim.message}</p> : null}
                        </div>
                        <span className="rounded-full border border-border px-2 py-1 text-xs uppercase text-muted-foreground">
                          {claimStatusLabel[claim.status]}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <Input
                          value={notesByClaim[claim.id] ?? ""}
                          onChange={(event) => setNotesByClaim((current) => ({ ...current, [claim.id]: event.target.value }))}
                          placeholder="Note de revue"
                        />
                        <Button
                          type="button"
                          disabled={status === "saving" || claim.status === "approved"}
                          onClick={() => runAction({ action: "approve", claimId: claim.id, reviewerNotes: notesByClaim[claim.id] ?? "" })}
                        >
                          Approuver
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={status === "saving" || claim.status === "rejected"}
                          onClick={() => runAction({ action: "reject", claimId: claim.id, reviewerNotes: notesByClaim[claim.id] ?? "" })}
                        >
                          Refuser
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </section>

              {editionRequests.length > 0 ? <section className="space-y-3 border-t border-border/60 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Nouvelles editions</h3>
                  <span className="text-xs text-muted-foreground">{editionRequests.length} en attente</span>
                </div>
                {editionRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune demande d&apos;edition en attente.</p>
                ) : (
                  editionRequests.map((editionRequest) => (
                    <div key={editionRequest.id} className="rounded-md border border-border bg-background p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{editionRequest.race_events?.name ?? editionRequest.event_id}</p>
                          <p className="text-sm text-muted-foreground">
                            {editionRequest.user?.label ?? editionRequest.user_id} · edition source {editionRequest.source_year}
                          </p>
                          <p className="text-sm text-muted-foreground">Depart demande: {editionRequest.requested_start_date}</p>
                        </div>
                        <span className="rounded-full border border-border px-2 py-1 text-xs uppercase text-muted-foreground">
                          {claimStatusLabel[editionRequest.status]}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <Input
                          value={notesByEditionRequest[editionRequest.id] ?? ""}
                          onChange={(event) => setNotesByEditionRequest((current) => ({ ...current, [editionRequest.id]: event.target.value }))}
                          placeholder="Note de revue"
                        />
                        <Button
                          type="button"
                          disabled={status === "saving" || editionRequest.status === "approved"}
                          onClick={() =>
                            runAction({
                              action: "approveEditionRequest",
                              editionRequestId: editionRequest.id,
                              reviewerNotes: notesByEditionRequest[editionRequest.id] ?? "",
                            })
                          }
                        >
                          Approuver
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={status === "saving" || editionRequest.status === "rejected"}
                          onClick={() =>
                            runAction({
                              action: "rejectEditionRequest",
                              editionRequestId: editionRequest.id,
                              reviewerNotes: notesByEditionRequest[editionRequest.id] ?? "",
                            })
                          }
                        >
                          Refuser
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </section> : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Publication des Racebooks</CardTitle>
          <CardDescription>
            Les courses restent visibles dans le catalogue. Les changements d’offre manuels sont audités et prioritaires sur Stripe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-end">
            <select
              aria-label="Filtrer par offre"
              className="h-9 rounded-md border border-border bg-card px-3 text-sm"
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value as typeof tierFilter)}
            >
              <option value="all">Toutes les offres</option>
              <option value="visibility">Visibilité</option>
              <option value="racebook">RaceBook</option>
              <option value="pro">RaceBook Pro</option>
            </select>
          </div>
          {publicationEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune course disponible.</p>
          ) : (
            publicationEvents.filter((event) => {
              const tier = event.entitlement?.status === "active" ? event.entitlement.tier : "visibility";
              return tierFilter === "all" || tier === tierFilter;
            }).map((event) => {
              const pendingRequest = publicationRequests.find((request) => request.event_id === event.id) ?? null;
              const publishedCount = event.races.filter((race) => race.racebook_is_live).length;
              const approvedCount = event.races.filter((race) => race.racebook_publication_approved_at).length;
              const completeCount = event.races.filter((race) => race.data_status !== "draft").length;
              const isLive = event.races.length > 0 && publishedCount === event.races.length;
              const tier = event.entitlement?.status === "active" ? event.entitlement.tier : "visibility";

              return (
                <div key={event.id} className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{event.name}</p>
                      {pendingRequest ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                          Demande en cours
                        </span>
                      ) : approvedCount > 0 ? (
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
                      {event.races.length} format(s) · {publishedCount} Racebook(s) affiché(s)
                      {` · ${completeCount}/${event.races.length} complet(s)`}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Paiement : {event.payment?.status ?? "aucun"}
                      {event.entitlement?.source ? ` · source ${event.entitlement.source}` : ""}
                    </p>
                    {event.races.length > 0 ? (
                      <p className="truncate text-xs text-muted-foreground">{event.races.map((race) => race.name).join(" · ")}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      aria-label={`Offre de ${event.name}`}
                      className="h-9 rounded-md border border-border bg-card px-3 text-sm"
                      value={tier}
                      disabled={status === "saving" || !event.editionId}
                      onChange={(changeEvent) => {
                        if (event.editionId) void setEditionTier(event.editionId, changeEvent.target.value as typeof tier);
                      }}
                    >
                      <option value="visibility">Visibilité</option>
                      <option value="racebook">RaceBook</option>
                      <option value="pro">RaceBook Pro</option>
                    </select>
                    <LiveToggle
                      checked={isLive}
                      disabled={status === "saving" || event.races.length === 0 || tier === "visibility"}
                      onChange={(checked) => void setRacebookVisibility(event.id, checked)}
                      liveLabel="Racebooks affichés"
                      draftLabel="Racebooks masqués"
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Associer un organisateur</CardTitle>
          <CardDescription>
            Donnez à un compte Supabase existant le droit d’éditer un événement et tous ses formats, sans modifier leur publication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="organizer-assignment-email">Adresse e-mail du compte</Label>
              <Input
                id="organizer-assignment-email"
                type="email"
                autoComplete="email"
                value={assignmentEmail}
                onChange={(event) => setAssignmentEmail(event.target.value)}
                placeholder="organisateur@exemple.fr"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="organizer-assignment-event">Course</Label>
              <select
                id="organizer-assignment-event"
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={assignmentEventId}
                onChange={(event) => setAssignmentEventId(event.target.value)}
              >
                {events.length === 0 ? <option value="">Aucune course disponible</option> : null}
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}{event.location ? ` — ${event.location}` : ""}{event.race_date ? ` — ${event.race_date.slice(0, 10)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              disabled={status === "saving" || !assignmentEventId || !assignmentEmail.trim()}
              onClick={() => void assignOrganizer()}
            >
              Associer
            </Button>
          </div>
          {assignmentSuccess ? (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
              {assignmentSuccess}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Acces actifs</CardTitle>
          <CardDescription>Revoquer un acces organisateur sans supprimer la course publique.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun acces actif.</p>
          ) : (
            memberships.map((membership) => (
              <div key={membership.id} className="rounded-md border border-border bg-background p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{membership.race_events?.name ?? membership.event_id}</p>
                    <p className="text-sm text-muted-foreground">
                      {membership.user?.label ?? membership.user_id} · role {membership.role}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-300 px-2 py-1 text-xs text-emerald-700">actif</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-1">
                    <Label htmlFor={`revoke-${membership.id}`}>Raison</Label>
                    <Input
                      id={`revoke-${membership.id}`}
                      value={revokeReasonByMembership[membership.id] ?? ""}
                      onChange={(event) =>
                        setRevokeReasonByMembership((current) => ({
                          ...current,
                          [membership.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={status === "saving"}
                      onClick={() =>
                        runAction({
                          action: "revoke",
                          membershipId: membership.id,
                          revokeReason: revokeReasonByMembership[membership.id] ?? "",
                        })
                      }
                    >
                      Revoquer
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
