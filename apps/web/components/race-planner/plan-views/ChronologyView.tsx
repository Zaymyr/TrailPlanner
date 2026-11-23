import React, { type ReactNode } from "react";
import { DescentIcon, HydrationIcon, NutritionIcon, SummitIcon } from "@pace-yourself/design-system/icons";

import { SaltIcon } from "../TimelineIcons";
import type { ChronologyEvent, ChronologySection } from "./chronology-types";
import { formatClock, formatDecimal, formatDurationMinutes, formatInteger, type PlanLocale } from "./format";

export type ChronologyViewProps = {
  sections: ChronologySection[];
  locale: PlanLocale;
  /** Free preview: sections at/after this index are blurred and inert behind a lock line. */
  lockedFromIndex?: number;
  renderLockedCta?: () => ReactNode;
};

const copy = {
  fr: {
    empty: "Aucune prise prévue sur ce tronçon",
    noSections: "Aucun tronçon à afficher pour le moment",
    start: "Départ",
  },
  en: {
    empty: "Nothing planned on this section",
    noSections: "No section to show yet",
    start: "Start",
  },
} as const;

const mono = "font-[family-name:var(--font-plan-mono)]";
const gridCols = "grid grid-cols-[3.25rem_1.5rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[4rem_1.5rem_minmax(0,1fr)]";

function EventIcon({ kind }: { kind: ChronologyEvent["kind"] }) {
  if (kind === "water") return <HydrationIcon size={16} strokeWidth={2} color="#3F6F8F" />;
  if (kind === "sodium") return <SaltIcon className="h-4 w-4 text-[#B45309]" aria-hidden />;
  return <NutritionIcon size={16} strokeWidth={2} color="#2D5016" />;
}

function RailRow({ time, children }: { time?: string; children: ReactNode }) {
  return (
    <div className={gridCols}>
      <span className={`${mono} pt-2 text-right text-[12px] font-semibold tabular-nums text-[#5C6450]`}>{time ?? ""}</span>
      <span aria-hidden className="mx-auto w-0 border-l-2 border-dotted border-[#2D5016]/45" />
      <div className="min-w-0 py-1.5">{children}</div>
    </div>
  );
}

function SectionBlock({
  section,
  locale,
  isFirst,
  stationKm,
}: {
  section: ChronologySection;
  locale: PlanLocale;
  isFirst: boolean;
  stationKm: number;
}) {
  const t = copy[locale];
  const fromName = isFirst && !section.fromName ? t.start : section.fromName;
  return (
    <li>
      {/* Rail post for the section's starting point. */}
      <div className={`${gridCols} items-center`}>
        <span className={`${mono} text-right text-[13px] font-bold tabular-nums text-[#1F2410]`}>{formatClock(section.startMinute)}</span>
        <span aria-hidden className="mx-auto h-3.5 w-3.5 rounded-full bg-[#FAF8F2] ring-2 ring-[#2D5016]" />
        <p className="min-w-0 truncate font-[family-name:var(--font-plan-display)] text-[15px] font-semibold text-[#1F2410]">
          {fromName}
          <span className={`${mono} ml-2 text-[12px] font-semibold tabular-nums text-[#5C6450]`}>
            km {formatDecimal(stationKm, locale, 1)}
          </span>
        </p>
      </div>

      <RailRow>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#F4F2EC] px-3 py-2 text-[12.5px] text-[#5C6450] print:border print:border-[#ECEAE3] print:bg-white">
          <span className="font-semibold text-[#1F2410]">
            {fromName} → {section.toName}
          </span>
          <span className={`${mono} tabular-nums`}>· {formatDecimal(section.distanceKm, locale, 1)} km</span>
          <span className={`${mono} inline-flex items-center gap-1 tabular-nums`}>
            <SummitIcon size={13} strokeWidth={2} /> {formatInteger(section.dPlus, locale)} m
          </span>
          <span className={`${mono} inline-flex items-center gap-1 tabular-nums`}>
            <DescentIcon size={13} strokeWidth={2} color="#3F6F8F" /> {formatInteger(section.dMinus, locale)} m
          </span>
          <span className={`${mono} tabular-nums`}>· {formatDurationMinutes(section.durationMin, locale)}</span>
        </p>
      </RailRow>

      {section.events.length === 0 ? (
        <RailRow>
          <p className="text-[13px] italic text-[#8A917E]">{t.empty}</p>
        </RailRow>
      ) : (
        section.events.map((event, index) => (
          <RailRow key={`${event.minute}-${index}`} time={formatClock(event.minute)}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#ECEAE3]"
              >
                <EventIcon kind={event.kind} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-snug text-[#1F2410]">{event.label}</p>
                <p className="text-[13px] leading-snug text-[#5C6450]">{event.detail}</p>
              </div>
            </div>
          </RailRow>
        ))
      )}
    </li>
  );
}

/** Cumulative distance at the start of each section (the sections are consecutive). */
function startKms(sections: ChronologySection[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const section of sections) {
    out.push(acc);
    acc += section.distanceKm;
  }
  return out;
}

export function ChronologyView({ sections, locale, lockedFromIndex, renderLockedCta }: ChronologyViewProps) {
  const t = copy[locale];
  if (sections.length === 0) {
    return <p className="rounded-xl bg-[#F4F2EC] px-4 py-6 text-center text-[13.5px] text-[#5C6450]">{t.noSections}</p>;
  }

  const kms = startKms(sections);
  const lockIndex = typeof lockedFromIndex === "number" && lockedFromIndex >= 0 ? lockedFromIndex : null;
  const visible = lockIndex === null ? sections : sections.slice(0, lockIndex);
  const locked = lockIndex === null ? [] : sections.slice(lockIndex);

  return (
    <div className="space-y-4">
      <ol className="space-y-1">
        {visible.map((section, index) => (
          <SectionBlock key={section.key} section={section} locale={locale} isFirst={index === 0} stationKm={kms[index]} />
        ))}
      </ol>

      {locked.length > 0 ? (
        <div data-chronology-locked className="relative">
          <ol
            aria-hidden="true"
            ref={(node) => node?.setAttribute("inert", "")}
            className="pointer-events-none max-h-[26rem] select-none space-y-1 overflow-hidden blur-[5px] print:hidden"
          >
            {locked.map((section, index) => (
              <SectionBlock
                key={section.key}
                section={section}
                locale={locale}
                isFirst={false}
                stationKm={kms[(lockIndex ?? 0) + index]}
              />
            ))}
          </ol>
          {renderLockedCta ? <div className="absolute inset-x-0 top-6 z-10 flex justify-center px-2">{renderLockedCta()}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
