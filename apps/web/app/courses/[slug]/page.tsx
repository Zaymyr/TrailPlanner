import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import React from "react";

import { Card, CardContent } from "../../../components/ui/card";
import { GpxRouteMap } from "../../../components/gpx/GpxRouteMap";
import { getPublicRaceDetail } from "../../../lib/public-race-detail";
import type { PublicRace } from "../../../lib/public-races";
import { getPublicRaces, resolvePublicRaceSlug } from "../../../lib/public-races";
import { getOtherEventFormats, getSimilarRaces } from "../../../lib/race-discovery";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../../seo";
import { PublicElevationProfile } from "../_components/PublicElevationProfile";
import { PublicRaceLinks } from "../_components/PublicRaceLinks";
import { PublicRaceShare } from "../_components/PublicRaceShare";
import { buildRaceMetadataDescription, buildRaceMetadataTitle, formatPublicRaceDate } from "./race-metadata";

export const revalidate = 3600;

type PageProps = { params: { slug: string } };

const formatDate = formatPublicRaceDate;

const formatMetric = (value: number | null, suffix: string) =>
  value === null ? "À confirmer" : `${Math.round(value).toLocaleString("fr-FR")} ${suffix}`;

const hasText = (...values: Array<string | null | undefined>) => values.some((value) => Boolean(value?.trim()));

const buildDescription = buildRaceMetadataDescription;

const InfoCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="h-full">
    <CardContent className="space-y-3 py-6">
      <h3 className="text-xl font-semibold text-foreground">{title}</h3>
      <div className="space-y-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </CardContent>
  </Card>
);

const DetailLine = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <p>
    <span className="font-semibold text-foreground">{label} :</span> {value}
  </p>
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

  return (
    <main className="mx-auto w-full max-w-6xl space-y-9 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />

      <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:text-brand hover:underline" href="/">Accueil</Link>
        <span aria-hidden="true">/</span>
        <Link className="hover:text-brand hover:underline" href={"/courses" as Route}>Courses</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="truncate text-foreground">{race.name}</span>
      </nav>

      <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {heroImage && /^https?:\/\//i.test(heroImage) ? (
          <img src={heroImage} alt={race.name} className="h-56 w-full object-cover sm:h-80 lg:h-96" />
        ) : null}
        <div className="space-y-5 p-5 sm:p-8">
          {race.eventName && race.eventName !== race.name ? (
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">{race.eventName}</p>
          ) : null}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">{race.name}</h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              {[formattedDate && formattedEndDate ? `Du ${formattedDate} au ${formattedEndDate}` : formattedDate, race.location]
                .filter(Boolean)
                .join(" · ") || "Informations à confirmer"}
            </p>
            {race.participationMode ? (
              <p className="inline-flex rounded-full bg-brand-surface px-3 py-1 text-sm font-semibold text-brand">
                {race.participationMode === "solo" ? "Solo" : race.participationMode === "relay" ? "Relais" : "Solo et relais"}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section aria-labelledby="metrics-heading" className="space-y-4">
        <h2 id="metrics-heading" className="sr-only">Chiffres clés</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["Distance", race.distanceKm === null ? "À confirmer" : `${race.distanceKm} km`],
            ["Dénivelé positif", formatMetric(race.elevationGainM, "m D+")],
            ["Dénivelé négatif", formatMetric(race.elevationLossM, "m D−")],
            ["Altitude minimale", formatMetric(race.minAltitudeM, "m")],
            ["Altitude maximale", formatMetric(race.maxAltitudeM, "m")],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-xl font-bold text-foreground sm:text-2xl">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="share-heading" className="space-y-3">
        <h2 id="share-heading" className="text-xl font-semibold text-foreground">Partager cette course</h2>
        <PublicRaceShare title={race.name} url={canonicalUrl} />
      </section>

      <section className="space-y-5" aria-labelledby="course-route-heading">
        <div className="space-y-2">
          <h2 id="course-route-heading" className="text-2xl font-semibold text-foreground">Parcours et profil altimétrique</h2>
          <p className="text-muted-foreground">Visualisez le tracé disponible et les principaux repères d’altitude.</p>
        </div>
        {race.routePreview?.points.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <GpxRouteMap
              points={race.routePreview.points.map((point) => ({ ...point, elevationM: point.elevationM ?? 0 }))}
              aidStations={race.aidStations.map((station) => ({ name: station.name, distanceKm: station.distanceKm }))}
              heightClassName="h-72 sm:h-96"
            />
            <PublicElevationProfile points={race.routePreview.points} aidStations={race.aidStations} />
          </div>
        ) : (
          <Card><CardContent className="py-7 text-muted-foreground">Le tracé GPX de cette course n’est pas encore disponible.</CardContent></Card>
        )}
      </section>

      {hasSchedule ? (
        <section className="space-y-4" aria-labelledby="schedule-heading">
          <h2 id="schedule-heading" className="text-2xl font-semibold text-foreground">Horaires de course</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {schedule.startTime ? <InfoCard title="Départ"><DetailLine label="Heure" value={schedule.startTime} /></InfoCard> : null}
            {schedule.finishCutoffTime || schedule.cutoffNote || schedule.note ? (
              <InfoCard title="Arrivée et barrières">
                {schedule.finishCutoffTime ? <DetailLine label="Heure limite" value={schedule.finishCutoffTime} /> : null}
                {schedule.cutoffNote ? <p>{schedule.cutoffNote}</p> : null}
                {schedule.note ? <p>{schedule.note}</p> : null}
              </InfoCard>
            ) : null}
          </div>
        </section>
      ) : null}

      {race.aidStations.length ? (
        <section className="space-y-4" aria-labelledby="aid-stations-heading">
          <div>
            <h2 id="aid-stations-heading" className="text-2xl font-semibold text-foreground">Ravitaillements</h2>
            <p className="mt-1 text-muted-foreground">{race.aidStations.length} point{race.aidStations.length > 1 ? "s" : ""} renseigné{race.aidStations.length > 1 ? "s" : ""}.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {race.aidStations.map((station) => (
              <InfoCard key={station.id} title={station.name}>
                <DetailLine label="Distance" value={`${station.distanceKm.toLocaleString("fr-FR")} km`} />
                {station.altitudeM !== null ? <DetailLine label="Altitude" value={`${Math.round(station.altitudeM)} m`} /> : null}
                {station.cumulativeElevationGainM !== null ? <DetailLine label="D+ cumulé" value={`${Math.round(station.cumulativeElevationGainM)} m`} /> : null}
                {station.cumulativeElevationLossM !== null ? <DetailLine label="D− cumulé" value={`${Math.round(station.cumulativeElevationLossM)} m`} /> : null}
                {station.cutoffTime ? <DetailLine label="Barrière horaire" value={station.cutoffTime} /> : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {station.waterAvailable ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Eau</span> : null}
                  {station.solidAvailable ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Solide</span> : null}
                  {station.assistanceAllowed ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Assistance</span> : null}
                  {station.dropBagAvailable ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">Sac d’allègement</span> : null}
                </div>
                {station.note ? <p>{station.note}</p> : null}
              </InfoCard>
            ))}
          </div>
        </section>
      ) : null}

      {hasBib || race.practical.equipment.items.length > 0 || race.practical.equipment.note || hasAccess || hasRunnerInfo || hasServices ? (
        <section className="space-y-4" aria-labelledby="practical-heading">
          <h2 id="practical-heading" className="text-2xl font-semibold text-foreground">Informations pratiques</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {hasBib ? (
              <InfoCard title="Retrait des dossards">
                {bib.locations.map((location, index) => (
                  <div key={`${location.label}-${index}`} className="space-y-1 border-b border-border pb-3 last:border-0 last:pb-0">
                    {location.label || location.location.label ? <p className="font-semibold text-foreground">{location.label ?? location.location.label}</p> : null}
                    {location.location.googleMapsUrl ? <a href={location.location.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">Voir sur la carte</a> : null}
                    {location.slots.map((slot, slotIndex) => <p key={slotIndex}>{[formatDate(slot.date), [slot.startTime, slot.endTime].filter(Boolean).join(" – ")].filter(Boolean).join(" · ")}</p>)}
                  </div>
                ))}
                {bib.schedule ? <p>{bib.schedule}</p> : null}
                {bib.requiredDocuments ? <DetailLine label="Documents" value={bib.requiredDocuments} /> : null}
                {bib.thirdPartyPickupAllowed !== null ? <DetailLine label="Retrait par un tiers" value={bib.thirdPartyPickupAllowed ? "Autorisé" : "Non autorisé"} /> : null}
                {bib.equipmentCheck !== null ? <DetailLine label="Contrôle du matériel" value={bib.equipmentCheck ? "Prévu" : "Non indiqué"} /> : null}
                {bib.note ? <p>{bib.note}</p> : null}
              </InfoCard>
            ) : null}
            {race.practical.equipment.items.length > 0 || race.practical.equipment.note ? (
              <InfoCard title="Matériel">
                {race.practical.equipment.items.length ? (
                  <ul className="space-y-2">
                    {race.practical.equipment.items.map((item, index) => <li key={`${item.label}-${index}`}><span className="font-semibold text-foreground">{item.label}</span>{item.required ? " · obligatoire" : " · recommandé"}{item.note ? ` — ${item.note}` : ""}</li>)}
                  </ul>
                ) : null}
                {race.practical.equipment.note ? <p>{race.practical.equipment.note}</p> : null}
              </InfoCard>
            ) : null}
            {hasAccess ? (
              <InfoCard title="Accès">
                {access.startAddress || access.startLocation.label ? <DetailLine label="Départ" value={access.startAddress ?? access.startLocation.label} /> : null}
                {access.startLocation.googleMapsUrl ? <a href={access.startLocation.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">Itinéraire vers le départ</a> : null}
                {access.finishAddress || access.finishLocation.label ? <DetailLine label="Arrivée" value={access.finishAddress ?? access.finishLocation.label} /> : null}
                {access.finishLocation.googleMapsUrl ? <a href={access.finishLocation.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">Itinéraire vers l’arrivée</a> : null}
                {access.officialParkings ? <DetailLine label="Parkings" value={access.officialParkings} /> : null}
                {access.shuttles ? <DetailLine label="Navettes" value={access.shuttles} /> : null}
                {access.shuttleSchedule ? <DetailLine label="Horaires des navettes" value={access.shuttleSchedule} /> : null}
                {access.roadRestrictions ? <DetailLine label="Restrictions" value={access.roadRestrictions} /> : null}
                {access.mapUrl ? <a href={access.mapUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">Carte officielle d’accès</a> : null}
                {access.note ? <p>{access.note}</p> : null}
              </InfoCard>
            ) : null}
            {hasRunnerInfo ? (
              <InfoCard title="Consignes coureur">
                {runnerInfo.startArea ? <DetailLine label="Zone de départ" value={runnerInfo.startArea} /> : null}
                {runnerInfo.briefing ? <DetailLine label="Briefing" value={runnerInfo.briefing} /> : null}
                {runnerInfo.rules ? <DetailLine label="Règlement" value={runnerInfo.rules} /> : null}
                {runnerInfo.note ? <p>{runnerInfo.note}</p> : null}
              </InfoCard>
            ) : null}
            {hasServices ? (
              <InfoCard title="Services">
                {services.supporters ? <DetailLine label="Accompagnants" value={services.supporters} /> : null}
                {services.accommodations ? <DetailLine label="Hébergements" value={services.accommodations} /> : null}
                {services.restaurants ? <DetailLine label="Restauration" value={services.restaurants} /> : null}
                {services.recovery ? <DetailLine label="Récupération" value={services.recovery} /> : null}
                {services.partners ? <DetailLine label="Partenaires" value={services.partners} /> : null}
                {services.note ? <p>{services.note}</p> : null}
              </InfoCard>
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

      {otherFormats.length ? (
        <section className="space-y-5" aria-labelledby="other-formats-heading">
          <div className="space-y-2">
            <h2 id="other-formats-heading" className="text-2xl font-semibold text-foreground">Autres formats de cette édition</h2>
            <p className="text-muted-foreground">Comparez les distances publiées pour choisir le format adapté.</p>
          </div>
          <PublicRaceLinks races={otherFormats} />
        </section>
      ) : null}

      {similarRaces.length ? (
        <section className="space-y-5" aria-labelledby="similar-races-heading">
          <div className="space-y-2">
            <h2 id="similar-races-heading" className="text-2xl font-semibold text-foreground">Courses de distance similaire</h2>
            <p className="text-muted-foreground">Suggestions calculées à partir de la distance et, lorsqu’il est disponible, du dénivelé.</p>
          </div>
          <PublicRaceLinks races={similarRaces} />
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
    </main>
  );
}
