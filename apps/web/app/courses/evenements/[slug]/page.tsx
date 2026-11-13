import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

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

const formatDate = (value: string) => fullDateFormatter.format(new Date(`${value}T12:00:00Z`));

const formatDateRange = (startDate: string, endDate: string) => (
  startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} – ${formatDate(endDate)}`
);

const hasText = (...values: Array<string | null | undefined>) => values.some((value) => Boolean(value?.trim()));

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolution = await resolvePublicRaceEventEditionSlug(params.slug);
  if (!resolution) return { title: "Événement introuvable", robots: { index: false, follow: false } };
  const { edition } = resolution;
  const canonicalPath = `/courses/evenements/${edition.slug}`;
  const title = `${edition.eventName} ${edition.editionYear} : formats, dates et parcours | Pace Yourself`;
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
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: new URL("/courses", SITE_URL).toString() },
      { "@type": "ListItem", position: 3, name: `${edition.eventName} ${edition.editionYear}`, item: canonicalUrl },
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-9 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />

      <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-brand hover:underline">Accueil</Link>
        <span aria-hidden="true">/</span>
        <Link href={"/courses" as Route} className="hover:text-brand hover:underline">Courses</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-foreground">{edition.eventName} {edition.editionYear}</span>
      </nav>

      {editionIsPast ? (
        <aside className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950" aria-labelledby="past-edition-heading">
          <h2 id="past-edition-heading" className="text-lg font-semibold">Édition terminée</h2>
          <p className="mt-1">Cette édition s’est terminée le {formatDate(edition.endDate)}.</p>
          {edition.nextEdition ? (
            <Link href={`/courses/evenements/${edition.nextEdition.slug}` as Route} className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Voir l’édition {edition.nextEdition.editionYear}
            </Link>
          ) : null}
        </aside>
      ) : null}

      <header className={edition.thumbnailUrl ? "grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[minmax(0,1fr)_360px]" : "rounded-2xl border border-border bg-card p-6 sm:p-8"}>
        <div className={edition.thumbnailUrl ? "space-y-4 p-6 sm:p-8" : "space-y-4"}>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Édition {edition.editionYear}</p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{edition.eventName}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
            <span>{formatDateRange(edition.startDate, edition.endDate)}</span>
            {edition.location ? <span>{edition.location}</span> : null}
          </div>
          <p className="max-w-3xl leading-7 text-muted-foreground">{buildEventEditionDescription(edition)}</p>
          {edition.websiteUrl && /^https?:\/\//i.test(edition.websiteUrl) ? (
            <div className="flex flex-wrap gap-3">
              <a href={edition.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-light">S’inscrire</a>
              <a href={edition.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground hover:bg-brand-surface">Site officiel</a>
            </div>
          ) : null}
        </div>
        {edition.thumbnailUrl ? <img src={edition.thumbnailUrl} alt={edition.eventName} className="h-64 w-full object-cover lg:h-full" /> : null}
      </header>

      {!editionIsPast && edition.nextEdition ? (
        <aside className="flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-surface p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="next-edition-heading">
          <div>
            <h2 id="next-edition-heading" className="text-lg font-semibold text-foreground">Prochaine édition déjà publiée</h2>
            <p className="mt-1 text-sm text-muted-foreground">{formatDateRange(edition.nextEdition.startDate, edition.nextEdition.endDate)}</p>
          </div>
          <Link href={`/courses/evenements/${edition.nextEdition.slug}` as Route} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-brand-border px-4 text-sm font-semibold text-brand hover:bg-background">
            Découvrir l’édition {edition.nextEdition.editionYear}
          </Link>
        </aside>
      ) : null}

      <section className="space-y-4" aria-labelledby="formats-heading">
        <div>
          <h2 id="formats-heading" className="text-2xl font-semibold text-foreground">Formats et parcours</h2>
          <p className="mt-1 text-muted-foreground">{edition.formats.length} format{edition.formats.length > 1 ? "s" : ""} publié{edition.formats.length > 1 ? "s" : ""} pour cette édition.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {edition.formats.map((format) => (
            <article key={format.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground"><Link href={`/courses/${format.slug}` as Route} className="hover:text-brand hover:underline">{format.name}</Link></h3>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Distance</dt><dd className="font-semibold">{format.distanceKm !== null ? `${format.distanceKm.toLocaleString("fr-FR")} km` : "À confirmer"}</dd></div>
                <div><dt className="text-muted-foreground">Dénivelé</dt><dd className="font-semibold">{format.elevationGainM !== null ? `${Math.round(format.elevationGainM).toLocaleString("fr-FR")} m D+` : "À confirmer"}</dd></div>
                <div><dt className="text-muted-foreground">Date</dt><dd className="font-semibold">{format.date ? formatDate(format.date) : "À confirmer"}</dd></div>
                <div><dt className="text-muted-foreground">Ravitos</dt><dd className="font-semibold">{format.aidStationCount}</dd></div>
              </dl>
              <p className="mt-3 text-sm text-muted-foreground">{format.location ?? "Lieu de départ à confirmer"}</p>
              <Link href={`/courses/${format.slug}` as Route} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground hover:border-brand-border hover:bg-brand-surface">Voir la fiche</Link>
            </article>
          ))}
        </div>
      </section>

      {hasAccess || hasBib ? (
        <section className="space-y-4" aria-labelledby="common-info-heading">
          <h2 id="common-info-heading" className="text-2xl font-semibold text-foreground">Informations communes</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {hasAccess && access ? (
              <article className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">Accès</h3>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {access.startAddress || access.startLocation.label ? <p><strong className="text-foreground">Départ :</strong> {access.startAddress ?? access.startLocation.label}</p> : null}
                  {access.finishAddress || access.finishLocation.label ? <p><strong className="text-foreground">Arrivée :</strong> {access.finishAddress ?? access.finishLocation.label}</p> : null}
                  {access.officialParkings ? <p><strong className="text-foreground">Parkings :</strong> {access.officialParkings}</p> : null}
                  {access.shuttles ? <p><strong className="text-foreground">Navettes :</strong> {access.shuttles}</p> : null}
                  {access.roadRestrictions ? <p>{access.roadRestrictions}</p> : null}
                </div>
              </article>
            ) : null}
            {hasBib && bib ? (
              <article className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">Retrait des dossards</h3>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
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

      <RunnerAppBridge courseName={`${edition.eventName} ${edition.editionYear}`} universalUrl={canonicalUrl} racebookAvailable={false} />
    </div>
  );
}
