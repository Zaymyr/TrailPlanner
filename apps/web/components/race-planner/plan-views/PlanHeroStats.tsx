import React, { type ReactNode } from "react";
import { HydrationIcon, NutritionIcon, PaceIcon, SummitIcon, TrailIcon } from "@pace-yourself/design-system/icons";

import { formatDecimal, formatDurationMinutes, formatInteger, type PlanLocale } from "./format";

export type Tone = "success" | "warning" | "danger" | "neutral";

export type PlanHeroStatsProps = {
  locale: PlanLocale;
  raceName: string | null;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  totalMinutes: number | null;
  carbsG: number;
  carbsPerHour: number | null;
  gelsCount: number | null;
  waterMl: number;
  sodiumMg: number;
  profile: { distanceKm: number; elevationM: number }[];
  aidStationKms: number[];
  sectionsOnTarget: number;
  sectionsTotal: number;
  locked?: boolean;
};

/** A section is on target when carbs and sodium are "success"; water is ignored when its tone is "neutral". */
export function computeCompleteness(
  sections: { carbs: Tone; water: Tone; sodium: Tone }[],
): { onTarget: number; total: number } {
  const onTarget = sections.filter(
    (s) => s.carbs === "success" && s.sodium === "success" && (s.water === "neutral" || s.water === "success"),
  ).length;
  return { onTarget, total: sections.length };
}

const copy = {
  fr: {
    time: "Temps estimé",
    distance: "Distance",
    carbs: "Glucides",
    water: "Eau",
    sodium: "Sodium",
    fallbackTitle: "Votre plan",
    gels: (n: number) => `${n} gel${n > 1 ? "s" : ""}`,
    ready: (a: number, b: number) => `Plan prêt : ${a} tronçon${a > 1 ? "s" : ""} sur ${b} dans la cible`,
    none: "Ajoutez des ravitos pour évaluer le plan",
    lock: "Débloquez le plan complet pour voir chaque tronçon",
    profile: "Profil altimétrique de la course",
  },
  en: {
    time: "Estimated time",
    distance: "Distance",
    carbs: "Carbs",
    water: "Water",
    sodium: "Sodium",
    fallbackTitle: "Your plan",
    gels: (n: number) => `${n} gel${n > 1 ? "s" : ""}`,
    ready: (a: number, b: number) => `Plan ready: ${a} of ${b} section${b > 1 ? "s" : ""} on target`,
    none: "Add aid stations to assess the plan",
    lock: "Unlock the full plan to see every section",
    profile: "Course elevation profile",
  },
} as const;

const mono = "font-[family-name:var(--font-plan-mono)]";

function Stat({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#C8D44E]">
        <span aria-hidden className="shrink-0">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p className={`${mono} mt-1 text-[24px] font-bold leading-tight tracking-tight tabular-nums text-[#FAF8F2] sm:text-[26px]`}>{value}</p>
      {helper ? <p className={`${mono} text-[12px] tabular-nums text-[#FAF8F2]/65`}>{helper}</p> : null}
    </div>
  );
}

const SPARK_W = 320;
const SPARK_H = 84;
const SPARK_PAD = 6;

function Sparkline({ profile, aidStationKms, label }: Pick<PlanHeroStatsProps, "profile" | "aidStationKms"> & { label: string }) {
  const points = profile.filter((p) => Number.isFinite(p.distanceKm) && Number.isFinite(p.elevationM));
  if (points.length < 2) return null;
  const kms = points.map((p) => p.distanceKm);
  const els = points.map((p) => p.elevationM);
  const minKm = Math.min(...kms);
  const maxKm = Math.max(...kms);
  const minEl = Math.min(...els);
  const maxEl = Math.max(...els);
  const spanKm = maxKm - minKm || 1;
  const spanEl = maxEl - minEl || 1;
  const x = (km: number) => SPARK_PAD + ((km - minKm) / spanKm) * (SPARK_W - 2 * SPARK_PAD);
  const base = SPARK_H - SPARK_PAD;
  const y = (el: number) => base - 6 - ((el - minEl) / spanEl) * (SPARK_H - 2 * SPARK_PAD - 14);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.distanceKm).toFixed(1)} ${y(p.elevationM).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points[points.length - 1].distanceKm).toFixed(1)} ${base} L${x(points[0].distanceKm).toFixed(1)} ${base} Z`;
  const ticks = aidStationKms.filter((km) => km > minKm && km < maxKm);

  return (
    <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} role="img" aria-label={label} className="h-auto w-full">
      <path d={area} fill="#C8D44E" fillOpacity={0.12} />
      {ticks.map((km) => (
        <line key={km} x1={x(km)} x2={x(km)} y1={SPARK_PAD} y2={base} stroke="#FAF8F2" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 3" />
      ))}
      <path d={line} fill="none" stroke="#C8D44E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {ticks.map((km) => (
        <circle key={`dot-${km}`} cx={x(km)} cy={base} r={2.5} fill="#FAF8F2" />
      ))}
    </svg>
  );
}

export function PlanHeroStats({
  locale,
  raceName,
  distanceKm,
  elevationGainM,
  elevationLossM,
  totalMinutes,
  carbsG,
  carbsPerHour,
  gelsCount,
  waterMl,
  sodiumMg,
  profile,
  aidStationKms,
  sectionsOnTarget,
  sectionsTotal,
  locked = false,
}: PlanHeroStatsProps) {
  const t = copy[locale];
  const waterText = waterMl >= 1000 ? `${formatDecimal(waterMl / 1000, locale, 1)} L` : `${formatInteger(waterMl, locale)} ml`;
  const barCount = Math.min(sectionsTotal, 24);
  const filled = sectionsTotal > 24 ? Math.round((sectionsOnTarget / sectionsTotal) * 24) : sectionsOnTarget;
  const carbsHelper =
    [carbsPerHour === null ? null : `${formatInteger(carbsPerHour, locale)} g/h`, gelsCount === null ? null : t.gels(gelsCount)]
      .filter(Boolean)
      .join(" · ") || null;

  return (
    <section
      aria-label={raceName?.trim() || t.fallbackTitle}
      className="relative overflow-hidden rounded-2xl bg-[#1F3810] p-5 text-[#FAF8F2] shadow-[0_18px_40px_-22px_rgba(31,56,16,0.9)] print:shadow-none sm:p-6"
    >
      {/* Perforated edge of a race bib / finisher ticket. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-[radial-gradient(circle_at_8px_0,#FAF8F2_4px,transparent_4.5px)] bg-[length:16px_8px] bg-repeat-x opacity-90"
      />
      <div className="mt-1 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-center">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-plan-display)] text-2xl font-semibold tracking-tight">
            {raceName?.trim() || t.fallbackTitle}
          </h2>
          <p className="mt-2 text-[13.5px] font-medium text-[#FAF8F2]/85">
            {sectionsTotal > 0 ? t.ready(sectionsOnTarget, sectionsTotal) : t.none}
          </p>
          {sectionsTotal > 0 ? (
            <div className="mt-2 flex max-w-sm gap-[3px]" role="img" aria-label={`${sectionsOnTarget} / ${sectionsTotal}`}>
              {Array.from({ length: barCount }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < filled ? "bg-[#C8D44E]" : "bg-[#FAF8F2]/20"}`} />
              ))}
            </div>
          ) : null}
          {locked ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-[#FAF8F2]/70">
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {t.lock}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-dashed border-[#FAF8F2]/15 pt-4 sm:grid-cols-3 xl:grid-cols-5">
            <Stat
              icon={<PaceIcon size={15} strokeWidth={2} />}
              label={t.time}
              value={totalMinutes === null ? "—" : formatDurationMinutes(totalMinutes, locale)}
            />
            <Stat
              icon={<TrailIcon size={15} strokeWidth={2} />}
              label={t.distance}
              value={`${formatDecimal(distanceKm, locale, 1)} km`}
              helper={`D+ ${formatInteger(elevationGainM, locale)} m · D− ${formatInteger(elevationLossM, locale)} m`}
            />
            <Stat icon={<NutritionIcon size={15} strokeWidth={2} />} label={t.carbs} value={`${formatInteger(carbsG, locale)} g`} helper={carbsHelper} />
            <Stat icon={<HydrationIcon size={15} strokeWidth={2} />} label={t.water} value={waterText} />
            <Stat icon={<SummitIcon size={15} strokeWidth={2} />} label={t.sodium} value={`${formatInteger(sodiumMg, locale)} mg`} />
          </div>
        </div>
        {profile.length >= 2 ? (
          <div className="min-w-0 rounded-xl bg-[#FAF8F2]/5 px-2 py-2 print:hidden">
            <Sparkline profile={profile} aidStationKms={aidStationKms} label={t.profile} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
