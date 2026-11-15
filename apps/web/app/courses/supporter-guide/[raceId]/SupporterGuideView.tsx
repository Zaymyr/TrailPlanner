"use client";

import { colors as designColors } from "@pace-yourself/design-system";
import type { SupporterGuidePayload, SupporterGuideStop, SupporterGuideTimelineEntry } from "@trailplanner/shared";
import { useEffect, useMemo, useState } from "react";

const SECTIONS = ["programme", "follow", "onsite", "stay", "practical"] as const;
type Section = typeof SECTIONS[number];

const tag = (locale: "fr" | "en") => (locale === "fr" ? "fr-FR" : "en-US");
const isoDay = (value: string | null | undefined) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
};
const formatKm = (value: number, locale: "fr" | "en") => `${new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 1 }).format(value)} km`;
const formatDay = (value: string | null, locale: "fr" | "en") => {
  const date = isoDay(value);
  if (!date) return null;
  const label = date.toLocaleDateString(tag(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const formatRange = (start: string | null, end: string | null, locale: "fr" | "en") => {
  const from = isoDay(start);
  const to = isoDay(end);
  const full = (date: Date) => date.toLocaleDateString(tag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  if (!from) return to ? full(to) : null;
  if (!to || to.getTime() === from.getTime()) return full(from);
  return `${from.toLocaleDateString(tag(locale), { day: "numeric", ...(from.getUTCMonth() === to.getUTCMonth() ? {} : { month: "short" }), timeZone: "UTC" })} – ${full(to)}`;
};
/** "15:00" on the race day, otherwise "sam. 01:00". */
const formatCutoff = (cutoff: { date: string | null; time: string; dayOffset: number } | null | undefined, fallback: string | null, raceDate: string | null, locale: "fr" | "en") => {
  if (!cutoff) return fallback;
  const date = isoDay(cutoff.date);
  if (!date || cutoff.date === raceDate || cutoff.dayOffset === 0) return cutoff.time;
  return `${date.toLocaleDateString(tag(locale), { weekday: "short", timeZone: "UTC" })} ${cutoff.time}`;
};

export function SupporterGuideView({ raceId }: { raceId: string }) {
  const [guide, setGuide] = useState<SupporterGuidePayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<Section>("programme");
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [kind, setKind] = useState<Kind>("all");
  const [followed, setFollowed] = useState<Set<string> | null>(null);
  const [now, setNow] = useState(() => new Date());
  const formatColors = useMemo(() => resolveFormatColors(guide?.formats ?? []), [guide]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!guide) return;
    const known = new Set(guide.formats.map((format) => format.raceId));
    let stored: string[] = [];
    try { stored = JSON.parse(window.localStorage.getItem(`supporter-guide-followed:${guide.edition.id}`) ?? "[]") as string[]; } catch { stored = []; }
    const kept = stored.filter((id) => known.has(id));
    setFollowed(new Set(kept.length > 0 ? kept : known));
  }, [guide]);
  const toggleFollowed = (raceIdToToggle: string) => {
    setFollowed((current) => {
      const next = new Set(current ?? []);
      if (next.has(raceIdToToggle)) { if (next.size === 1) return current; next.delete(raceIdToToggle); } else next.add(raceIdToToggle);
      try { if (guide) window.localStorage.setItem(`supporter-guide-followed:${guide.edition.id}`, JSON.stringify([...next])); } catch { /* storage unavailable */ }
      return next;
    });
  };
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
    follow: guide.formats.some((format) => (format.stops?.length ?? 0) > 0 || format.supporterPoints.length || format.aidStations.length),
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
      <p className="text-muted-foreground">{[guide.edition.location, formatRange(guide.edition.startDate, guide.edition.endDate, locale)].filter(Boolean).join(" · ")}</p>
      {guide.organizerPreview ? <p className="rounded-md bg-amber-100 px-3 py-2 text-sm font-medium">{labels.preview}</p> : null}
    </header>
    <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur" aria-label="Sections du livret">
      {SECTIONS.filter((section) => visible[section]).map((section) => <button key={section} type="button" onClick={() => setActive(section)} aria-current={active === section ? "page" : undefined} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${active === section ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}>{labels[section]}</button>)}
    </nav>
    <div className="space-y-5 px-5 py-6">
      {guide.formats.length > 1 && active === "programme" ? <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{locale === "fr" ? "Je suis" : "I follow"}</p><div className="flex flex-wrap gap-x-4 gap-y-1">{guide.formats.map((format) => { const on = followed?.has(format.raceId) ?? true; return <label key={format.raceId} title={format.name} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 font-mono text-sm font-semibold ${on ? "text-foreground" : "text-muted-foreground"}`}><input type="checkbox" className="h-4 w-4" style={{ accentColor: formatColors[format.raceId] }} checked={on} onChange={() => toggleFollowed(format.raceId)} />{Math.round(format.distanceKm)} km</label>; })}</div></div> : null}
      {active === "programme" ? <Programme timeline={guide.timeline ?? []} kind={kind} onKind={setKind} followed={followed} now={now} locale={locale} formatColors={formatColors} /> : null}
      {active === "follow" ? guide.formats.filter((format) => (format.stops?.length ?? 0) > 0 || format.supporterPoints.length || format.aidStations.length).map((format) => <section key={format.raceId} className="space-y-3"><h2 className="flex items-center gap-2 text-xl font-semibold"><span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: formatColors[format.raceId] }} />{format.name}</h2>{(format.stops ?? []).map((stop) => <StopCard key={stop.id} stop={stop} raceDate={format.date} now={now} locale={locale} />)}</section>) : null}
      {active === "onsite" ? guide.onSiteServices.map((service) => <ServiceCard key={service.id} locale={locale} service={service} />) : null}
      {active === "stay" ? <>{guide.stayServices.map((service) => <ServiceCard key={service.id} locale={locale} service={service} />)}{guide.lodgingPartner ? <article className="rounded-xl border border-border p-4"><h2 className="font-semibold">{locale === "fr" ? "Hébergement partenaire" : "Accommodation partner"} · {guide.lodgingPartner.name}</h2>{guide.lodgingPartner.headline ? <p>{guide.lodgingPartner.headline}</p> : null}{guide.lodgingPartner.clickUrl ? <a className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline" href={guide.lodgingPartner.clickUrl} rel="noreferrer" target="_blank">{locale === "fr" ? "Découvrir" : "Discover"}</a> : null}</article> : null}</> : null}
      {active === "practical" ? <>{guide.practical.access.map((item) => <article key={item.raceId} className="rounded-xl border border-border p-4"><h2 className="font-semibold">{item.raceName}</h2>{item.start.address ? <p><strong>{locale === "fr" ? "Départ" : "Start"} :</strong> {item.start.address}</p> : null}{item.finish.address ? <p><strong>{locale === "fr" ? "Arrivée" : "Finish"} :</strong> {item.finish.address}</p> : null}{item.parking ? <p><strong>Parking :</strong> {item.parking}</p> : null}{item.shuttles ? <p><strong>{locale === "fr" ? "Navettes" : "Shuttles"} :</strong> {item.shuttles} {item.shuttleSchedule}</p> : null}{item.roadRestrictions ? <p><strong>{locale === "fr" ? "Circulation" : "Road access"} :</strong> {item.roadRestrictions}</p> : null}</article>)}{guide.practical.thirdPartyBibPickup.map((item) => <article key={item.raceId} className="rounded-xl border border-border p-4"><h2 className="font-semibold">{locale === "fr" ? "Retrait par un tiers" : "Third-party bib pickup"} · {item.raceName}</h2>{item.conditions ? <p>{item.conditions}</p> : <p>{locale === "fr" ? "Autorisé par l’organisation." : "Allowed by the organizer."}</p>}</article>)}{guide.practical.emergencyPhone ? <a className="block rounded-xl border border-border p-4 font-semibold text-brand" href={`tel:${guide.practical.emergencyPhone}`}>{locale === "fr" ? "Urgence" : "Emergency"} · {guide.practical.emergencyPhone}</a> : null}{guide.practical.links.map((link) => <a key={link.url} className="block rounded-xl border border-border p-4 font-semibold text-brand" href={link.url} rel="noreferrer" target="_blank">{link.kind === "official" ? (locale === "fr" ? "Site officiel" : "Official website") : link.kind === "instagram" ? "Instagram" : "Facebook"}</a>)}</> : null}
    </div>
  </main>;
}

type Kind = "all" | "start" | "arrival" | "awards" | "animations";
const KIND_OF: Record<SupporterGuideTimelineEntry["kind"], Exclude<Kind, "all">> = { start: "start", finish_cutoff: "arrival", arrival_estimate: "arrival", awards: "awards", animation: "animations" };
const localDate = (date: string | null | undefined, time: string | null | undefined) => {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? "");
  const clock = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  return day && clock ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), Number(clock[1]), Number(clock[2])) : null;
};
const localIsoDay = (now: Date) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const clockOf = (now: Date) => `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
const countdown = (target: Date, now: Date, locale: "fr" | "en") => {
  const minutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const duration = hours === 0 ? `${minutes} min` : `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
  return locale === "fr" ? `dans ${duration}` : `in ${duration}`;
};

/** One colour per format, by increasing distance (same rule as the app). */
function resolveFormatColors(formats: Array<{ raceId: string; distanceKm: number; name: string }>): Record<string, string> {
  return Object.fromEntries([...formats]
    .sort((left, right) => left.distanceKm - right.distanceKm || left.name.localeCompare(right.name))
    .map((format, index) => [format.raceId, designColors.formats[index % designColors.formats.length]!]));
}

const ICON_PATHS: Record<string, string> = {
  start: "M8 5v14l11-7z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 4h-2v6l5 3 1-1.7-4-2.3z",
  awards: "M7 3h10v4a5 5 0 0 1-4 4.9V15h3v2H8v-2h3v-3.1A5 5 0 0 1 7 7zM5 4h2v3H5a2 2 0 0 1 0-3zm12 0h2a2 2 0 0 1 0 3h-2z",
  animation: "M9 17.5a2.5 2.5 0 1 1-2.5-2.5H9V5l10-2v12.5a2.5 2.5 0 1 1-2.5-2.5H19V6.4l-8 1.6v9.5z",
  done: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
};
const iconOf = (entry: SupporterGuideTimelineEntry) => entry.kind === "start" ? "start" : entry.kind === "awards" ? "awards" : entry.kind === "animation" ? "animation" : "clock";

function Programme({ timeline, kind, onKind, followed, now, locale, formatColors }: { timeline: SupporterGuideTimelineEntry[]; kind: Kind; onKind: (kind: Kind) => void; followed: Set<string> | null; now: Date; locale: "fr" | "en"; formatColors: Record<string, string> }) {
  const fr = locale === "fr";
  const mine = timeline.filter((entry) => entry.eventWide || !followed || followed.has(entry.raceId));
  const kinds = (["start", "arrival", "awards", "animations"] as const).filter((value) => mine.some((entry) => KIND_OF[entry.kind] === value));
  const shown = mine.filter((entry) => kind === "all" || KIND_OF[entry.kind] === kind);
  const today = localIsoDay(now);
  const label = { all: fr ? "Tout" : "All", start: fr ? "Départs" : "Starts", arrival: fr ? "Arrivées" : "Finishes", awards: fr ? "Podiums" : "Awards", animations: fr ? "Animations" : "Activities" };
  const kindText = { start: fr ? "Départ" : "Start", finish_cutoff: fr ? "Dernier coureur (arrivée)" : "Finish cutoff", arrival_estimate: fr ? "Arrivée estimée" : "Expected finish", awards: fr ? "Podium" : "Awards", animation: fr ? "Animation" : "Activity" };
  const audienceText = (audience: SupporterGuideTimelineEntry["audience"]) => audience === "women" ? (fr ? "1re femme" : "first woman") : (fr ? "1er homme" : "first man");
  return <>
    {kinds.length > 1 ? <div className="flex gap-2 overflow-x-auto">{(["all", ...kinds] as Kind[]).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => onKind(value)} className={`min-h-11 shrink-0 rounded-md border px-4 text-sm font-semibold ${kind === value ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted-foreground"}`}>{label[value]}</button>)}</div> : null}
    {shown.length === 0 ? <p className="text-muted-foreground">{fr ? "Rien pour ce filtre." : "Nothing for this filter."}</p> : null}
    {groupByDay(shown).map((day) => {
      const live = day.date === today;
      const dayPast = Boolean(day.date && day.date < today);
      const nextIndex = live ? day.entries.findIndex((entry) => (localDate(entry.date, entry.time)?.getTime() ?? 0) >= now.getTime()) : -1;
      const DayTag = dayPast ? "details" : "section";
      return <DayTag key={day.date ?? "undated"} className={`space-y-2 ${dayPast ? "opacity-60" : ""}`}>
        {dayPast ? <summary className="flex min-h-11 cursor-pointer items-center gap-3 text-lg font-semibold">{formatDay(day.date, locale)}<span className="text-sm font-medium text-muted-foreground">{fr ? "Terminé" : "Done"} · {day.entries.length}</span></summary> : <h2 className="flex items-center gap-3 text-lg font-semibold">{formatDay(day.date, locale) ?? (fr ? "Programme" : "Schedule")}{live ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">{fr ? "En direct" : "Live"} · {clockOf(now)}</span> : null}</h2>}
        <ol className="divide-y divide-border rounded-xl border border-border">
          {day.entries.map((entry, index) => {
            const at = localDate(entry.date, entry.time);
            const past = dayPast || (live && at !== null && at.getTime() < now.getTime());
            return <li key={entry.id}>
              {live && index === nextIndex ? <div className="flex items-center gap-2 px-4 py-1 text-xs font-semibold text-amber-700"><span className="h-0.5 flex-1 bg-amber-500" />{clockOf(now)} · {fr ? "maintenant" : "now"}<span className="h-0.5 flex-1 bg-amber-500" /></div> : null}
              <div className={`flex items-start gap-3 px-4 py-3 ${past ? "opacity-45" : ""}`}>
                <span className="w-14 shrink-0 font-mono text-lg font-semibold tabular-nums">{entry.time}</span>
                <span aria-hidden className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: past ? "#9CA3AF" : entry.eventWide ? designColors.brand.forest : formatColors[entry.raceId] ?? designColors.brand.forest }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d={ICON_PATHS[past ? "done" : iconOf(entry)]} /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: entry.eventWide ? designColors.brand.forest : formatColors[entry.raceId] ?? designColors.brand.forest }}>{past ? "✓ " : ""}{kindText[entry.kind]}{entry.kind === "arrival_estimate" ? ` · ${audienceText(entry.audience)}` : entry.label && !entry.eventWide ? ` · ${entry.label}` : ""}{entry.endTime ? ` → ${entry.endTime}` : ""}</span>
                  <span className="flex items-center gap-2 font-semibold">{entry.eventWide ? null : <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: formatColors[entry.raceId] }} />}{entry.eventWide ? entry.label : entry.raceName}</span>
                  {entry.location ? <span className="block text-sm text-muted-foreground">{entry.location}</span> : null}
                  {live && index === nextIndex && at ? <span className="mt-1 inline-block rounded-full bg-brand-surface px-2 py-0.5 text-xs font-semibold text-brand">{countdown(at, now, locale)}</span> : null}
                </span>
                {entry.kind === "start" && entry.mapsUrl && !past ? <a className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-brand px-3 text-sm font-semibold text-brand" href={entry.mapsUrl} rel="noreferrer" target="_blank">{fr ? "Y aller" : "Directions"}</a> : null}
              </div>
            </li>;
          })}
        </ol>
      </DayTag>;
    })}
  </>;
}

function StopCard({ stop, raceDate, now, locale }: { stop: SupporterGuideStop; raceDate: string | null; now: Date; locale: "fr" | "en" }) {
  const fr = locale === "fr";
  const cutoffAt = stop.cutoff ? localDate(stop.cutoff.date ?? raceDate, stop.cutoff.time) : null;
  const closed = stop.endpoint !== "start" && Boolean(cutoffAt && cutoffAt.getTime() < now.getTime());
  const kicker = stop.endpoint === "start" ? (fr ? "Départ" : "Start") : stop.isFinish ? (fr ? "Arrivée" : "Finish") : null;
  const startTimes = stop.startTimes?.map((item) => (item.label ? `${item.label} ${item.time}` : item.time)).join(" · ");
  const expected = (["men", "women"] as const).flatMap((audience) => {
    const clock = stop.expectedArrivals?.[audience];
    return clock ? [`${fr ? "Arrivée estimée" : "Expected finish"} · ${audience === "men" ? (fr ? "1er homme" : "first man") : (fr ? "1re femme" : "first woman")} : ${formatCutoff(clock, null, raceDate, locale)}`] : [];
  });
  const roles = [stop.aidStation && !stop.isFinish ? (fr ? "Ravito" : "Aid station") : null, stop.encouragementAllowed ? (fr ? "Encouragement" : "Cheering") : null, stop.assistanceAllowed || stop.services.runnerAssistance ? "Assistance" : null].filter(Boolean);
  const access = stop.supportersAccess === "forbidden" ? (fr ? "Accompagnateurs interdits" : "No supporters") : stop.supportersAccess === "restricted" ? (fr ? "Accès accompagnateurs limité" : "Restricted supporter access") : stop.supportersAccess === "allowed" ? (fr ? "Accompagnateurs autorisés" : "Supporters allowed") : null;
  const services = [stop.services.water ? (fr ? "Eau" : "Water") : null, stop.services.food ? (fr ? "Nourriture" : "Food") : null, ...stop.services.amenities].filter(Boolean);
  const url = stop.mapsUrl ?? (stop.latitude !== null && stop.longitude !== null ? `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}` : null);
  return <article className={`rounded-xl border border-border p-4 ${closed ? "opacity-55" : ""}`}>
    <h3 className="font-semibold">{kicker ? `${kicker}${stop.name ? " · " : ""}` : ""}{stop.name} · {stop.kmMax !== null ? `${formatKm(stop.km, locale).replace(" km", "")}–${formatKm(stop.kmMax, locale)}` : formatKm(stop.km, locale)}</h3>
    {startTimes ? <p className="mt-1 font-semibold">{fr ? "Départ" : "Start"} : {startTimes}</p> : null}
    {expected.map((line) => <p key={line}>{line}</p>)}
    <p className="mt-1 text-sm text-muted-foreground">{[closed ? (fr ? "Fermé" : "Closed") : null, ...roles, access].filter(Boolean).join(" · ")}</p>
    {services.length ? <p className="text-sm text-muted-foreground">{services.join(" · ")}</p> : null}
    {stop.cutoff ? <p className="mt-2">{fr ? "Dernier coureur" : "Last runner"} : {formatCutoff(stop.cutoff, null, raceDate, locale)}</p> : null}
    {stop.maxStopMinutes ? <p>{fr ? "Arrêt max." : "Maximum stop"} : {stop.maxStopMinutes} min</p> : null}
    {stop.accessLabel ? <p className="mt-2">{stop.accessLabel}</p> : null}
    {stop.accessNote ? <p className="text-sm text-muted-foreground">{stop.accessNote}</p> : null}
    <div className="mt-3 flex gap-3">{url ? <a className="font-semibold text-brand underline" href={url} rel="noreferrer" target="_blank">{stop.endpoint ? (fr ? "Y aller" : "Directions") : (fr ? "Itinéraire" : "Directions")}</a> : null}{stop.planUrl ? <a className="font-semibold text-brand underline" href={stop.planUrl} rel="noreferrer" target="_blank">{fr ? "Plan" : "Map"}</a> : null}</div>
  </article>;
}

function groupByDay(entries: NonNullable<SupporterGuidePayload["timeline"]>) {
  const days: Array<{ date: string | null; entries: typeof entries }> = [];
  for (const entry of entries) {
    const current = days.at(-1);
    if (current && current.date === entry.date) current.entries.push(entry);
    else days.push({ date: entry.date, entries: [entry] });
  }
  return days;
}

function ServiceCard({ locale, service }: { locale: "fr" | "en"; service: SupporterGuidePayload["stayServices"][number] }) {
  return <article className="rounded-xl border border-border p-4"><h2 className="font-semibold">{service.name}</h2>{service.description ? <p className="mt-1 text-muted-foreground">{service.description}</p> : null}{service.location.address ? <p className="mt-2">{service.location.address}</p> : null}<div className="mt-2 flex gap-3">{service.location.mapsUrl ? <a className="font-semibold text-brand underline" href={service.location.mapsUrl} rel="noreferrer" target="_blank">{locale === "fr" ? "Itinéraire" : "Directions"}</a> : null}{service.websiteUrl ? <a className="font-semibold text-brand underline" href={service.websiteUrl} rel="noreferrer" target="_blank">{locale === "fr" ? "Site" : "Website"}</a> : null}</div></article>;
}
