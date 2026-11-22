import type { ReactNode } from "react";

import { PublicRaceShare } from "./PublicRaceShare";

export type PublicHeroMetric = { label: string; value: string };

/** Phone row width: 3 per row for 3 or 5+ metrics, 2 per row for 2 or 4. */
const mobileMetricBasis = (count: number) => (count >= 5 || count === 3 ? "basis-[30%]" : count === 1 ? "basis-full" : "basis-[45%]");

/**
 * App-style hero shared by public course and event pages: veiled photo carrying
 * the identity, a metric strip, then page actions. On phones the strip wraps
 * into rows (3 + 2 for five metrics, 2 + 2 for four) so no label is cut at the
 * screen edge; from `sm` it is a single scrollable row.
 */
export function PublicHeroShell({
  imageUrl,
  eyebrow,
  title,
  meta,
  share,
  metrics,
  children,
}: {
  imageUrl: string | null;
  eyebrow: string | null;
  title: string;
  meta: ReactNode;
  share: { title: string; url: string };
  metrics: PublicHeroMetric[];
  children?: ReactNode;
}) {
  const hasImage = Boolean(imageUrl && /^https?:\/\//i.test(imageUrl));

  return (
    <header className="-mx-4 overflow-hidden bg-card shadow-sm sm:mx-0 sm:rounded-2xl sm:border sm:border-border">
      <div className="relative isolate">
        {hasImage ? (
          <img
            src={imageUrl as string}
            alt=""
            width={1200}
            height={512}
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
        ) : null}
        <div
          className={`absolute inset-0 -z-10 ${hasImage ? "bg-gradient-to-t from-black/85 via-black/55 to-black/25" : "bg-brand"}`}
          aria-hidden="true"
        />
        <div className="flex min-h-[13rem] flex-col justify-end gap-2 px-4 pb-4 pt-10 text-white sm:min-h-[17rem] sm:px-8 sm:pb-6">
          <div className="absolute right-3 top-3">
            <PublicRaceShare title={share.title} url={share.url} variant="icon" />
          </div>
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">{eyebrow}</p> : null}
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-5xl">{title}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/90 sm:text-base">{meta}</div>
        </div>
      </div>

      {metrics.length ? (
        <dl className="flex flex-wrap gap-px border-b border-border bg-border sm:snap-x sm:flex-nowrap sm:overflow-x-auto [scrollbar-width:none]">
          {metrics.map((metric) => (
            <div key={metric.label} className={`min-w-0 grow ${mobileMetricBasis(metrics.length)} bg-card px-2 py-2.5 text-center sm:shrink-0 sm:basis-[5.5rem] sm:snap-start sm:px-3`}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</dt>
              <dd className="mt-0.5 whitespace-nowrap text-base font-bold tabular-nums text-foreground sm:text-lg">{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {children ? <div className="space-y-3 p-4 sm:p-6">{children}</div> : null}
    </header>
  );
}
