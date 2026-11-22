"use client";

import { useMemo, useState, type FormEvent } from "react";

import { trackGoogleAnalyticsEvent } from "../../lib/google-analytics";

type Offer = "collab" | "download";
type Preset = "signature" | "satellite" | "relief" | "cinema";
type Station = { key: number; name: string; km: string };
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string };

const inputClass =
  "h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";
const labelClass = "text-sm font-semibold text-foreground";
const optional = <span className="font-normal text-muted-foreground">(facultatif)</span>;

const OFFERS: Array<{ value: Offer; price: string; title: string; points: string[] }> = [
  {
    value: "collab",
    price: "29,99 €",
    title: "Publication en collaboration",
    points: ["Reel publié sur le compte Instagram Pace Yourself", "En collaboration avec le compte de votre événement", "Date et heure de publication au choix"],
  },
  {
    value: "download",
    price: "59,99 €",
    title: "Vidéo MP4 à télécharger",
    points: ["Fichier MP4 1080 × 1920 pour reels et stories", "Utilisation libre sur tous vos supports", "Téléchargeable 30 jours"],
  },
];

const PRESETS: Array<{ value: Preset; label: string; description: string; swatch: string }> = [
  { value: "signature", label: "Pace Yourself", description: "Topographie crème et vert, notre signature.", swatch: "linear-gradient(135deg,#ece8dc 0%,#c9d9b0 55%,#2d5016 100%)" },
  { value: "satellite", label: "Satellite", description: "Imagerie satellite naturelle, routes et lieux.", swatch: "linear-gradient(135deg,#4f6b3a 0%,#8b9a6b 50%,#d8d2bf 100%)" },
  { value: "relief", label: "Relief 3D", description: "Satellite 3D aux couleurs éclatantes.", swatch: "linear-gradient(135deg,#1f5f8b 0%,#3b82f6 45%,#9bd36a 100%)" },
  { value: "cinema", label: "Cinéma", description: "Satellite contrasté et chaud, ambiance film.", swatch: "linear-gradient(135deg,#1c1410 0%,#8a5a3c 55%,#f3d9b1 100%)" },
];

const pad = (value: number) => String(value).padStart(2, "0");
const toLocalInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const reliefLabel = (value: number) => (value < 1.4 ? "Fidèle" : value < 2.2 ? "Accentué" : "Spectaculaire");

/**
 * Order form of the organizer flyover video: GPX, race name, optional aid stations, Instagram
 * account, basemap and relief, then Stripe Checkout. Rules: docs/03-business-rules/flyover-video-orders.md.
 */
export function FlyoverOrderForm({ cancelled }: { cancelled: boolean }) {
  const [offer, setOffer] = useState<Offer>("collab");
  const [raceName, setRaceName] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [gpx, setGpx] = useState<File | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [publishLocal, setPublishLocal] = useState("");
  const [preset, setPreset] = useState<Preset>("signature");
  const [terrain, setTerrain] = useState(1.8);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>(cancelled ? { kind: "error", message: "Paiement annulé : votre commande n’a pas été validée." } : { kind: "idle" });

  const publishBounds = useMemo(() => {
    const now = Date.now();
    return { min: toLocalInput(new Date(now + 49 * 3_600_000)), max: toLocalInput(new Date(now + 21 * 86_400_000)) };
  }, []);

  const updateStation = (key: number, patch: Partial<Station>) =>
    setStations((current) => current.map((station) => (station.key === key ? { ...station, ...patch } : station)));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!gpx) {
      setStatus({ kind: "error", message: "Ajoutez le fichier GPX du parcours." });
      return;
    }
    setStatus({ kind: "sending" });
    const body = new FormData();
    body.set("offer", offer);
    body.set("raceName", raceName);
    if (raceDate) body.set("raceDate", raceDate);
    body.set("gpx", gpx);
    body.set("aidStations", JSON.stringify(stations.filter((station) => station.name.trim()).map((station) => ({ name: station.name.trim(), km: Number(station.km.replace(",", ".")) || 0 }))));
    if (instagramHandle.trim()) body.set("instagramHandle", instagramHandle.trim());
    if (offer === "collab") body.set("publishLocal", publishLocal);
    body.set("mapPreset", preset);
    body.set("terrainExaggeration", String(terrain));
    body.set("email", email);
    if (website) body.set("website", website);
    try {
      const response = await fetch("/api/flyover-orders", { method: "POST", body });
      const payload = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;
      if (!response.ok || !payload?.url) {
        setStatus({ kind: "error", message: payload?.message ?? "Impossible de valider la commande." });
        return;
      }
      trackGoogleAnalyticsEvent("flyover_checkout_started", { event_category: "organizer_acquisition", offer, map_preset: preset });
      window.location.assign(payload.url);
    } catch {
      setStatus({ kind: "error", message: "Impossible de valider la commande. Vérifiez votre connexion." });
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-semibold text-foreground">1. Votre formule</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OFFERS.map((item) => (
            <label
              key={item.value}
              className={`cursor-pointer rounded-xl border p-4 transition ${offer === item.value ? "border-brand bg-brand-surface ring-2 ring-brand/30 dark:border-emerald-400 dark:bg-emerald-400/10" : "border-border bg-background hover:border-brand-border"}`}
            >
              <input type="radio" name="offer" value={item.value} checked={offer === item.value} onChange={() => setOffer(item.value)} className="sr-only" />
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-base font-semibold text-foreground">{item.title}</span>
                <span className="whitespace-nowrap text-lg font-semibold text-brand dark:text-emerald-300">{item.price}</span>
              </span>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                {item.points.map((point) => <li key={point}>· {point}</li>)}
              </ul>
            </label>
          ))}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Prix TTC par course. Voix off et récit inclus dans les deux formules. Vidéo prête sous 24 h.</p>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold text-foreground">2. Votre course</legend>
        <div className="grid gap-1.5">
          <label htmlFor="flyover-name" className={labelClass}>Nom de la course</label>
          <input id="flyover-name" required minLength={2} maxLength={120} value={raceName} onChange={(event) => setRaceName(event.target.value)} placeholder="Trail des Crêtes 42 km" className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="flyover-gpx" className={labelClass}>Fichier GPX du parcours</label>
            <input id="flyover-gpx" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" required onChange={(event) => setGpx(event.target.files?.[0] ?? null)} className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2.5 file:text-sm file:font-semibold" />
            <p className="text-xs text-muted-foreground">Avec les altitudes, 10 Mo maximum.</p>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="flyover-date" className={labelClass}>Date de la course {optional}</label>
            <input id="flyover-date" type="date" value={raceDate} onChange={(event) => setRaceDate(event.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid gap-2">
          <p className={labelClass}>Ravitaillements {optional}</p>
          {stations.map((station, index) => (
            <div key={station.key} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] gap-2">
              <input aria-label={`Nom du ravito ${index + 1}`} value={station.name} maxLength={80} onChange={(event) => updateStation(station.key, { name: event.target.value })} placeholder="Col de la Croix" className={inputClass} />
              <input aria-label={`Kilomètre du ravito ${index + 1}`} inputMode="decimal" value={station.km} onChange={(event) => updateStation(station.key, { km: event.target.value })} placeholder="km 12,5" className={inputClass} />
              <button type="button" onClick={() => setStations((current) => current.filter((item) => item.key !== station.key))} className="min-h-12 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground" aria-label={`Retirer le ravito ${index + 1}`}>
                ✕
              </button>
            </div>
          ))}
          {stations.length < 40 ? (
            <button type="button" onClick={() => setStations((current) => [...current, { key: Date.now(), name: "", km: "" }])} className="justify-self-start rounded-lg border border-dashed border-brand-border px-3 py-2 text-sm font-semibold text-brand dark:text-emerald-300">
              + Ajouter un ravito
            </button>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold text-foreground">3. Le rendu</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRESETS.map((item) => (
            <label key={item.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${preset === item.value ? "border-brand ring-2 ring-brand/30 dark:border-emerald-400" : "border-border hover:border-brand-border"}`}>
              <input type="radio" name="mapPreset" value={item.value} checked={preset === item.value} onChange={() => setPreset(item.value)} className="sr-only" />
              <span aria-hidden className="h-12 w-12 shrink-0 rounded-lg border border-border" style={{ background: item.swatch }} />
              <span>
                <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{item.description}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="flyover-terrain" className={labelClass}>
            Relief : <span className="text-brand dark:text-emerald-300">{reliefLabel(terrain)}</span> <span className="font-normal text-muted-foreground">(× {terrain.toFixed(1).replace(".", ",")})</span>
          </label>
          <input id="flyover-terrain" type="range" min={1} max={3} step={0.1} value={terrain} onChange={(event) => setTerrain(Number(event.target.value))} className="w-full accent-[#2d5016]" />
          <p className="flex justify-between text-xs text-muted-foreground"><span>Fidèle au terrain</span><span>Dénivelé spectaculaire</span></p>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold text-foreground">4. Diffusion et contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="flyover-instagram" className={labelClass}>Compte Instagram de l’événement {offer === "download" ? optional : null}</label>
            <input id="flyover-instagram" required={offer === "collab"} value={instagramHandle} onChange={(event) => setInstagramHandle(event.target.value)} placeholder="@votre_course" className={inputClass} autoComplete="off" />
          </div>
          {offer === "collab" ? (
            <div className="grid gap-1.5">
              <label htmlFor="flyover-publish" className={labelClass}>Date et heure de publication</label>
              <input id="flyover-publish" type="datetime-local" required min={publishBounds.min} max={publishBounds.max} value={publishLocal} onChange={(event) => setPublishLocal(event.target.value)} className={inputClass} />
              <p className="text-xs text-muted-foreground">Heure de Paris, entre 48 h et 21 jours à l’avance.</p>
            </div>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="flyover-email" className={labelClass}>Adresse e-mail</label>
          <input id="flyover-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@votre-course.fr" className={inputClass} />
          <p className="text-xs text-muted-foreground">Vous y recevez la confirmation, puis le lien de la vidéo dès qu’elle est prête.</p>
        </div>
        <div aria-hidden="true" className="hidden">
          <label htmlFor="flyover-website">Ne pas remplir</label>
          <input id="flyover-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </div>
      </fieldset>

      {status.kind === "error" ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{status.message}</p> : null}
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 text-base font-semibold text-brand-foreground transition hover:bg-brand-light disabled:opacity-60 dark:bg-emerald-400 dark:text-slate-950"
      >
        {status.kind === "sending" ? "Vérification du GPX…" : `Payer ${offer === "collab" ? "29,99 €" : "59,99 €"} et lancer la vidéo`}
      </button>
      <p className="text-xs leading-5 text-muted-foreground">Paiement sécurisé par Stripe, facture envoyée par e-mail.</p>
    </form>
  );
}
