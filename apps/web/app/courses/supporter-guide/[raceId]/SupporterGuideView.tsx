"use client";

import type { SupporterGuidePayload } from "@trailplanner/shared";
import { useEffect, useMemo, useState } from "react";

const SECTIONS = ["programme", "follow", "onsite", "stay", "practical"] as const;
type Section = typeof SECTIONS[number];

const clock = (value: string | null) => value || "—";

export function SupporterGuideView({ raceId }: { raceId: string }) {
  const [guide, setGuide] = useState<SupporterGuidePayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<Section>("programme");
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  useEffect(() => { if (navigator.language.toLowerCase().startsWith("en")) setLocale("en"); }, []);
  const labels = locale === "fr" ? {
    title: "Livret accompagnateur", unavailable: "Livret accompagnateur indisponible", unavailableBody: "Aucun livret publié n’est disponible pour cette édition.", loading: "Chargement du Livret accompagnateur…",
    programme: "Programme", follow: "Suivre", onsite: "Sur place", stay: "Séjour", practical: "Pratique", preview: "Aperçu organisateur · contenu publié uniquement",
  } : {
    title: "Supporter Guide", unavailable: "Supporter Guide unavailable", unavailableBody: "No published guide is available for this edition.", loading: "Loading the Supporter Guide…",
    programme: "Schedule", follow: "Follow", onsite: "On site", stay: "Stay", practical: "Practical", preview: "Organizer preview · published content only",
  };
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/supporter-guide?raceId=${encodeURIComponent(raceId)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<SupporterGuidePayload> : Promise.reject())
      .then(setGuide).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [raceId]);
  const visible = useMemo(() => guide ? {
    programme: guide.formats.length > 0,
    follow: guide.formats.some((format) => format.supporterPoints.length || format.aidStations.length),
    onsite: guide.onSiteServices.length > 0,
    stay: guide.stayServices.length > 0 || Boolean(guide.lodgingPartner),
    practical: guide.practical.access.length > 0 || guide.practical.thirdPartyBibPickup.length > 0 || Boolean(guide.practical.emergencyPhone) || guide.practical.links.length > 0,
  } : null, [guide]);
  useEffect(() => {
    if (visible && !visible[active]) setActive(SECTIONS.find((section) => visible[section]) ?? "programme");
  }, [active, visible]);
  if (failed) return <main className="mx-auto min-h-screen max-w-xl px-5 py-16"><h1 className="text-2xl font-semibold">{labels.unavailable}</h1><p className="mt-3 text-muted-foreground">{labels.unavailableBody}</p></main>;
  if (!guide || !visible) return <main className="mx-auto min-h-screen max-w-xl px-5 py-16" aria-busy="true"><p>{labels.loading}</p></main>;
  return <main className="mx-auto min-h-screen max-w-xl bg-background pb-20">
    <header className="space-y-2 border-b border-border bg-brand-surface px-5 py-7">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold uppercase tracking-wide text-brand">{labels.title}</p><button type="button" className="min-h-11 rounded-full border border-border px-3 text-sm font-semibold" onClick={() => setLocale((value) => value === "fr" ? "en" : "fr")} aria-label={locale === "fr" ? "Display in English" : "Afficher en français"}>{locale === "fr" ? "EN" : "FR"}</button></div>
      <h1 className="text-3xl font-semibold text-foreground">{guide.edition.name}</h1>
      <p className="text-muted-foreground">{[guide.edition.location, guide.edition.startDate].filter(Boolean).join(" · ")}</p>
      {guide.organizerPreview ? <p className="rounded-md bg-warning/10 px-3 py-2 text-sm font-medium">{labels.preview}</p> : null}
    </header>
    <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur" aria-label="Sections du livret">
      {SECTIONS.filter((section) => visible[section]).map((section) => <button key={section} type="button" onClick={() => setActive(section)} aria-current={active === section ? "page" : undefined} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${active === section ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}>{labels[section]}</button>)}
    </nav>
    <div className="space-y-5 px-5 py-6">
      {active === "programme" ? guide.formats.map((format) => <article key={format.raceId} className="rounded-xl border border-border p-4"><h2 className="text-lg font-semibold">{format.name}</h2><p className="mt-1 text-sm text-muted-foreground">{[format.date, `${format.distanceKm} km`].filter(Boolean).join(" · ")}</p><ul className="mt-4 space-y-2"><li><strong>{locale === "fr" ? "Départ" : "Start"} :</strong> {format.startWaves.length ? format.startWaves.map((wave) => `${wave.name} ${wave.time}`).join(" · ") : clock(format.startTime)}</li>{format.finishCutoffTime ? <li><strong>{locale === "fr" ? "Barrière d’arrivée" : "Finish cutoff"} :</strong> {format.finishCutoffTime}</li> : null}{format.awards.map((award) => <li key={award.id}><strong>{locale === "fr" ? "Podium" : "Awards"} {award.label} :</strong> {award.time}{award.location ? ` · ${award.location}` : ""}</li>)}</ul></article>) : null}
      {active === "follow" ? guide.formats.filter((format) => format.supporterPoints.length || format.aidStations.length).map((format) => <section key={format.raceId} className="space-y-3"><h2 className="text-xl font-semibold">{format.name}</h2>{format.supporterPoints.map((point) => <article key={point.id} className="rounded-xl border border-border p-4"><h3 className="font-semibold">{point.name} · km {point.km}</h3><p className="mt-1 text-sm text-muted-foreground">{[point.encouragementAllowed ? (locale === "fr" ? "Encouragement" : "Cheering") : null, point.assistanceAllowed ? (locale === "fr" ? "Assistance" : "Assistance") : null].filter(Boolean).join(" · ")}</p>{point.accessLabel ? <p className="mt-2">{point.accessLabel}</p> : null}{point.accessNote ? <p className="text-sm text-muted-foreground">{point.accessNote}</p> : null}<div className="mt-3 flex gap-3">{point.mapsUrl ? <a className="font-semibold text-brand underline" href={point.mapsUrl} rel="noreferrer" target="_blank">{locale === "fr" ? "Itinéraire" : "Directions"}</a> : null}{point.planUrl ? <a className="font-semibold text-brand underline" href={point.planUrl} rel="noreferrer" target="_blank">{locale === "fr" ? "Plan" : "Map"}</a> : null}</div></article>)}{format.aidStations.map((station) => <article key={station.id} className="rounded-xl border border-border p-4"><h3 className="font-semibold">{station.name} · km {station.km}</h3><p className="mt-1 text-sm text-muted-foreground">{station.supportersAccess === "forbidden" ? (locale === "fr" ? "Accès accompagnateurs interdit" : "Supporter access prohibited") : station.supportersAccess === "restricted" ? (locale === "fr" ? "Accès accompagnateurs limité" : "Restricted supporter access") : station.assistanceAllowed ? (locale === "fr" ? "Assistance autorisée" : "Assistance allowed") : (locale === "fr" ? "Ravitaillement" : "Aid station")}</p>{station.cutoffTime ? <p className="mt-2">{locale === "fr" ? "Dernier coureur" : "Last runner"} : {station.cutoffTime}</p> : null}{station.maxStopMinutes ? <p>{locale === "fr" ? "Arrêt max." : "Maximum stop"} : {station.maxStopMinutes} min</p> : null}{station.amenities.length ? <p>{station.amenities.join(" · ")}</p> : null}</article>)}</section>) : null}
      {active === "onsite" ? guide.onSiteServices.map((service) => <ServiceCard key={service.id} locale={locale} service={service} />) : null}
      {active === "stay" ? <>{guide.stayServices.map((service) => <ServiceCard key={service.id} locale={locale} service={service} />)}{guide.lodgingPartner ? <article className="rounded-xl border border-border p-4"><h2 className="font-semibold">{locale === "fr" ? "Hébergement partenaire" : "Accommodation partner"} · {guide.lodgingPartner.name}</h2>{guide.lodgingPartner.headline ? <p>{guide.lodgingPartner.headline}</p> : null}{guide.lodgingPartner.clickUrl ? <a className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline" href={guide.lodgingPartner.clickUrl} rel="noreferrer" target="_blank">{locale === "fr" ? "Découvrir" : "Discover"}</a> : null}</article> : null}</> : null}
      {active === "practical" ? <>{guide.practical.access.map((item) => <article key={item.raceId} className="rounded-xl border border-border p-4"><h2 className="font-semibold">{item.raceName}</h2>{item.start.address ? <p><strong>{locale === "fr" ? "Départ" : "Start"} :</strong> {item.start.address}</p> : null}{item.finish.address ? <p><strong>{locale === "fr" ? "Arrivée" : "Finish"} :</strong> {item.finish.address}</p> : null}{item.parking ? <p><strong>Parking :</strong> {item.parking}</p> : null}{item.shuttles ? <p><strong>{locale === "fr" ? "Navettes" : "Shuttles"} :</strong> {item.shuttles} {item.shuttleSchedule}</p> : null}{item.roadRestrictions ? <p><strong>{locale === "fr" ? "Circulation" : "Road access"} :</strong> {item.roadRestrictions}</p> : null}</article>)}{guide.practical.thirdPartyBibPickup.map((item) => <article key={item.raceId} className="rounded-xl border border-border p-4"><h2 className="font-semibold">{locale === "fr" ? "Retrait par un tiers" : "Third-party bib pickup"} · {item.raceName}</h2>{item.conditions ? <p>{item.conditions}</p> : <p>{locale === "fr" ? "Autorisé par l’organisation." : "Allowed by the organizer."}</p>}</article>)}{guide.practical.emergencyPhone ? <a className="block rounded-xl border border-border p-4 font-semibold text-brand" href={`tel:${guide.practical.emergencyPhone}`}>{locale === "fr" ? "Urgence" : "Emergency"} · {guide.practical.emergencyPhone}</a> : null}{guide.practical.links.map((link) => <a key={link.url} className="block rounded-xl border border-border p-4 font-semibold text-brand" href={link.url} rel="noreferrer" target="_blank">{link.kind === "official" ? (locale === "fr" ? "Site officiel" : "Official website") : link.kind === "instagram" ? "Instagram" : "Facebook"}</a>)}</> : null}
    </div>
  </main>;
}

function ServiceCard({ locale, service }: { locale: "fr" | "en"; service: SupporterGuidePayload["stayServices"][number] }) {
  return <article className="rounded-xl border border-border p-4"><h2 className="font-semibold">{service.name}</h2>{service.description ? <p className="mt-1 text-muted-foreground">{service.description}</p> : null}{service.location.address ? <p className="mt-2">{service.location.address}</p> : null}<div className="mt-2 flex gap-3">{service.location.mapsUrl ? <a className="font-semibold text-brand underline" href={service.location.mapsUrl} rel="noreferrer" target="_blank">{locale === "fr" ? "Itinéraire" : "Directions"}</a> : null}{service.websiteUrl ? <a className="font-semibold text-brand underline" href={service.websiteUrl} rel="noreferrer" target="_blank">{locale === "fr" ? "Site" : "Website"}</a> : null}</div></article>;
}
