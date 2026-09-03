import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import React from "react";

import { Card, CardContent } from "../../../components/ui/card";
import { AccordionItem } from "../../../components/ui/accordion";
import { getPublicRaceDetail } from "../../../lib/public-race-detail";
import type { PublicRace } from "../../../lib/public-races";
import { getPublicRaces, resolvePublicRaceSlug } from "../../../lib/public-races";
import { getOtherEventFormats, getSimilarRaces } from "../../../lib/race-discovery";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../../seo";
import { PublicElevationProfile } from "../_components/PublicElevationProfile";
import { RaceLinksCarousel } from "../_components/RaceLinksCarousel";
import { RaceAidStationsTimeline } from "../_components/RaceAidStationsTimeline";
import { RaceHeroSummary } from "../_components/RaceHeroSummary";
import { RaceMetricsDetails } from "../_components/RaceMetricsDetails";
import { RaceRouteExplorer } from "../_components/RaceRouteExplorer";
import { buildRaceMetadataDescription, buildRaceMetadataTitle, formatPublicRaceDate } from "./race-metadata";

export const revalidate = 3600;

type PageProps = { params: { slug: string } };

const formatDate = formatPublicRaceDate;

const hasText = (...values: Array<string | null | undefined>) => values.some((value) => Boolean(value?.trim()));

const buildDescription = buildRaceMetadataDescription;


const DetailLine = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <p>
    <span className="font-semibold text-foreground">{label} :</span> {value}
  </p>
);

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, "aria-hidden": true } as const;

const ClockIcon = () => (
  <svg {...iconProps} className="h-5 w-5">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MapPinIcon = () => (
  <svg {...iconProps} className="h-5 w-5">
    <path d="M12 21s-7-7.6-7-12.3A7 7 0 0 1 19 8.7C19 13.4 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="8.7" r="2.4" />
  </svg>
);

const TicketIcon = () => (
  <svg {...iconProps} className="h-5 w-5">
    <path d="M4 9a2 2 0 0 0 0 4v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-4V6a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v3Z" strokeLinejoin="round" />
    <path d="M9 5v14" strokeDasharray="2 2" />
  </svg>
);

const BackpackIcon = () => (
  <svg {...iconProps} className="h-5 w-5">
    <path d="M8 8V6a4 4 0 0 1 8 0v2" strokeLinecap="round" />
    <rect x="5" y="8" width="14" height="13" rx="2.5" />
    <path d="M9 12h6M10 21v-4h4v4" strokeLinecap="round" />
  </svg>
);

const UsersIcon = () => (
  <svg {...iconProps} className="h-5 w-5">
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
    <path d="M15.5 6.5a3 3 0 0 1 0 6M20.5 20a5 5 0 0 0-4-4.9" strokeLinecap="round" />
  </svg>
);

const InfoIcon = () => (
  <svg {...iconProps} className="h-5 w-5">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" strokeLinecap="round" />
    <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg {...iconProps} className="h-4 w-4">
    <path d="M9 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4M14 4h6v6M20 4 11 13" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const mapLinkClassName =
  "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold text-brand transition hover:border-brand-border hover:bg-brand-surface";

const MapLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={mapLinkClassName}>
    <ExternalLinkIcon />
    {children}
  </a>
);

const RequirementBadge = ({ required }: { required: boolean }) => (
  <span
    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      required ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
    }`}
  >
    {required ? "Obligatoire" : "Recommandé"}
  </span>
);

const StatusBadge = ({ positive, label }: { positive: boolean; label: string }) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      positive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
    }`}
  >
    {label}
  </span>
);


export async function generateStaticParams() {
  const races = await getPublicRaces();
  return races.map((race) => ({ slug: race.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolution = await resolvePublicRaceSlug(params.slug);
  if (!resolution) return { title: "Course introuvable", robots: { index: false, follow: false } };
  const { race } = resolution;
  const canonicalPath = `/courses/${race.slug}`;
  const title = buildRaceMetadataTitle(race);
  const description = buildDescription(race);
  const openGraphImages = race.thumbnailUrl
    ? [{ url: race.thumbnailUrl, alt: race.name }]
    : [DEFAULT_SOCIAL_IMAGE];
  const twitterImages = race.thumbnailUrl ? [race.thumbnailUrl] : [DEFAULT_SOCIAL_IMAGE_PATH];
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: new URL(canonicalPath, SITE_URL),
      type: "website",
      images: openGraphImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: twitterImages,
    },
  };
}

export default async function RacePage({ params }: PageProps) {
  const resolution = await resolvePublicRaceSlug(params.slug);
  if (!resolution) notFound();
  if (resolution.shouldRedirect) permanentRedirect(`/courses/${resolution.race.slug}`);

  const [detail, races] = await Promise.all([getPublicRaceDetail(resolution.race), getPublicRaces()]);
  if (!detail) notFound();

  const race = detail;
  const formattedDate = formatDate(race.date);
  const formattedEndDate = race.eventEndDate && race.eventEndDate !== race.date ? formatDate(race.eventEndDate) : null;
  const canonicalUrl = new URL(`/courses/${race.slug}`, SITE_URL).toString();
  const otherFormats = getOtherEventFormats(race, races);
  const similarRaces = getSimilarRaces(race, races);
  const heroImage = race.raceThumbnailUrl ?? race.eventThumbnailUrl;
  const officialUrls = Array.from(
    new Set([race.externalSiteUrl, race.officialWebsiteUrl].filter((value): value is string => Boolean(value))),
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: race.name,
    url: canonicalUrl,
    startDate: race.date ?? undefined,
    endDate: race.eventEndDate ?? undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: heroImage ? [heroImage] : undefined,
    location: race.location ? { "@type": "Place", name: race.location } : undefined,
    description: buildDescription(race),
    sameAs: [...officialUrls, race.instagramUrl, race.facebookUrl].filter(Boolean),
  };
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: new URL("/courses", SITE_URL).toString() },
      { "@type": "ListItem", position: 3, name: race.name, item: canonicalUrl },
    ],
  };

  const schedule = race.practical.schedule;
  const bib = race.practical.bibPickup;
  const access = race.practical.access;
  const runnerInfo = race.practical.runnerInfo;
  const services = race.practical.services;
  const hasSchedule = hasText(schedule.startTime, schedule.finishCutoffTime, schedule.cutoffNote, schedule.note);
  const hasBib = bib.locations.length > 0 || hasText(bib.schedule, bib.requiredDocuments, bib.note) || bib.thirdPartyPickupAllowed !== null || bib.equipmentCheck !== null;
  const hasAccess = hasText(
    access.startAddress,
    access.startLocation.label,
    access.finishAddress,
    access.finishLocation.label,
    access.officialParkings,
    access.shuttles,
    access.shuttleSchedule,
    access.roadRestrictions,
    access.note,
  ) || Boolean(access.mapUrl);
  const hasRunnerInfo = hasText(runnerInfo.startArea, runnerInfo.briefing, runnerInfo.rules, runnerInfo.note);
  const hasServices = hasText(services.supporters, services.accommodations, services.restaurants, services.recovery, services.partners, services.note);
  const hasEquipment = race.practical.equipment.items.length > 0 || Boolean(race.practical.equipment.note);
  const hasPractical = hasSchedule || hasBib || hasEquipment || hasAccess || hasRunnerInfo || hasServices;
  const hasEssentialPractical = hasSchedule || hasAccess || hasBib;
  const hasComplementaryPractical = hasEquipment || hasServices || hasRunnerInfo;
  const daysUntilRace = race.date ? Math.ceil((new Date(`${race.date.slice(0, 10)}T00:00:00Z`).getTime() - Date.now()) / 86_400_000) : null;
  const bibPickupOpenByDefault = daysUntilRace !== null && daysUntilRace >= 0 && daysUntilRace <= 14;
  const scheduleSummary = [
    schedule.startTime ? `Départ ${schedule.startTime}` : null,
    schedule.finishCutoffTime ? `Barrière ${schedule.finishCutoffTime}` : null,
  ].filter(Boolean).join(" · ") || null;
  const accessSummary = access.startAddress ?? access.startLocation.label ?? null;
  const bibSummary = bib.locations.length ? `${bib.locations.length} point${bib.locations.length > 1 ? "s" : ""} de retrait` : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-9 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />

      <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:text-brand hover:underline" href="/">Accueil</Link>
        <span aria-hidden="true">/</span>
        <Link className="hover:text-brand hover:underline" href={"/courses" as Route}>Courses</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="truncate text-foreground">{race.name}</span>
      </nav>

      <RaceHeroSummary race={race} formattedDate={formattedDate} formattedEndDate={formattedEndDate} canonicalUrl={canonicalUrl} otherFormats={otherFormats} />

      <RaceMetricsDetails race={race} />

      <nav aria-label="Navigation rapide" className="flex flex-wrap gap-4 text-sm font-semibold text-brand lg:hidden">
        <a className="scroll-mt-4 hover:underline" href="#route">Parcours</a>
        <a className="scroll-mt-4 hover:underline" href="#ravitos">Ravitos</a>
        <a className="scroll-mt-4 hover:underline" href="#infos-pratiques">Infos</a>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-9 lg:col-span-2">
          <section id="route" className="scroll-mt-4 space-y-5" aria-labelledby="course-route-heading">
            <div className="space-y-2">
              <h2 id="course-route-heading" className="text-2xl font-semibold text-foreground">Parcours et profil altimétrique</h2>
              <p className="text-muted-foreground">Visualisez le tracé disponible et les principaux repères d’altitude.</p>
            </div>
            {race.routePreview?.points.length ? (
              <div className="space-y-5">
                <RaceRouteExplorer
                  points={race.routePreview.points.map((point) => ({ ...point, elevationM: point.elevationM ?? 0 }))}
                  aidStations={race.aidStations.map((station) => ({ name: station.name, distanceKm: station.distanceKm }))}
                  heightClassName="h-72 sm:h-96"
                />
                <PublicElevationProfile points={race.routePreview.points} aidStations={race.aidStations} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Le tracé GPX de cette course n’est pas encore disponible.</p>
            )}
          </section>

          {race.aidStations.length ? (
            <section id="ravitos" className="scroll-mt-4 space-y-4" aria-labelledby="aid-stations-heading">
              <div>
                <h2 id="aid-stations-heading" className="text-2xl font-semibold text-foreground">Ravitaillements</h2>
                <p className="mt-1 text-muted-foreground">{race.aidStations.length} point{race.aidStations.length > 1 ? "s" : ""} renseigné{race.aidStations.length > 1 ? "s" : ""}.</p>
              </div>
              <RaceAidStationsTimeline aidStations={race.aidStations} totalDistanceKm={race.distanceKm} />
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:col-span-1 lg:self-start">
          <Card>
            <CardContent className="space-y-3 py-6">
              <h2 className="text-lg font-semibold text-foreground">Informations clés</h2>
              {schedule.startTime ? <DetailLine label="Départ" value={schedule.startTime} /> : null}
              {schedule.finishCutoffTime ? <DetailLine label="Barrière" value={schedule.finishCutoffTime} /> : null}
              {race.location ? <DetailLine label="Lieu" value={race.location} /> : null}
              {officialUrls[0] ? (
                <a href={officialUrls[0]} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">
                  Site officiel
                </a>
              ) : null}
              <Link
                href={`/race-planner?catalogRaceId=${race.id}` as Route}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
              >
                Planifier cette course
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>

      {hasPractical ? (
        <section id="infos-pratiques" className="scroll-mt-4 space-y-4" aria-labelledby="practical-heading">
          <h2 id="practical-heading" className="text-2xl font-semibold text-foreground">Informations pratiques</h2>
          <div className="rounded-xl border border-border bg-card px-5">
            {hasEssentialPractical ? (
              <p className="pt-5 text-xs font-semibold uppercase tracking-wide text-brand">Essentiel pour courir</p>
            ) : null}
            {hasSchedule ? (
              <AccordionItem title="Horaires et barrières" icon={<ClockIcon />} summary={scheduleSummary} defaultOpen>
                {schedule.startTime ? <DetailLine label="Départ" value={schedule.startTime} /> : null}
                {schedule.finishCutoffTime ? <DetailLine label="Heure limite d’arrivée" value={schedule.finishCutoffTime} /> : null}
                {schedule.cutoffNote ? <p>{schedule.cutoffNote}</p> : null}
                {schedule.note ? <p>{schedule.note}</p> : null}
              </AccordionItem>
            ) : null}
            {hasAccess ? (
              <AccordionItem title="Accès et stationnement" icon={<MapPinIcon />} summary={accessSummary} defaultOpen>
                {access.startAddress || access.startLocation.label ? <DetailLine label="Départ" value={access.startAddress ?? access.startLocation.label} /> : null}
                {access.startLocation.googleMapsUrl ? <MapLink href={access.startLocation.googleMapsUrl}>Itinéraire vers le départ</MapLink> : null}
                {access.finishAddress || access.finishLocation.label ? <DetailLine label="Arrivée" value={access.finishAddress ?? access.finishLocation.label} /> : null}
                {access.finishLocation.googleMapsUrl ? <MapLink href={access.finishLocation.googleMapsUrl}>Itinéraire vers l’arrivée</MapLink> : null}
                {access.officialParkings ? <DetailLine label="Parkings" value={access.officialParkings} /> : null}
                {access.shuttles ? <DetailLine label="Navettes" value={access.shuttles} /> : null}
                {access.shuttleSchedule ? <DetailLine label="Horaires des navettes" value={access.shuttleSchedule} /> : null}
                {access.roadRestrictions ? <DetailLine label="Restrictions" value={access.roadRestrictions} /> : null}
                {access.mapUrl ? <MapLink href={access.mapUrl}>Carte officielle d’accès</MapLink> : null}
                {access.note ? <p>{access.note}</p> : null}
              </AccordionItem>
            ) : null}
            {hasBib ? (
              <AccordionItem title="Retrait des dossards" icon={<TicketIcon />} summary={bibSummary} defaultOpen={bibPickupOpenByDefault}>
                {bib.locations.map((location, index) => (
                  <div key={`${location.label}-${index}`} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
                    {location.label || location.location.label ? <p className="font-semibold text-foreground">{location.label ?? location.location.label}</p> : null}
                    {location.slots.map((slot, slotIndex) => <p key={slotIndex}>{[formatDate(slot.date), [slot.startTime, slot.endTime].filter(Boolean).join(" – ")].filter(Boolean).join(" · ")}</p>)}
                    {location.location.googleMapsUrl ? <MapLink href={location.location.googleMapsUrl}>Voir sur la carte</MapLink> : null}
                  </div>
                ))}
                {bib.schedule ? <p>{bib.schedule}</p> : null}
                {bib.requiredDocuments ? <DetailLine label="Documents" value={bib.requiredDocuments} /> : null}
                {bib.thirdPartyPickupAllowed !== null ? (
                  <p>
                    <span className="font-semibold text-foreground">Retrait par un tiers :</span>{" "}
                    <StatusBadge positive={bib.thirdPartyPickupAllowed} label={bib.thirdPartyPickupAllowed ? "Autorisé" : "Non autorisé"} />
                  </p>
                ) : null}
                {bib.equipmentCheck !== null ? (
                  <p>
                    <span className="font-semibold text-foreground">Contrôle du matériel :</span>{" "}
                    <StatusBadge positive={bib.equipmentCheck} label={bib.equipmentCheck ? "Prévu" : "Non indiqué"} />
                  </p>
                ) : null}
                {bib.note ? <p>{bib.note}</p> : null}
              </AccordionItem>
            ) : null}
            {hasComplementaryPractical ? (
              <p className="pt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informations complémentaires</p>
            ) : null}
            {hasEquipment ? (
              <AccordionItem title="Matériel" icon={<BackpackIcon />}>
                {race.practical.equipment.items.length ? (
                  <ul className="space-y-2">
                    {race.practical.equipment.items.map((item, index) => (
                      <li key={`${item.label}-${index}`} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                        <span>
                          <span className="block font-semibold text-foreground">{item.label}</span>
                          {item.note ? <span className="block text-muted-foreground">{item.note}</span> : null}
                        </span>
                        <RequirementBadge required={item.required} />
                      </li>
                    ))}
                  </ul>
                ) : null}
                {race.practical.equipment.note ? <p>{race.practical.equipment.note}</p> : null}
              </AccordionItem>
            ) : null}
            {hasServices ? (
              <AccordionItem title="Services" icon={<UsersIcon />}>
                {services.supporters ? <DetailLine label="Accompagnants" value={services.supporters} /> : null}
                {services.accommodations ? <DetailLine label="Hébergements" value={services.accommodations} /> : null}
                {services.restaurants ? <DetailLine label="Restauration" value={services.restaurants} /> : null}
                {services.recovery ? <DetailLine label="Récupération" value={services.recovery} /> : null}
                {services.partners ? <DetailLine label="Partenaires" value={services.partners} /> : null}
                {services.note ? <p>{services.note}</p> : null}
              </AccordionItem>
            ) : null}
            {hasRunnerInfo ? (
              <AccordionItem title="Consignes coureur" icon={<InfoIcon />}>
                {runnerInfo.startArea ? <DetailLine label="Zone de départ" value={runnerInfo.startArea} /> : null}
                {runnerInfo.briefing ? <DetailLine label="Briefing" value={runnerInfo.briefing} /> : null}
                {runnerInfo.rules ? <DetailLine label="Règlement" value={runnerInfo.rules} /> : null}
                {runnerInfo.note ? <p>{runnerInfo.note}</p> : null}
              </AccordionItem>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 py-7">
            <h2 className="text-2xl font-semibold text-foreground">Préparer cette course</h2>
            <p className="leading-7 text-muted-foreground">Construisez une stratégie d’allure, d’hydratation et de ravitaillement adaptée à ce parcours.</p>
            <Link href={`/race-planner?catalogRaceId=${race.id}` as Route} className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light">Planifier cette course</Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 py-7">
            <h2 className="text-2xl font-semibold text-foreground">Estimer mes glucides</h2>
            <p className="leading-7 text-muted-foreground">Obtenez un premier objectif de glucides par heure à tester pendant vos entraînements.</p>
            <Link href={"/calculateur-glucides-trail" as Route} className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface">Ouvrir le calculateur</Link>
          </CardContent>
        </Card>
      </section>

      {otherFormats.length || similarRaces.length ? (
        <section className="space-y-8 rounded-2xl bg-muted/60 p-6 sm:p-8" aria-labelledby="discover-more-heading">
          <div className="space-y-2">
            <h2 id="discover-more-heading" className="text-2xl font-semibold text-foreground">Autres courses à découvrir</h2>
            <p className="text-muted-foreground">Ces suggestions ne font pas partie des informations de cette course : elles vous aident à comparer et explorer d’autres options.</p>
          </div>
          {otherFormats.length ? (
            <div className="space-y-3" aria-labelledby="other-formats-heading">
              <h3 id="other-formats-heading" className="text-lg font-semibold text-foreground">Autres formats de cette édition</h3>
              <RaceLinksCarousel races={otherFormats} />
            </div>
          ) : null}
          {similarRaces.length ? (
            <div className="space-y-3" aria-labelledby="similar-races-heading">
              <h3 id="similar-races-heading" className="text-lg font-semibold text-foreground">Courses de distance similaire</h3>
              <RaceLinksCarousel races={similarRaces} />
            </div>
          ) : null}
        </section>
      ) : null}

      {officialUrls.length || race.instagramUrl || race.facebookUrl ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-6" aria-labelledby="official-links-heading">
          <h2 id="official-links-heading" className="text-2xl font-semibold text-foreground">Liens officiels</h2>
          <p className="text-sm leading-6 text-muted-foreground">Vérifiez toujours les horaires, le parcours et le règlement définitifs auprès de l’organisation.</p>
          <div className="flex flex-wrap gap-2">
            {officialUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold text-brand hover:bg-brand-surface">{index === 0 && race.externalSiteUrl ? "Site du format" : "Site de l’événement"}</a>)}
            {race.instagramUrl ? <a href={race.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold text-brand hover:bg-brand-surface">Instagram officiel</a> : null}
            {race.facebookUrl ? <a href={race.facebookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold text-brand hover:bg-brand-surface">Facebook officiel</a> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
