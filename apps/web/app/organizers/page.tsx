"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useVerifiedSession } from "../hooks/useVerifiedSession";

const initialEventForm = {
  name: "",
  location: "",
  raceDate: "",
  officialSiteUrl: "",
};

export default function OrganizersPage() {
  const { session, isLoading } = useVerifiedSession();
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          raceDate: eventForm.raceDate,
          officialSiteUrl: eventForm.officialSiteUrl,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { event?: { id: string }; message?: string }
        | null;

      if (!response.ok || !data?.event?.id) {
        setError(data?.message ?? "Impossible de créer l'événement.");
        return;
      }

      const destination = new URL("/organizer", window.location.origin);
      destination.searchParams.set("eventId", data.event.id);
      if (eventForm.officialSiteUrl.trim()) {
        destination.searchParams.set("importUrl", eventForm.officialSiteUrl.trim());
      }
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
            Crée ton événement, puis reconstruis ses formats depuis le site officiel.
          </h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground dark:text-slate-300">
            La fiche est créée immédiatement en brouillon et rattachée à ton compte. Aucun claim ni validation admin
            n&apos;est nécessaire pour commencer à la compléter.
          </p>
          <div className="rounded-lg border border-brand-border bg-brand-surface p-4 text-sm leading-6 text-foreground">
            <p className="font-semibold">Import depuis une URL</p>
            <p className="mt-1 text-muted-foreground">
              Après la création, l&apos;analyse du site s&apos;ouvre dans le dashboard. Tu pourras vérifier la date, les formats,
              les données trouvées et leur fiabilité avant de les intégrer.
            </p>
          </div>
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
              Le nom est nécessaire comme point de départ. Le lieu et la date pourront être corrigés lors de l&apos;import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Vérification de la session...</p>
            ) : !session ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Connecte-toi pour créer une course et obtenir immédiatement son accès organisateur.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/sign-in">
                    <Button>Se connecter</Button>
                  </Link>
                  <Link href="/sign-up">
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

                <div className="space-y-1.5">
                  <Label htmlFor="organizer-new-event-url">URL du site officiel</Label>
                  <Input
                    id="organizer-new-event-url"
                    type="url"
                    value={eventForm.officialSiteUrl}
                    onChange={(changeEvent) =>
                      setEventForm((current) => ({ ...current, officialSiteUrl: changeEvent.target.value }))
                    }
                    placeholder="https://www.exemple-course.fr/"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Facultatif. Si elle est renseignée, le scraper sera proposé juste après la création.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                    <Label htmlFor="organizer-new-event-date">Date de l&apos;événement</Label>
                    <Input
                      id="organizer-new-event-date"
                      type="date"
                      value={eventForm.raceDate}
                      onChange={(changeEvent) =>
                        setEventForm((current) => ({ ...current, raceDate: changeEvent.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                  L&apos;événement et les formats importés resteront en brouillon. La règle de paiement avant publication
                  sera ajoutée dans un second temps.
                </div>

                {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
                <Button type="submit" disabled={submitting || !eventForm.name.trim()}>
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
