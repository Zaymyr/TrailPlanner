"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useVerifiedSession } from "../hooks/useVerifiedSession";

type OrganizerEventSearchResult = {
  id: string;
  name: string;
  location?: string | null;
  race_date?: string | null;
  thumbnail_url?: string | null;
  races?: Array<{ id: string; name: string; distance_km: number }>;
};

type ClaimRow = {
  id: string;
  event_id: string;
  organization_name: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: {
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
};

const initialClaimForm = {
  organizationName: "",
  roleTitle: "",
  contactEmail: "",
  officialSiteUrl: "",
  message: "",
};

export default function OrganizersPage() {
  const { session, isLoading } = useVerifiedSession();
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<OrganizerEventSearchResult[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [claimForm, setClaimForm] = useState(initialClaimForm);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "submitting">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accessToken = session?.accessToken ?? null;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  useEffect(() => {
    if (session?.email && !claimForm.contactEmail) {
      setClaimForm((current) => ({ ...current, contactEmail: session.email ?? "" }));
    }
  }, [claimForm.contactEmail, session?.email]);

  const loadClaims = async () => {
    if (!accessToken) return;
    const response = await fetch("/api/organizer/claims", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { claims?: ClaimRow[] };
    setClaims(data.claims ?? []);
  };

  useEffect(() => {
    void loadClaims();
  }, [accessToken]);

  const searchEvents = async () => {
    setStatus("loading");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/organizer/events?search=${encodeURIComponent(search)}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as {
        events?: OrganizerEventSearchResult[];
        message?: string;
      } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible de charger les courses.");
        return;
      }
      const nextEvents = data?.events ?? [];
      setEvents(nextEvents);
      setSelectedEventId((current) => current ?? nextEvents[0]?.id ?? null);
    } catch (caught) {
      console.error("Unable to search organizer events", caught);
      setError("Impossible de charger les courses.");
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    void searchEvents();
  }, []);

  const submitClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !selectedEventId) return;

    setStatus("submitting");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/organizer/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          eventId: selectedEventId,
          organizationName: claimForm.organizationName,
          roleTitle: claimForm.roleTitle,
          contactEmail: claimForm.contactEmail,
          officialSiteUrl: claimForm.officialSiteUrl,
          message: claimForm.message,
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible d'envoyer la demande.");
        return;
      }
      setClaimForm((current) => ({
        ...initialClaimForm,
        contactEmail: current.contactEmail,
      }));
      setMessage("Demande envoyee. Tu la retrouveras dans le dashboard organisateur.");
      await loadClaims();
    } catch (caught) {
      console.error("Unable to submit organizer claim", caught);
      setError("Impossible d'envoyer la demande.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand dark:text-emerald-300">
            Espace organisateurs
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground dark:text-slate-50 sm:text-4xl">
            Claim une course et gere ses formats, GPX, ravitos et produits.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground dark:text-slate-300">
            Un compte Supabase classique suffit. Une fois la demande validee par l'admin, les modifications sont publiees directement sur l'evenement public.
          </p>
          <div className="flex flex-wrap gap-3">
            {session ? (
              <Link href="/organizer">
                <Button>Ouvrir le dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button>Se connecter</Button>
                </Link>
                <Link href="/sign-up">
                  <Button variant="outline">Creer un compte</Button>
                </Link>
              </>
            )}
          </div>
        </div>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Statut de mes demandes</CardTitle>
            <CardDescription>
              Les claims en attente restent visibles ici et dans le dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Verification de session...</p>
            ) : !session ? (
              <p className="text-sm text-muted-foreground">Connecte-toi pour envoyer ou suivre une demande.</p>
            ) : claims.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
            ) : (
              claims.slice(0, 4).map((claim) => (
                <div key={claim.id} className="rounded-md border border-border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">
                      {claim.race_events?.name ?? claim.organization_name}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
                      {claim.status}
                    </span>
                  </div>
                  {claim.reviewer_notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{claim.reviewer_notes}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>1. Trouver la course</CardTitle>
            <CardDescription>Le claim porte sur l'evenement, pas sur un format isole.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="UTMB, Saintelyon, EcoTrail..."
              />
              <Button type="button" variant="outline" onClick={searchEvents} disabled={status === "loading"}>
                Rechercher
              </Button>
            </div>
            <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune course trouvee.</p>
              ) : (
                events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={`w-full rounded-md border p-3 text-left transition ${
                      selectedEventId === event.id
                        ? "border-brand bg-brand-surface text-foreground"
                        : "border-border bg-background hover:border-brand-border"
                    }`}
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <span className="block font-semibold">{event.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[event.location, event.race_date].filter(Boolean).join(" · ") || "Details a completer"}
                    </span>
                    {event.races?.length ? (
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {event.races.length} format{event.races.length > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>2. Demander le claim</CardTitle>
            <CardDescription>
              {selectedEvent ? selectedEvent.name : "Selectionne une course pour activer le formulaire."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!session ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>La demande est liee a ton compte. Connecte-toi ou cree un compte avant de l'envoyer.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/sign-in">
                    <Button>Se connecter</Button>
                  </Link>
                  <Link href="/sign-up">
                    <Button variant="outline">Creer un compte</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={submitClaim}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="organizationName">Organisation</Label>
                    <Input
                      id="organizationName"
                      value={claimForm.organizationName}
                      onChange={(event) => setClaimForm((current) => ({ ...current, organizationName: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="roleTitle">Role</Label>
                    <Input
                      id="roleTitle"
                      value={claimForm.roleTitle}
                      onChange={(event) => setClaimForm((current) => ({ ...current, roleTitle: event.target.value }))}
                      placeholder="Directeur de course, communication..."
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="contactEmail">Email de contact</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={claimForm.contactEmail}
                      onChange={(event) => setClaimForm((current) => ({ ...current, contactEmail: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="officialSiteUrl">Site officiel</Label>
                    <Input
                      id="officialSiteUrl"
                      type="url"
                      value={claimForm.officialSiteUrl}
                      onChange={(event) => setClaimForm((current) => ({ ...current, officialSiteUrl: event.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="claimMessage">Message</Label>
                  <textarea
                    id="claimMessage"
                    className="min-h-[120px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    value={claimForm.message}
                    onChange={(event) => setClaimForm((current) => ({ ...current, message: event.target.value }))}
                    placeholder="Lien vers une page officielle, contexte, preuve utile..."
                  />
                </div>
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
                {message ? <p className="text-sm text-emerald-600 dark:text-emerald-300">{message}</p> : null}
                <Button type="submit" disabled={!selectedEventId || status === "submitting"}>
                  {status === "submitting" ? "Envoi..." : "Envoyer la demande"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
