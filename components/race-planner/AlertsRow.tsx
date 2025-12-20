"use client";

import { useEffect, useRef, useState } from "react";
import type { RacePlannerTranslations } from "../../locales/types";

type AlertsRowProps = {
  summaryCopy: RacePlannerTranslations["sections"]["summary"];
  units: RacePlannerTranslations["units"];
  actuals: {
    carbsPerHour?: number | null;
    waterPerHour?: number | null;
    sodiumPerHour?: number | null;
  };
  targets?: {
    carbsPerHour?: number | null;
    waterPerHour?: number | null;
    sodiumPerHour?: number | null;
  } | null;
};

type AlertDescriptor = {
  key: "carbs" | "water" | "sodium";
  title: string;
  description: string;
};

const formatPerHour = (value: number | null | undefined, unit: string) => {
  if (!Number.isFinite(value ?? null)) return null;
  return `${Math.round(value ?? 0)} ${unit}/hr`;
};

export function AlertsRow({ summaryCopy, units, actuals, targets }: AlertsRowProps) {
  const alerts: AlertDescriptor[] = [];
  const carbsActual = actuals.carbsPerHour ?? null;
  const carbsTarget = targets?.carbsPerHour ?? null;
  const waterActual = actuals.waterPerHour ?? null;
  const waterTarget = targets?.waterPerHour ?? null;
  const sodiumActual = actuals.sodiumPerHour ?? null;
  const sodiumTarget = targets?.sodiumPerHour ?? null;

  if (Number.isFinite(carbsActual) && Number.isFinite(carbsTarget) && (carbsActual ?? 0) < (carbsTarget ?? 0)) {
    alerts.push({
      key: "carbs",
      title: summaryCopy.alerts.carbsLowTitle,
      description: summaryCopy.alerts.carbsLowBody
        .replace("{actual}", formatPerHour(carbsActual, units.grams) ?? "0")
        .replace("{target}", formatPerHour(carbsTarget, units.grams) ?? "0"),
    });
  }

  if (Number.isFinite(waterActual) && Number.isFinite(waterTarget) && (waterActual ?? 0) < (waterTarget ?? 0)) {
    alerts.push({
      key: "water",
      title: summaryCopy.alerts.waterLowTitle,
      description: summaryCopy.alerts.waterLowBody
        .replace("{actual}", formatPerHour(waterActual, units.milliliters) ?? "0")
        .replace("{target}", formatPerHour(waterTarget, units.milliliters) ?? "0"),
    });
  }

  if (Number.isFinite(sodiumActual) && Number.isFinite(sodiumTarget) && (sodiumActual ?? 0) > (sodiumTarget ?? 0)) {
    alerts.push({
      key: "sodium",
      title: summaryCopy.alerts.sodiumHighTitle,
      description: summaryCopy.alerts.sodiumHighBody
        .replace("{actual}", formatPerHour(sodiumActual, units.milligrams) ?? "0")
        .replace("{target}", formatPerHour(sodiumTarget, units.milligrams) ?? "0"),
    });
  }

  if (!targets) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{summaryCopy.alerts.label}</p>
      {alerts.length === 0 ? (
        <Badge tone="success" label={summaryCopy.alerts.resolvedTitle} description={summaryCopy.alerts.resolvedBody} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {alerts.map((alert) => (
            <Badge key={alert.key} tone="warning" label={alert.title} description={alert.description} />
          ))}
        </div>
      )}
    </div>
  );
}

type BadgeProps = {
  label: string;
  description: string;
  tone: "warning" | "success";
};

function Badge({ label, description, tone }: BadgeProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toneClasses =
    tone === "warning"
      ? "border-amber-500/50 text-amber-100 hover:bg-amber-500/10"
      : "border-emerald-500/50 text-emerald-100 hover:bg-emerald-500/10";

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${toneClasses}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={label}
      >
        <span className="text-lg leading-none">{tone === "warning" ? "⚠️" : "✅"}</span>
        <span className="line-clamp-1">{label}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-11 z-20 w-64 rounded-md border border-slate-800 bg-slate-950/95 p-3 text-sm text-slate-100 shadow-xl">
          <p className="font-semibold">{label}</p>
          <p className="mt-1 text-slate-300">{description}</p>
        </div>
      ) : null}
    </div>
  );
}
