import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { isDemoRaceEventId } from "../../../../lib/demo-race";
import {
  resolvePublicRaceEventEditionSlug,
  resolvePublicRaceEventHubSlug,
  type PublicRaceEventEdition,
  type PublicRaceEventHub,
} from "../../../../lib/public-race-events";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../../../seo";
import { buildEventEditionMetadataTitle } from "../../[slug]/race-metadata";
import { EventEditionSections, formatEditionDate, formatEditionDateRange } from "./EventEditionSections";
import { buildEventHubDescription, buildEventHubMetadataTitle, getEventEditionCanonicalPath, getEventHubName } from "./event-hub";
import { buildEventEditionDescription, buildEventEditionStructuredData } from "./event-structured-data";
import { isEventEditionPast } from "./event-edition-status";

export const revalidate = 900;
export const dynamicParams = true;

type PageProps = { params: { slug: string } };

export async function generateStaticParams() {
  return [];
}

const socialMetadata = (title: string, description: string, canonicalPath: string, imageUrl: string | null, imageAlt: string) => ({
  openGraph: {
    title,
    description,
    url: new URL(canonicalPath, SITE_URL),
    type: "website" as const,
    images: imageUrl ? [{ url: imageUrl, alt: imageAlt }] : [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image" as const,
    title,
    description,
    images: imageUrl ? [imageUrl] : [DEFAULT_SOCIAL_IMAGE_PATH],
  },
});

/**
 * One namespace, two kinds of pages: `<edition-slug>` (a yearly edition, kept
 * reachable and canonicalized to its hub) and `<event-slug>` (the permanent,
 * indexable event hub). The database keeps both slug sets disjoint.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolution = await resolvePublicRaceEventEditionSlug(params.slug);
  if (resolution) {
    const { edition } = resolution;
    const title = buildEventEditionMetadataTitle(edition.eventName, edition.editionYear);
    const description = buildEventEditionDescription(edition);
    const canonicalPath = getEventEditionCanonicalPath(edition);
    return {
      title,
      description,
      alternates: { canonical: canonicalPath },
      // Trail TST demo: reachable from the printed QR codes, never indexed.
      ...(isDemoRaceEventId(edition.eventId) ? { robots: { index: false, follow: true } } : {}),
      ...socialMetadata(title, description, canonicalPath, edition.thumbnailUrl, edition.eventName),
    };
  }

  const hub = await resolvePublicRaceEventHubSlug(params.slug);
  if (!hub) return { title: "Événement introuvable", robots: { index: false, follow: false } };
  const featuredIsPast = isEventEditionPast(hub.featured.endDate);
  const title = buildEventHubMetadataTitle(hub, featuredIsPast ? null : hub.featured.editionYear);
  const description = buildEventHubDescription(hub, featuredIsPast);
  const canonicalPath = `/courses/evenements/${hub.slug}`;
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    ...(isDemoRaceEventId(hub.eventId) ? { robots: { index: false, follow: true } } : {}),
    ...socialMetadata(title, description, canonicalPath, hub.thumbnailUrl, hub.eventName),
  };
}

const JsonLd = ({ data }: { data: unknown }) => (
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
);

type Crumb = { name: string; href: string };

function Breadcrumb({ crumbs, current }: { crumbs: Crumb[]; current: string }) {
  return (
    <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="contents">
          <Link href={crumb.href as Route} className="shrink-0 hover:text-brand hover:underline">{crumb.name}</Link>
          <span aria-hidden="true">/</span>
        </span>
      ))}
      <span aria-current="page" className="truncate text-foreground">{current}</span>
    </nav>
  );
}

const breadcrumbStructuredData = (items: Array<{ name: string; url: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
});

async function EventEditionPage({ edition }: { edition: PublicRaceEventEdition }) {
  const editionUrl = new URL(`/courses/evenements/${edition.slug}`, SITE_URL).toString();
  const hubPath = edition.eventSlug ? `/courses/evenements/${edition.eventSlug}` : null;
  const hubName = getEventHubName(edition.eventName);
  const isDemo = isDemoRaceEventId(edition.eventId);
  // A demonstration event is not a real SportsEvent and its websites are placeholders.
  const structuredData = isDemo ? null : buildEventEditionStructuredData(edition, editionUrl);
  const editionIsPast = isEventEditionPast(edition.endDate);
  const editionTitle = `${edition.eventName} ${edition.editionYear}`;
  const crumbs: Crumb[] = [
    { name: "Accueil", href: "/" },
    { name: "Courses", href: "/courses" },
    ...(hubPath ? [{ name: hubName, href: hubPath }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10 sm:space-y-8 sm:px-0 lg:px-2">
      {structuredData ? <JsonLd data={structuredData} /> : null}
      <JsonLd data={breadcrumbStructuredData([
        ...crumbs.map((crumb) => ({ name: crumb.name, url: new URL(crumb.href, SITE_URL).toString() })),
        { name: editionTitle, url: editionUrl },
      ])} />

      <Breadcrumb crumbs={crumbs} current={hubPath ? `Édition ${edition.editionYear}` : editionTitle} />

      {editionIsPast ? (
        <aside className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="past-edition-heading">
          <div>
            <h2 id="past-edition-heading" className="font-semibold">Édition terminée</h2>
            <p className="text-sm">Cette édition s’est terminée le {formatEditionDate(edition.endDate)}.</p>
          </div>
          {edition.nextEdition ? (
            <Link href={`/courses/evenements/${edition.nextEdition.slug}` as Route} className="inline-flex min-h-11 shrink-0 items-center font-semibold underline underline-offset-4">
              Voir l’édition {edition.nextEdition.editionYear}
            </Link>
          ) : hubPath ? (
            <Link href={hubPath as Route} className="inline-flex min-h-11 shrink-0 items-center font-semibold underline underline-offset-4">
              Toutes les éditions
            </Link>
          ) : null}
        </aside>
      ) : null}

      <EventEditionSections
        edition={edition}
        title={edition.eventName}
        eyebrow={`Édition ${edition.editionYear}`}
        shareUrl={editionUrl}
        overviewTitle={editionTitle}
        showNextEdition
      />

      {hubPath ? (
        <p className="text-sm text-muted-foreground">
          <Link href={hubPath as Route} className="font-semibold text-brand hover:underline">Toutes les éditions de {hubName}</Link>
        </p>
      ) : null}
    </div>
  );
}

function EditionHistory({ hub }: { hub: PublicRaceEventHub }) {
  if (hub.editions.length < 2) return null;
  return (
    <section className="space-y-3" aria-labelledby="editions-heading">
      <h2 id="editions-heading" className="text-xl font-bold text-foreground sm:text-2xl">Toutes les éditions</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {hub.editions.map((edition) => (
          <li key={edition.id}>
            <Link href={`/courses/evenements/${edition.slug}` as Route} className="group flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition hover:bg-brand-surface/60">
              <span className="min-w-0">
                <span className="block font-semibold text-foreground group-hover:text-brand">Édition {edition.editionYear}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {formatEditionDateRange(edition.startDate, edition.endDate)} · {edition.formatCount} format{edition.formatCount > 1 ? "s" : ""}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${edition.isPast ? "bg-muted text-muted-foreground" : "bg-brand-surface text-brand"}`}>
                {edition.id === hub.featured.id ? (edition.isPast ? "Dernière édition" : "Prochaine édition") : edition.isPast ? "Terminée" : "À venir"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function EventHubPage({ hub }: { hub: PublicRaceEventHub }) {
  const { featured } = hub;
  const hubUrl = new URL(`/courses/evenements/${hub.slug}`, SITE_URL).toString();
  const featuredUrl = new URL(`/courses/evenements/${featured.slug}`, SITE_URL).toString();
  const hubName = getEventHubName(hub.eventName);
  const isDemo = isDemoRaceEventId(hub.eventId);
  const featuredIsPast = isEventEditionPast(featured.endDate);
  // The hub publishes the featured edition's SportsEvent under the edition @id
  // (the one the format pages reference) with the hub as its page. An
  // EventSeries is deliberately not emitted: it is an Event subtype that Google
  // validates for startDate/location like the partial nested Events removed on
  // 2026-11-16.
  const structuredData = isDemo ? null : buildEventEditionStructuredData(featured, featuredUrl, new Date(), hubUrl);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10 sm:space-y-8 sm:px-0 lg:px-2">
      {structuredData ? <JsonLd data={structuredData} /> : null}
      <JsonLd data={breadcrumbStructuredData([
        { name: "Accueil", url: SITE_URL },
        { name: "Courses", url: new URL("/courses", SITE_URL).toString() },
        { name: hubName, url: hubUrl },
      ])} />

      <Breadcrumb crumbs={[{ name: "Accueil", href: "/" }, { name: "Courses", href: "/courses" }]} current={hubName} />

      {featuredIsPast ? (
        <aside className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950" aria-labelledby="hub-past-heading">
          <h2 id="hub-past-heading" className="font-semibold">Prochaine édition pas encore publiée</h2>
          <p className="text-sm">La dernière édition s’est terminée le {formatEditionDate(featured.endDate)}. Les informations ci-dessous la concernent.</p>
        </aside>
      ) : null}

      <EventEditionSections
        edition={featured}
        title={hubName}
        eyebrow={featuredIsPast ? `Dernière édition · ${featured.editionYear}` : `Prochaine édition · ${featured.editionYear}`}
        shareUrl={hubUrl}
        overviewTitle={hubName}
        racebookAvailable={!featuredIsPast && hub.featuredLivretCoureurAvailable}
        afterFormats={(
          <>
            {!featuredIsPast && hub.featuredLivretCoureurAvailable ? (
              <aside className="rounded-2xl border border-brand-border bg-brand-surface p-4" aria-labelledby="hub-livret-heading">
                <h2 id="hub-livret-heading" className="font-semibold text-foreground">Livret coureur disponible</h2>
                <p className="text-sm text-muted-foreground">L’organisation publie son Livret coureur {featured.editionYear} dans l’app Pace Yourself.</p>
              </aside>
            ) : null}
            <EditionHistory hub={hub} />
          </>
        )}
      />
    </div>
  );
}

export default async function PublicEventPage({ params }: PageProps) {
  const resolution = await resolvePublicRaceEventEditionSlug(params.slug);
  if (resolution) {
    if (resolution.shouldRedirect) permanentRedirect(`/courses/evenements/${resolution.edition.slug}`);
    return <EventEditionPage edition={resolution.edition} />;
  }

  const hub = await resolvePublicRaceEventHubSlug(params.slug);
  if (!hub) notFound();
  return <EventHubPage hub={hub} />;
}
