import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { getFormatLabelWithinEvent } from "../../_components/catalog-display";
import { PublicHeroShell } from "../../_components/PublicHeroShell";
import { RunnerAppBridge } from "../../_components/RunnerAppBridge";
import { resolvePublicRaceEventEditionSlug } from "../../../../lib/public-race-events";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../../../seo";
import { buildEventEditionDescription, buildEventEditionStructuredData } from "./event-structured-data";
import { isEventEditionPast } from "./event-edition-status";

export const revalidate = 900;
export const dynamicParams = true;

type PageProps = { params: { slug: string } };

const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

const formatDate = (value: string) => fullDateFormatter.format(new Date(`${value}T12:00:00Z`));

const formatDateRange = (startDate: string, endDate: string) => (
  startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} – ${formatDate(endDate)}`
);

const hasText = (...values: Array<string | null | undefined>) => values.some((value) => Boolean(value?.trim()));

const isHttpUrl = (value: string | null): value is string => Boolean(value && /^https?:\/\//i.test(value));

const StopwatchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="h-5 w-5 shrink-0">
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5V6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolution = await resolvePublicRaceEventEditionSlug(params.slug);
  if (!resolution) return { title: "Événement introuvable", robots: { index: false, follow: false } };
  const { edition } = resolution;
  const canonicalPath = `/courses/evenements/${edition.slug}`;
  const title = `${edition.eventName} ${edition.editionYear} : formats, parcours et ravitos`;
  const description = buildEventEditionDescription(edition);
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: new URL(canonicalPath, SITE_URL),
      type: "website",
      images: edition.thumbnailUrl ? [{ url: edition.thumbnailUrl, alt: edition.eventName }] : [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: edition.thumbnailUrl ? [edition.thumbnailUrl] : [DEFAULT_SOCIAL_IMAGE_PATH],
    },
  };
}

export default async function PublicEventEditionPage({ params }: PageProps) {
  const resolution = await resolvePublicRaceEventEditionSlug(params.slug);
  if (!resolution) notFound();
  if (resolution.shouldRedirect) permanentRedirect(`/courses/evenements/${resolution.edition.slug}`);

  const { edition } = resolution;
  const canonicalUrl = new URL(`/courses/evenements/${edition.slug}`, SITE_URL).toString();
  const structuredData = buildEventEditionStructuredData(edition, canonicalUrl);
  const editionIsPast = isEventEditionPast(edition.endDate);
  const editionTitle = `${edition.eventName} ${edition.editionYear}`;
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: new URL("/courses", SITE_URL).toString() },
      { "@type": "ListItem", position: 3, name: editionTitle, item: canonicalUrl },
    ],
  };
  const practical = edition.commonPractical;
  const bib = practical?.bibPickup;
  const access = practical?.access;
  const hasBib = Boolean(bib && (bib.locations.length || hasText(bib.schedule, bib.requiredDocuments, bib.thirdPartyPickupConditions, bib.note)));
  const hasAccess = Boolean(access && hasText(
    access.startAddress,
    access.startLocation.label,
    access.finishAddress,
    access.finishLocation.label,
    access.officialParkings,
    access.shuttles,
    access.shuttleSchedule,
    access.roadRestrictions,
    access.note,
  ));

  // Same order as the catalog: numeric distance, unknown distances last.
  const formats = [...edition.formats].sort((left, right) => (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY));
  const distances = edition.formats
    .map((format) => format.distanceKm)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const maxGain = edition.formats.reduce<number | null>(
    (max, format) => (format.elevationGainM !== null && (max === null || format.elevationGainM > max) ? format.elevationGainM : max),
    null,
  );
  const dayCount = Math.round((Date.parse(`${edition.endDate}T12:00:00Z`) - Date.parse(`${edition.startDate}T12:00:00Z`)) / 86_400_000) + 1;
  const metrics = [
    { label: "Formats", value: String(edition.formats.length) },
    distances.length
      ? {
          label: "Distances",
          value: distances.length > 1
            ? `${distances[0].toLocaleString("fr-FR")}–${distances.at(-1)?.toLocaleString("fr-FR")} km`
            : `${distances[0].toLocaleString("fr-FR")} km`,
        }
      : null,
    maxGain !== null ? { label: "D+ max", value: `${Math.round(maxGain).toLocaleString("fr-FR")} m` } : null,
    Number.isFinite(dayCount) && dayCount > 1 ? { label: "Jours", value: String(dayCount) } : null,
  ].filter((metric): metric is { label: string; value: string } => Boolean(metric));
  const registrationUrl = isHttpUrl(edition.websiteUrl) ? edition.websiteUrl : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10 sm:space-y-8 sm:px-0 lg:px-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />

      <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
        <Link href="/" className="shrink-0 hover:text-brand hover:underline">Accueil</Link>
        <span aria-hidden="true">/</span>
        <Link href={"/courses" as Route} className="shrink-0 hover:text-brand hover:underline">Courses</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="truncate text-foreground">{editionTitle}</span>
      </nav>

      {editionIsPast ? (
        <aside className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="past-edition-heading">
          <div>
            <h2 id="past-edition-heading" className="font-semibold">Édition terminée</h2>
            <p className="text-sm">Cette édition s’est terminée le {formatDate(edition.endDate)}.</p>
          </div>
          {edition.nextEdition ? (
            <Link href={`/courses/evenements/${edition.nextEdition.slug}` as Route} className="inline-flex min-h-11 shrink-0 items-center font-semibold underline underline-offset-4">
              Voir l’édition {edition.nextEdition.editionYear}
            </Link>
          ) : null}
        </aside>
      ) : null}

      <PublicHeroShell
        imageUrl={edition.thumbnailUrl}
        eyebrow={`Édition ${edition.editionYear}`}
        title={edition.eventName}
        share={{ title: editionTitle, url: canonicalUrl }}
        metrics={metrics}
        meta={(
          <>
            <span>{formatDateRange(edition.startDate, edition.endDate)}</span>
            {edition.location ? <><span aria-hidden="true">·</span><span>{edition.location}</span></> : null}
          </>
        )}
      >
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <a
            href="#formats"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-base font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-light"
          >
            <StopwatchIcon />
            Estimer mon temps
          </a>
          {registrationUrl ? (
            <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface">
              S’inscrire sur le site officiel
            </a>
          ) : null}
        </div>
      </PublicHeroShell>

      {!editionIsPast && edition.nextEdition ? (
        <aside className="flex flex-col gap-2 rounded-2xl border border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="next-edition-heading">
          <div>
            <h2 id="next-edition-heading" className="font-semibold text-foreground">Prochaine édition déjà publiée</h2>
            <p className="text-sm text-muted-foreground">{formatDateRange(edition.nextEdition.startDate, edition.nextEdition.endDate)}</p>
          </div>
          <Link href={`/courses/evenements/${edition.nextEdition.slug}` as Route} className="inline-flex min-h-11 shrink-0 items-center font-semibold text-brand hover:underline">
            Découvrir l’édition {edition.nextEdition.editionYear}
          </Link>
        </aside>
      ) : null}

      <section id="formats" className="scroll-mt-4 space-y-3" aria-labelledby="formats-heading">
        <h2 id="formats-heading" className="text-xl font-bold text-foreground sm:text-2xl">Choisis ton format</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {formats.map((format) => {
            const facts = [
              format.elevationGainM !== null ? `${Math.round(format.elevationGainM).toLocaleString("fr-FR")} m D+` : null,
              format.date ? shortDateFormatter.format(new Date(`${format.date.slice(0, 10)}T12:00:00Z`)) : null,
              format.aidStationCount ? `${format.aidStationCount} ravito${format.aidStationCount > 1 ? "s" : ""}` : null,
            ].filter(Boolean);
            return (
              <li key={format.id} className="flex items-stretch">
                <Link href={`/courses/${format.slug}` as Route} className="group flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 transition hover:bg-brand-surface/60">
                  <span className="flex h-12 min-w-[3.5rem] shrink-0 flex-col items-center justify-center rounded-xl bg-brand px-2 text-brand-foreground">
                    <span className="text-base font-bold leading-none tabular-nums">{format.distanceKm !== null ? format.distanceKm.toLocaleString("fr-FR") : "?"}</span>
                    <span className="text-[10px] font-semibold uppercase leading-none opacity-80">km</span>
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 font-semibold leading-snug text-foreground group-hover:text-brand" title={format.name}>{getFormatLabelWithinEvent(format.name, edition.eventName)}</span>
                    <span className="block truncate text-sm text-muted-foreground">{facts.length ? facts.join(" · ") : "Détails à confirmer"}</span>
                  </span>
                </Link>
                <Link
                  href={`/race-planner?catalogRaceId=${format.id}` as Route}
                  aria-label={`Estimer mon temps sur ${format.name}`}
                  title="Estimer mon temps"
                  className="flex w-14 shrink-0 items-center justify-center border-l border-border text-brand transition hover:bg-brand-surface"
                >
                  <StopwatchIcon />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">Le chronomètre calcule gratuitement ton temps et tes passages aux ravitos sur le format choisi.</p>
      </section>

      {hasAccess || hasBib ? (
        <section className="space-y-3" aria-labelledby="common-info-heading">
          <h2 id="common-info-heading" className="text-xl font-bold text-foreground sm:text-2xl">Informations communes</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {hasAccess && access ? (
              <article className="rounded-2xl border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground">Accès</h3>
                <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {access.startAddress || access.startLocation.label ? <p><strong className="text-foreground">Départ :</strong> {access.startAddress ?? access.startLocation.label}</p> : null}
                  {access.finishAddress || access.finishLocation.label ? <p><strong className="text-foreground">Arrivée :</strong> {access.finishAddress ?? access.finishLocation.label}</p> : null}
                  {access.officialParkings ? <p><strong className="text-foreground">Parkings :</strong> {access.officialParkings}</p> : null}
                  {access.shuttles ? <p><strong className="text-foreground">Navettes :</strong> {access.shuttles}</p> : null}
                  {access.roadRestrictions ? <p>{access.roadRestrictions}</p> : null}
                </div>
              </article>
            ) : null}
            {hasBib && bib ? (
              <article className="rounded-2xl border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground">Retrait des dossards</h3>
                <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {bib.locations.map((location, index) => <p key={`${location.label}-${index}`}>{location.label ?? "Lieu communiqué par l’organisation"}</p>)}
                  {bib.schedule ? <p>{bib.schedule}</p> : null}
                  {bib.requiredDocuments ? <p><strong className="text-foreground">Documents :</strong> {bib.requiredDocuments}</p> : null}
                  {bib.note ? <p>{bib.note}</p> : null}
                </div>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      <RunnerAppBridge courseName={editionTitle} universalUrl={canonicalUrl} racebookAvailable={false} />

      <section className="space-y-2" aria-labelledby="event-overview-heading">
        <h2 id="event-overview-heading" className="text-xl font-bold text-foreground sm:text-2xl">À propos de {editionTitle}</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{buildEventEditionDescription(edition)}</p>
        {registrationUrl ? (
          <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">
            Site officiel de l’événement
          </a>
        ) : null}
      </section>
    </div>
  );
}
