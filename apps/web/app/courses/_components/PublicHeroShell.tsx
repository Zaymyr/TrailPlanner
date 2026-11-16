import type { ReactNode } from "react";

import { PublicRaceShare } from "./PublicRaceShare";

export type PublicHeroMetric = { label: string; value: string };

/**
 * App-style hero shared by public course and event pages: veiled photo carrying
 * the identity, a horizontally scrollable metric strip, then page actions.
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
        <dl className="flex snap-x gap-px overflow-x-auto border-b border-border bg-border [scrollbar-width:none]">
          {metrics.map((metric) => (
            <div key={metric.label} className="shrink-0 grow basis-[5.5rem] snap-start bg-card px-3 py-2.5 text-center">
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
