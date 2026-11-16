"use client";

import { useState, type FormEvent } from "react";

import { trackGoogleAnalyticsEvent } from "../../lib/google-analytics";
import type { OrganizerAttribution } from "../../lib/organizer-acquisition";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

const inputClass =
  "h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * « Demander une démo »: e-mail and race link required, phone optional. The
 * request lands in the admin inbox and both sides receive an e-mail.
 */
export function OrganizerDemoRequestForm({ attribution }: { attribution: OrganizerAttribution }) {
  const [email, setEmail] = useState("");
  const [raceUrl, setRaceUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ kind: "sending" });
    try {
      const response = await fetch("/api/organizer-demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, raceUrl, phone: phone || undefined, attribution, website: website || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setStatus({ kind: "error", message: payload?.message ?? "Impossible d’envoyer la demande." });
        return;
      }
      trackGoogleAnalyticsEvent("organizer_demo_requested", {
        event_category: "organizer_acquisition",
        has_phone: Boolean(phone.trim()),
        ...attribution,
      });
      setStatus({ kind: "sent", email: email.trim() });
    } catch {
      setStatus({ kind: "error", message: "Impossible d’envoyer la demande. Vérifiez votre connexion." });
    }
  };

  if (status.kind === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-brand-border bg-card p-5 text-sm leading-6 text-foreground">
        <p className="text-base font-semibold">Demande envoyée, merci !</p>
        <p className="mt-1 text-muted-foreground">
          Un e-mail de confirmation part à {status.email}. Nous revenons vers vous rapidement pour organiser la démo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" noValidate={false}>
      <div className="grid gap-1.5">
        <label htmlFor="demo-email" className="text-sm font-semibold text-foreground">Adresse e-mail</label>
        <input id="demo-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@votre-trail.fr" className={inputClass} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="demo-race-url" className="text-sm font-semibold text-foreground">Lien de votre course</label>
        <input id="demo-race-url" type="text" inputMode="url" autoComplete="url" required value={raceUrl} onChange={(event) => setRaceUrl(event.target.value)} placeholder="www.votre-trail.fr" className={inputClass} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="demo-phone" className="text-sm font-semibold text-foreground">
          Téléphone <span className="font-normal text-muted-foreground">(facultatif)</span>
        </label>
        <input id="demo-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="06 12 34 56 78" className={inputClass} />
      </div>
      <div aria-hidden="true" className="hidden">
        <label htmlFor="demo-website">Ne pas remplir</label>
        <input id="demo-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>
      {status.kind === "error" ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{status.message}</p> : null}
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light disabled:opacity-60 dark:bg-emerald-400 dark:text-slate-950"
      >
        {status.kind === "sending" ? "Envoi…" : "Demander ma démo"}
      </button>
      <p className="text-xs leading-5 text-muted-foreground">
        Vos coordonnées servent uniquement à organiser la démo. Vous recevez un e-mail de confirmation.
      </p>
    </form>
  );
}
