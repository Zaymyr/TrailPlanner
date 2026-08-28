"use client";

import Link from "next/link";
import type { Route } from "next";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { trackGoogleAnalyticsEvent } from "../../lib/google-analytics";
import {
  buildAuthHref,
  buildOrganizerCreationHref,
  extractOrganizerAttribution,
} from "../../lib/organizer-acquisition";
import { useVerifiedSession } from "../hooks/useVerifiedSession";

const initialEventForm = {
  name: "",
  location: "",
  editionStartDate: "",
  editionEndDate: "",
};

type OrganizersPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function OrganizersPage({ searchParams }: OrganizersPageProps) {
  const { session, isLoading } = useVerifiedSession();
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attribution = useMemo(() => extractOrganizerAttribution(searchParams), [searchParams]);
  const returnPath = useMemo(() => buildOrganizerCreationHref(attribution), [attribution]);
  const signInHref = useMemo(() => buildAuthHref("/sign-in", returnPath), [returnPath]);
  const signUpHref = useMemo(() => buildAuthHref("/sign-up", returnPath), [returnPath]);

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.accessToken || !eventForm.name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/organizer/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: eventForm.name,
          location: eventForm.location,
          editionStartDate: eventForm.editionStartDate,
          editionEndDate: eventForm.editionEndDate,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { event?: { id: string }; message?: string }
        | null;

      if (!response.ok || !data?.event?.id) {
        setError(data?.message ?? "Impossible de créer l'événement.");
        return;
      }

      trackGoogleAnalyticsEvent("organizer_event_created", {
        event_category: "organizer_acquisition",
        event_id: data.event.id,
        ...attribution,
      });

      const destination = new URL("/organizer", window.location.origin);
      destination.searchParams.set("eventId", data.event.id);
      window.location.assign(destination.toString());
    } catch (caught) {
      console.error("Unable to create organizer event", caught);
      setError("Impossible de créer l'événement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="space-y-5 lg:sticky lg:top-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand dark:text-emerald-300">
            Espace organisateurs
          </p>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground dark:text-slate-50 sm:text-4xl">
            Crée ton événement et renseigne ses formats depuis ton dashboard.
          </h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground dark:text-slate-300">
            La fiche est créée immédiatement en brouillon et rattachée à ton compte. Aucun claim ni validation admin
            n&apos;est nécessaire pour commencer à la compléter.
          </p>
          {session ? (
            <Link href="/organizer">
              <Button variant="outline">Ouvrir mon dashboard</Button>
            </Link>
          ) : null}
        </div>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Ajouter une course</CardTitle>
            <CardDescription>
              Crée la première édition avec sa plage de dates, puis complète ses formats dans le dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Vérification de la session...</p>
            ) : !session ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Connecte-toi pour créer une course et obtenir immédiatement son accès organisateur.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={signInHref as Route}>
                    <Button>Se connecter</Button>
                  </Link>
                  <Link href={signUpHref as Route}>
                    <Button variant="outline">Créer un compte</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={submitEvent}>
                <div className="space-y-1.5">
                  <Label htmlFor="organizer-new-event-name">Nom de l&apos;événement</Label>
                  <Input
                    id="organizer-new-event-name"
                    value={eventForm.name}
                    onChange={(changeEvent) =>
                      setEventForm((current) => ({ ...current, name: changeEvent.target.value }))
                    }
                    placeholder="Trail du fort de Tamié"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="organizer-new-event-location">Lieu</Label>
                    <Input
                      id="organizer-new-event-location"
                      value={eventForm.location}
                      onChange={(changeEvent) =>
                        setEventForm((current) => ({ ...current, location: changeEvent.target.value }))
                      }
                      placeholder="Annecy, Savoie..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="organizer-new-event-date">Début de l&apos;édition</Label>
                    <Input
                      id="organizer-new-event-date"
                      type="date"
                      value={eventForm.editionStartDate}
                      onChange={(changeEvent) =>
                        setEventForm((current) => ({
                          ...current,
                          editionStartDate: changeEvent.target.value,
                          editionEndDate: current.editionEndDate || changeEvent.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="organizer-new-event-end-date">Fin de l&apos;édition</Label>
                    <Input
                      id="organizer-new-event-end-date"
                      type="date"
                      min={eventForm.editionStartDate || undefined}
                      value={eventForm.editionEndDate}
                      onChange={(changeEvent) =>
                        setEventForm((current) => ({ ...current, editionEndDate: changeEvent.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                  L&apos;événement et les formats ajoutés resteront en brouillon. La règle de paiement avant publication sera
                  ajoutée dans un second temps.
                </div>

                {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
                <Button type="submit" disabled={submitting || !eventForm.name.trim() || !eventForm.editionStartDate || !eventForm.editionEndDate}>
                  {submitting ? "Création..." : "Créer et continuer"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
