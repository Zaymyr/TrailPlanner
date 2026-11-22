"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";

import { checkFlyoverGpx, FLYOVER_MAP_PRESETS, FLYOVER_TERRAIN, readGpxAidStations, type FlyoverMapPreset } from "../../lib/flyover-shared";
import { trackGoogleAnalyticsEvent } from "../../lib/google-analytics";
import { parseGpx, type ParsedGpx } from "../../lib/gpx/parseGpx";
import { FlyoverPreview, type PreviewStation } from "./flyover-preview";

type Offer = "collab" | "download";
type Station = { key: string; name: string; km: string };
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string };
type GpxState = { kind: "none" } | { kind: "reading" } | { kind: "error"; message: string } | { kind: "ready"; gpx: ParsedGpx; file: File; imported: number };

const MAX_GPX_BYTES = 10 * 1024 * 1024;

const inputClass =
  "h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";
const labelClass = "text-sm font-semibold text-foreground";
const cardClass = "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6";
const stepTitleClass = "text-lg font-semibold text-foreground sm:text-xl";
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

const SWATCHES: Record<FlyoverMapPreset, string> = {
  signature: "linear-gradient(135deg,#ece8dc 0%,#c9d9b0 55%,#2d5016 100%)",
  satellite: "linear-gradient(135deg,#4f6b3a 0%,#8b9a6b 50%,#d8d2bf 100%)",
  relief: "linear-gradient(135deg,#1f5f8b 0%,#3b82f6 45%,#9bd36a 100%)",
  cinema: "linear-gradient(135deg,#1c1410 0%,#8a5a3c 55%,#f3d9b1 100%)",
};
const PRESET_KEYS = Object.keys(FLYOVER_MAP_PRESETS) as FlyoverMapPreset[];

const pad = (value: number) => String(value).padStart(2, "0");
const toLocalInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const reliefLabel = (value: number) => (value < 1.4 ? "Fidèle" : value < 2.2 ? "Accentué" : "Spectaculaire");
const formatKm = (value: number) => value.toFixed(1).replace(".", ",");
const readKm = (value: string) => Number(value.replace(",", ".").replace(/[^\d.]/g, "")) || 0;

/**
 * Order form of the organizer flyover video. The GPX is read in the browser first: its waypoints
 * pre-fill the aid stations and the live 3D preview plays the very composition of the paid
 * render; the offer and the payment come last. Rules: docs/03-business-rules/flyover-video-orders.md.
 */
export function FlyoverOrderForm({ cancelled }: { cancelled: boolean }) {
  const [gpxState, setGpxState] = useState<GpxState>({ kind: "none" });
  const [raceName, setRaceName] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsEdited, setStationsEdited] = useState(false);
  const [preset, setPreset] = useState<FlyoverMapPreset>("signature");
  const [terrain, setTerrain] = useState<number>(FLYOVER_TERRAIN.default);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [publishLocal, setPublishLocal] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>(cancelled ? { kind: "error", message: "Paiement annulé : votre commande n’a pas été validée." } : { kind: "idle" });
  const offerRef = useRef<HTMLDivElement | null>(null);

  const publishBounds = useMemo(() => {
    const now = Date.now();
    return { min: toLocalInput(new Date(now + 49 * 3_600_000)), max: toLocalInput(new Date(now + 21 * 86_400_000)) };
  }, []);

  const previewStations = useMemo<PreviewStation[]>(
    () => stations.filter((station) => station.name.trim()).map((station) => ({ id: station.key, name: station.name.trim(), km: readKm(station.km) })),
    [stations],
  );

  const readFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_GPX_BYTES) {
      setGpxState({ kind: "error", message: "Le GPX dépasse 10 Mo." });
      return;
    }
    setGpxState({ kind: "reading" });
    try {
      const gpx = parseGpx(await file.text());
      const check = checkFlyoverGpx(gpx);
      if (!check.ok) {
        setGpxState({ kind: "error", message: check.message });
        return;
      }
      const fromGpx = readGpxAidStations(gpx);
      setStations(fromGpx.map((station) => ({ key: newKey(), name: station.name, km: formatKm(station.km) })));
      setStationsEdited(false);
      if (!raceName.trim() && gpx.name?.trim()) setRaceName(gpx.name.trim().slice(0, 120));
      setGpxState({ kind: "ready", gpx, file, imported: fromGpx.length });
      trackGoogleAnalyticsEvent("flyover_gpx_previewed", { event_category: "organizer_acquisition", distance_km: Math.round(check.distanceKm), stations: fromGpx.length });
    } catch {
      setGpxState({ kind: "error", message: "Ce fichier n’est pas un GPX lisible." });
    }
  };

  const editStations = (next: (current: Station[]) => Station[]) => {
    setStations(next);
    setStationsEdited(true);
  };

  const chooseOffer = (value: Offer) => {
    setOffer(value);
    trackGoogleAnalyticsEvent("flyover_offer_selected", { event_category: "organizer_acquisition", offer: value });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (gpxState.kind !== "ready") {
      setStatus({ kind: "error", message: "Ajoutez le fichier GPX du parcours." });
      return;
    }
    if (!offer) {
      setStatus({ kind: "error", message: "Choisissez votre formule." });
      offerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setStatus({ kind: "sending" });
    const body = new FormData();
    body.set("offer", offer);
    body.set("raceName", raceName);
    if (raceDate) body.set("raceDate", raceDate);
    body.set("gpx", gpxState.file);
    body.set("aidStations", JSON.stringify(previewStations.map(({ name, km }) => ({ name, km }))));
    if (stationsEdited) body.set("aidStationsEdited", "1");
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

  const ready = gpxState.kind === "ready" ? gpxState : null;

  return (
    <form onSubmit={submit} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      {/* 1. The course: GPX first, everything else follows from it. */}
      <section className={cardClass} aria-labelledby="flyover-step-course">
        <h2 id="flyover-step-course" className={stepTitleClass}>1. Votre parcours</h2>
        <label
          htmlFor="flyover-gpx"
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-5 text-center transition ${ready ? "border-brand-border bg-brand-surface/60 dark:bg-emerald-400/10" : "border-border hover:border-brand-border"}`}
        >
          <span className="text-base font-semibold text-foreground">
            {gpxState.kind === "reading" ? "Lecture du GPX…" : ready ? ready.file.name : "Choisir le fichier GPX"}
          </span>
          <span className="text-sm text-muted-foreground">
            {ready
              ? `${formatKm(ready.gpx.stats.distanceKm)} km · ${Math.round(ready.gpx.stats.gainM ?? 0)} m D+ — toucher pour changer`
              : "Avec les altitudes (Strava, Garmin, Visorando, OpenRunner…), 10 Mo maximum."}
          </span>
          <input id="flyover-gpx" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0] ?? null)} />
        </label>
        {gpxState.kind === "error" ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{gpxState.message}</p> : null}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="grid gap-1.5">
            <label htmlFor="flyover-name" className={labelClass}>Nom de la course</label>
            <input id="flyover-name" required minLength={2} maxLength={120} value={raceName} onChange={(event) => setRaceName(event.target.value)} placeholder="Trail des Crêtes 42 km" className={inputClass} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="flyover-date" className={labelClass}>Date {optional}</label>
            <input id="flyover-date" type="date" value={raceDate} onChange={(event) => setRaceDate(event.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-2">
          <p className={labelClass}>Ravitaillements {optional}</p>
          {ready && ready.imported > 0 && !stationsEdited ? (
            <p className="text-sm text-brand dark:text-emerald-300">{ready.imported} ravito{ready.imported > 1 ? "s" : ""} importé{ready.imported > 1 ? "s" : ""} depuis votre GPX : vérifiez-les.</p>
          ) : null}
          {stations.map((station, index) => (
            <div key={station.key} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.75rem] gap-2">
              <input aria-label={`Nom du ravito ${index + 1}`} value={station.name} maxLength={80} onChange={(event) => editStations((current) => current.map((item) => (item.key === station.key ? { ...item, name: event.target.value } : item)))} placeholder="Col de la Croix" className={inputClass} />
              <input aria-label={`Kilomètre du ravito ${index + 1}`} inputMode="decimal" value={station.km} onChange={(event) => editStations((current) => current.map((item) => (item.key === station.key ? { ...item, km: event.target.value } : item)))} placeholder="km" className={`${inputClass} px-2 text-center`} />
              <button type="button" onClick={() => editStations((current) => current.filter((item) => item.key !== station.key))} className="h-12 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground" aria-label={`Retirer le ravito ${index + 1}`}>
                ✕
              </button>
            </div>
          ))}
          {stations.length < 40 ? (
            <button type="button" onClick={() => editStations((current) => [...current, { key: newKey(), name: "", km: "" }])} className="min-h-11 justify-self-start rounded-lg border border-dashed border-brand-border px-3 text-sm font-semibold text-brand dark:text-emerald-300">
              + Ajouter un ravito
            </button>
          ) : null}
        </div>
      </section>

      {/* 2. The look, with the live preview: the "wow" before any price. */}
      <section className={cardClass} aria-labelledby="flyover-step-style">
        <h2 id="flyover-step-style" className={stepTitleClass}>2. Votre vidéo</h2>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
          <div className="order-2 grid gap-5 lg:order-1">
            <fieldset className="grid gap-2">
              <legend className={`${labelClass} mb-2`}>Fond de carte</legend>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_KEYS.map((key) => (
                  <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 transition sm:gap-3 sm:p-3 ${preset === key ? "border-brand ring-2 ring-brand/30 dark:border-emerald-400" : "border-border hover:border-brand-border"}`}>
                    <input type="radio" name="mapPreset" value={key} checked={preset === key} onChange={() => setPreset(key)} className="sr-only" />
                    <span aria-hidden className="h-10 w-10 shrink-0 rounded-lg border border-border sm:h-12 sm:w-12" style={{ background: SWATCHES[key] }} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{FLYOVER_MAP_PRESETS[key].label}</span>
                      <span className="hidden text-xs leading-5 text-muted-foreground sm:block">{FLYOVER_MAP_PRESETS[key].description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-1.5">
              <label htmlFor="flyover-terrain" className={labelClass}>
                Relief : <span className="text-brand dark:text-emerald-300">{reliefLabel(terrain)}</span> <span className="font-normal text-muted-foreground">(× {terrain.toFixed(1).replace(".", ",")})</span>
              </label>
              <input id="flyover-terrain" type="range" min={FLYOVER_TERRAIN.min} max={FLYOVER_TERRAIN.max} step={0.1} value={terrain} onChange={(event) => setTerrain(Number(event.target.value))} className="h-8 w-full accent-[#2d5016]" />
              <p className="flex justify-between text-xs text-muted-foreground"><span>Fidèle au terrain</span><span>Dénivelé spectaculaire</span></p>
            </div>
            <p className="rounded-xl bg-muted/60 p-3 text-sm leading-6 text-muted-foreground">
              Aperçu sans voix : après la commande, nous écrivons le récit de votre parcours (montées clés, ravitos, arrivée) et l’enregistrons en voix off sur la vidéo finale.
            </p>
          </div>
          <div className="order-1 flex justify-center lg:order-2">
            {ready ? (
              <FlyoverPreview gpx={ready.gpx} raceName={raceName} raceDate={raceDate} stations={previewStations} preset={preset} terrain={terrain} />
            ) : (
              <label htmlFor="flyover-gpx" className="flex aspect-[9/16] w-full max-w-[17rem] cursor-pointer items-center justify-center rounded-[1.75rem] border-[6px] border-slate-900 bg-slate-950 p-6 text-center text-sm leading-6 text-white/80 shadow-2xl">
                Ajoutez votre GPX : l’aperçu 3D de votre vidéo s’affiche ici.
              </label>
            )}
          </div>
        </div>
      </section>

      {/* 3. Offer and payment, once the video is seen. */}
      <section ref={offerRef} className={`${cardClass} scroll-mt-4`} aria-labelledby="flyover-step-offer">
        <h2 id="flyover-step-offer" className={stepTitleClass}>3. Votre formule</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {OFFERS.map((item) => (
            <label
              key={item.value}
              className={`cursor-pointer rounded-xl border p-4 transition ${offer === item.value ? "border-brand bg-brand-surface ring-2 ring-brand/30 dark:border-emerald-400 dark:bg-emerald-400/10" : "border-border bg-background hover:border-brand-border"}`}
            >
              <input type="radio" name="offer" value={item.value} checked={offer === item.value} onChange={() => chooseOffer(item.value)} className="sr-only" />
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

        {offer ? (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="flyover-instagram" className={labelClass}>Compte Instagram de l’événement {offer === "download" ? optional : null}</label>
                <input id="flyover-instagram" required={offer === "collab"} value={instagramHandle} onChange={(event) => setInstagramHandle(event.target.value)} placeholder="@votre_course" className={inputClass} autoComplete="off" autoCapitalize="none" />
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
          </div>
        ) : null}
        <div aria-hidden="true" className="hidden">
          <label htmlFor="flyover-website">Ne pas remplir</label>
          <input id="flyover-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </div>

        {status.kind === "error" ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{status.message}</p> : null}
        <button
          type="submit"
          disabled={status.kind === "sending" || !ready}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-5 text-base font-semibold text-brand-foreground transition hover:bg-brand-light disabled:opacity-60 sm:w-auto sm:justify-self-start dark:bg-emerald-400 dark:text-slate-950"
        >
          {status.kind === "sending"
            ? "Ouverture du paiement…"
            : !ready
              ? "Ajoutez d’abord votre GPX"
              : offer
                ? `Payer ${offer === "collab" ? "29,99 €" : "59,99 €"} et lancer la vidéo`
                : "Choisir ma formule"}
        </button>
        <p className="text-xs leading-5 text-muted-foreground">Paiement sécurisé par Stripe, facture envoyée par e-mail.</p>
      </section>
    </form>
  );
}
