import type { Route } from "next";
import Link from "next/link";

import type { PublicRaceDetail } from "../../../lib/public-race-detail";
import { getPublicRaceRegistrationUrl, type PublicRace } from "../../../lib/public-races";
import { getDisplayedElevationLossM, getSiblingFormatLabel } from "./catalog-display";
import { DemoRaceBadge } from "./DemoRaceBadge";
import { PublicHeroShell } from "./PublicHeroShell";

const formatMeters = (value: number | null) =>
  value === null ? null : `${Math.round(value).toLocaleString("fr-FR")} m`;

const StopwatchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="h-5 w-5 shrink-0">
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5V6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Observed by the mobile sticky estimate bar, which stays hidden while this button is visible. */
export const HERO_ESTIMATE_CTA_ID = "hero-estimate-cta";

/**
 * App-style course hero: veiled photo carrying the identity, a compact metric
 * strip (same facts as the mobile RaceBook header) and the estimate CTA.
 */
export function RaceHeroSummary({
  race,
  formattedDate,
  formattedEndDate,
  canonicalUrl,
  otherFormats,
  estimateHref,
  isDemo = false,
}: {
  race: PublicRaceDetail;
  formattedDate: string | null;
  formattedEndDate: string | null;
  canonicalUrl: string;
  otherFormats: PublicRace[];
  estimateHref: string;
  /** Trail TST demo: labelled as such and without a registration action. */
  isDemo?: boolean;
}) {
  const heroImage = race.raceThumbnailUrl ?? race.eventThumbnailUrl;
  const registrationUrl = isDemo ? null : getPublicRaceRegistrationUrl(race);
  const elevationLossM = getDisplayedElevationLossM(race);
  const dateLabel = formattedDate && formattedEndDate ? `Du ${formattedDate} au ${formattedEndDate}` : formattedDate;
  const participation = race.participationMode === "solo"
    ? "Solo"
    : race.participationMode === "relay"
      ? "Relais"
      : race.participationMode === "solo_and_relay"
        ? "Solo et relais"
        : null;
  const metrics = [
    { label: "Distance", value: race.distanceKm === null ? "À confirmer" : `${race.distanceKm.toLocaleString("fr-FR")} km` },
    { label: "D+", value: formatMeters(race.elevationGainM) ?? "À confirmer" },
    elevationLossM !== null ? { label: "D−", value: formatMeters(elevationLossM) as string } : null,
    race.practical.schedule.startTime ? { label: "Départ", value: race.practical.schedule.startTime } : null,
    race.practical.schedule.finishCutoffTime ? { label: "Barrière", value: race.practical.schedule.finishCutoffTime } : null,
    race.aidStations.length ? { label: "Ravitos", value: String(race.aidStations.length) } : null,
    race.maxAltitudeM !== null ? { label: "Alt. max", value: formatMeters(race.maxAltitudeM) as string } : null,
  ].filter((metric): metric is { label: string; value: string } => Boolean(metric));

  return (
    <PublicHeroShell
      imageUrl={heroImage}
      eyebrow={race.eventName && race.eventName !== race.name ? race.eventName : null}
      title={race.name}
      share={{ title: race.name, url: canonicalUrl }}
      metrics={metrics}
      funnel={{
        pageType: "format",
        slug: race.slug,
        raceId: race.id,
        eventId: race.eventId,
        hasGpx: race.routePreview !== null,
        date: race.date,
        isDemo,
      }}
      meta={(
        <>
          {isDemo ? <DemoRaceBadge /> : null}
          {dateLabel ? <span>{dateLabel}</span> : <span>Date à confirmer</span>}
          {race.location ? <><span aria-hidden="true">·</span><span>{race.location}</span></> : null}
          {participation ? (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold backdrop-blur">{participation}</span>
          ) : null}
        </>
      )}
    >
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Link
            id={HERO_ESTIMATE_CTA_ID}
            data-estimate-placement="hero"
            href={estimateHref as Route}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-base font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-light"
          >
            <StopwatchIcon />
            Estimer mon temps — gratuit
          </Link>
          {registrationUrl ? (
            <a
              href={registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface"
            >
              S’inscrire sur le site officiel
            </a>
          ) : null}
        </div>

        {otherFormats.length ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autres formats</p>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {otherFormats.map((format) => (
                <li key={format.id} className="shrink-0">
                  <Link
                    href={`/courses/${format.slug}` as Route}
                    className="inline-flex min-h-10 items-center rounded-full border border-border px-3 text-sm font-medium text-foreground transition hover:border-brand-border hover:bg-brand-surface"
                  >
                    {getSiblingFormatLabel(format)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
    </PublicHeroShell>
  );
}
