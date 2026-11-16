import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { PublicHeroShell } from "../../../_components/PublicHeroShell";
import { resolvePublicRaceEventEditionSlug } from "../../../../../lib/public-race-events";
import { getPublicSupporterGuide, groupTimelineByDay, supporterFollowPath } from "../../../../../lib/public-supporter-guide";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../../../../seo";

export const revalidate = 900;
export const dynamicParams = true;

type PageProps = { params: { slug: string } };

const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const kmFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const formatDate = (value: string) => fullDateFormatter.format(new Date(`${value}T12:00:00Z`));
const formatDateRange = (startDate: string, endDate: string) =>
  startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} – ${formatDate(endDate)}`;
const formatDay = (value: string | null) => {
  if (!value) return "Programme";
  const label = dayFormatter.format(new Date(`${value}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Keyed by string so newer programme kinds (estimated finishes, animations) still render.
const timelineKindLabel: Record<string, string> = {
  start: "Départ",
  finish_cutoff: "Barrière d’arrivée",
  awards: "Podium",
  arrival_estimate: "Arrivée estimée",
  animation: "Animation",
};
const stationAccessLabel = { allowed: "Accompagnateurs autorisés", restricted: "Accès accompagnateurs limité" } as const;

export async function generateStaticParams() {
  return [];
}

async function loadFollowPage(slug: string) {
  const resolution = await resolvePublicRaceEventEditionSlug(slug);
  if (!resolution) return null;
  const guide = await getPublicSupporterGuide(resolution.edition);
  return guide ? { resolution, guide } : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const loaded = await loadFollowPage(params.slug);
  if (!loaded) return { title: "Livret supporter introuvable", robots: { index: false, follow: false } };
  const { edition } = loaded.resolution;
  const canonicalPath = supporterFollowPath(edition.slug);
  const title = `Suivre ${edition.eventName} ${edition.editionYear} : programme et points de suivi`;
  const where = edition.location ? `, ${edition.location}` : "";
  const description = `Programme, départs, points d’encouragement et accès pour suivre ${edition.eventName} ${edition.editionYear} (${formatDateRange(edition.startDate, edition.endDate)}${where}). Livret supporter gratuit, sans compte.`;
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

export default async function EventFollowPage({ params }: PageProps) {
  const loaded = await loadFollowPage(params.slug);
  if (!loaded) notFound();
  const { resolution, guide } = loaded;
  if (resolution.shouldRedirect) permanentRedirect(supporterFollowPath(resolution.edition.slug));

  const { edition } = resolution;
  const editionTitle = `${edition.eventName} ${edition.editionYear}`;
  const eventPath = `/courses/evenements/${edition.slug}`;
  const canonicalUrl = new URL(supporterFollowPath(edition.slug), SITE_URL).toString();
  const guideHref = `/courses/supporter-guide/${guide.formats[0]!.raceId}`;
  const days = groupTimelineByDay(guide.timeline ?? []);
  const followFormats = guide.formats
    .map((format) => ({
      ...format,
      places: [
        ...format.supporterPoints.map((point) => ({
          id: `point-${point.id}`,
          km: point.km,
          name: point.name,
          tag: [point.encouragementAllowed ? "Encouragement" : null, point.assistanceAllowed ? "Assistance" : null].filter(Boolean).join(" · "),
          detail: point.accessLabel && point.accessLabel.trim().toLowerCase() !== point.name.trim().toLowerCase() ? point.accessLabel : null,
        })),
        ...format.aidStations
          .filter((station) => station.supportersAccess === "allowed" || station.supportersAccess === "restricted")
          .map((station) => ({
            id: `station-${station.id}`,
            km: station.km,
            name: station.name,
            tag: stationAccessLabel[station.supportersAccess as "allowed" | "restricted"],
            detail: station.cutoffTime ? `Dernier coureur ${station.cutoffTime}` : null,
          })),
      ].sort((left, right) => left.km - right.km),
    }))
    .filter((format) => format.places.length > 0);
  const pointCount = guide.formats.reduce((sum, format) => sum + format.supporterPoints.length, 0);
  const placeText = (place: { label: string | null; address: string | null }) =>
    [...new Set([place.label, place.address].map((value) => value?.trim()).filter(Boolean))].join(" · ");
  const accessRows = guide.practical.access
    .flatMap((row) => [
      { label: "Départ", value: placeText(row.start), raceName: row.raceName },
      { label: "Arrivée", value: placeText(row.finish), raceName: row.raceName },
      { label: "Parkings", value: row.parking ?? "", raceName: row.raceName },
      { label: "Navettes", value: row.shuttles ?? "", raceName: row.raceName },
    ])
    .filter((row) => row.value);
  // One shared value is shown once; values that differ per format name their format.
  const accessGroups = new Map<string, { label: string; value: string; raceNames: string[] }>();
  for (const row of accessRows) {
    const key = `${row.label}|${row.value}`;
    const group = accessGroups.get(key);
    if (group) group.raceNames.push(row.raceName);
    else accessGroups.set(key, { label: row.label, value: row.value, raceNames: [row.raceName] });
  }
  const accessItems = [...accessGroups.values()]
    .map((group) => {
      const sharedByAll = group.raceNames.length === guide.practical.access.length;
      return { label: sharedByAll ? group.label : `${group.label} · ${group.raceNames.join(", ")}`, value: group.value };
    })
    .slice(0, 8);

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: new URL("/courses", SITE_URL).toString() },
      { "@type": "ListItem", position: 3, name: editionTitle, item: new URL(eventPath, SITE_URL).toString() },
      { "@type": "ListItem", position: 4, name: "Suivre la course", item: canonicalUrl },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10 sm:space-y-8 sm:px-0 lg:px-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />

      <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
        <Link href="/" className="shrink-0 hover:text-brand hover:underline">Accueil</Link>
        <span aria-hidden="true">/</span>
        <Link href={eventPath as Route} className="truncate hover:text-brand hover:underline">{editionTitle}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="shrink-0 text-foreground">Suivre</span>
      </nav>

      <PublicHeroShell
        imageUrl={edition.thumbnailUrl}
        eyebrow="Livret supporter"
        title={`Suivre ${editionTitle}`}
        share={{ title: `Suivre ${editionTitle}`, url: canonicalUrl }}
        metrics={[
          { label: "Formats", value: String(guide.formats.length) },
          pointCount ? { label: "Points de suivi", value: String(pointCount) } : null,
          days.length ? { label: "Jours", value: String(days.length) } : null,
        ].filter((metric): metric is { label: string; value: string } => Boolean(metric))}
        meta={(
          <>
            <span>{formatDateRange(edition.startDate, edition.endDate)}</span>
            {edition.location ? <><span aria-hidden="true">·</span><span>{edition.location}</span></> : null}
          </>
        )}
      >
        <p className="text-sm text-muted-foreground">
          Pour la famille, les amis et le public : où et quand encourager les coureurs, sans compte ni application.
        </p>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Link
            href={guideHref as Route}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-base font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-light"
          >
            Ouvrir le Livret supporter
          </Link>
          <Link
            href={eventPath as Route}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface"
          >
            Formats et parcours
          </Link>
        </div>
      </PublicHeroShell>

      {days.length ? (
        <section aria-labelledby="programme-heading" className="space-y-3">
          <h2 id="programme-heading" className="text-xl font-bold text-foreground sm:text-2xl">Programme de {editionTitle}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {days.map((day) => (
              <div key={day.date ?? "undated"} className="overflow-hidden rounded-2xl border border-border bg-card">
                <h3 className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-semibold text-foreground">{formatDay(day.date)}</h3>
                <ol className="divide-y divide-border">
                  {day.entries.map((entry) => (
                    <li key={entry.id} className="flex gap-3 px-4 py-2.5">
                      <span className="w-12 shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">{entry.time}</span>
                      <span className="min-w-0 text-sm">
                        <span className="font-semibold text-brand">{timelineKindLabel[entry.kind] ?? "Programme"}{entry.label ? ` · ${entry.label}` : ""}</span>
                        {entry.raceName ? <span className="block text-foreground">{entry.raceName}</span> : null}
                        {entry.location ? <span className="block text-xs text-muted-foreground">{entry.location}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {followFormats.length ? (
        <section aria-labelledby="follow-heading" className="space-y-3">
          <h2 id="follow-heading" className="text-xl font-bold text-foreground sm:text-2xl">Où encourager les coureurs ?</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {followFormats.map((format) => (
              <div key={format.raceId} className="rounded-2xl border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground">{format.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {[format.distanceKm ? `${kmFormatter.format(format.distanceKm)} km` : null, format.startTime ? `Départ ${format.startTime}` : null].filter(Boolean).join(" · ")}
                </p>
                <ol className="mt-3 space-y-2">
                  {format.places.map((place) => (
                    <li key={place.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                      <span className="min-w-0 text-sm">
                        <span className="block font-semibold text-foreground">{place.name}</span>
                        <span className="block text-xs text-brand">{place.tag}</span>
                        {place.detail ? <span className="block text-xs text-muted-foreground">{place.detail}</span> : null}
                      </span>
                      <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">km {kmFormatter.format(place.km)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {accessItems.length ? (
        <section aria-labelledby="access-heading" className="space-y-3">
          <h2 id="access-heading" className="text-xl font-bold text-foreground sm:text-2xl">Accès, parkings et navettes</h2>
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
            {accessItems.map((row) => (
              <div key={`${row.label}-${row.value}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
                <dt className="text-sm font-semibold text-foreground">{row.label}</dt>
                <dd className="whitespace-pre-line text-sm text-muted-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-semibold text-foreground">Tout le Livret supporter sur ton téléphone</h2>
          <p className="text-sm text-muted-foreground">Programme, points de suivi, séjour et infos pratiques publiés par l’organisation.</p>
        </div>
        <Link
          href={guideHref as Route}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
        >
          Ouvrir le Livret supporter
        </Link>
      </section>
    </div>
  );
}
