import React, { type ReactNode } from "react";

import { courseWeatherCopy, type CourseWeatherLocale } from "./copy";
import { CourseWeatherGlyph } from "./CourseWeatherGlyph";
import {
  formatFetchedAt,
  formatKm,
  formatLocalDay,
  startEstimateNote,
  type CourseWeatherRow,
  type CourseWeatherViewState,
} from "./course-weather-model";

const ALERT_TONE = {
  heat: "bg-orange-50 text-orange-800",
  cold: "bg-sky-50 text-sky-800",
  wind: "bg-stone-100 text-stone-700",
  rain: "bg-blue-50 text-blue-800",
  storm: "bg-violet-50 text-violet-800",
  snow: "bg-sky-50 text-sky-800",
} as const;

const formatMm = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mm`;

function RowMetrics({ row, locale }: { row: CourseWeatherRow; locale: CourseWeatherLocale }) {
  const copy = courseWeatherCopy[locale];
  if (!row.hasData) return <p className="text-xs text-muted-foreground">{copy.noData}</p>;
  const temperature =
    row.temperatureC === null
      ? null
      : row.maxTemperatureC !== null && row.maxTemperatureC !== row.temperatureC
        ? `${row.temperatureC}° – ${row.maxTemperatureC}°`
        : `${row.temperatureC}°`;
  const wind =
    row.windKph !== null || row.gustKph !== null
      ? [
          row.windKph !== null ? `${copy.windLabel} ${row.windKph} km/h` : null,
          row.gustKph !== null ? `${row.windKph !== null ? "" : `${copy.windLabel} `}${copy.gustLabel} ${row.gustKph}` : null,
        ]
          .filter(Boolean)
          .join(", ")
      : null;
  const precipitation =
    row.precipitationMm !== null
      ? `${formatMm(row.precipitationMm)}${row.precipitationProbability !== null ? ` · ${row.precipitationProbability} %` : ""}`
      : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {temperature ? (
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {temperature}
          {row.feelsLikeC !== null ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({copy.feelsLike} {row.feelsLikeC}°)
            </span>
          ) : null}
        </span>
      ) : null}
      {wind ? <span className="tabular-nums">{wind}</span> : null}
      {precipitation ? <span className="tabular-nums">{precipitation}</span> : null}
    </div>
  );
}

function WeatherRow({ row, locale }: { row: CourseWeatherRow; locale: CourseWeatherLocale }) {
  const copy = courseWeatherCopy[locale];
  return (
    <li className="grid grid-cols-[2.75rem_1.75rem_minmax(0,1fr)] items-start gap-x-2 py-3 sm:grid-cols-[3.25rem_2rem_minmax(0,1fr)]">
      <span className="pt-0.5 text-right text-xs font-semibold tabular-nums text-muted-foreground">{row.timeLabel ?? ""}</span>
      <span className="pt-0.5">
        <CourseWeatherGlyph kind={row.glyph} label={row.glyphLabel} />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {row.label} <span className="font-normal text-muted-foreground">· {formatKm(row.distanceKm, locale)}</span>
        </p>
        <RowMetrics row={row} locale={locale} />
        {row.alerts.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Alertes météo">
            {row.alerts.map((alert) => (
              <li key={alert} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ALERT_TONE[alert]}`}>
                {copy.alerts[alert]}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export type CourseWeatherPanelProps = {
  title: string;
  state: CourseWeatherViewState;
  /** Rows to show for a `forecast` state (already built for the mount point). */
  rows: CourseWeatherRow[];
  locale: CourseWeatherLocale;
  /** Optional intro line under the title (e.g. race-day context). */
  children?: ReactNode;
  className?: string;
};

/** Shared shell of the course weather block: states, forecast rows, estimated-start note, footer. */
export function CourseWeatherPanel({ title, state, rows, locale, children, className }: CourseWeatherPanelProps) {
  const copy = courseWeatherCopy[locale];
  if (state.kind === "hidden") return null;

  let body: ReactNode;
  if (state.kind === "loading") {
    body = <p className="text-sm text-muted-foreground">{copy.loading}</p>;
  } else if (state.kind === "error") {
    return (
      <p className={`text-xs text-muted-foreground ${className ?? ""}`} role="status">
        {copy.error}
      </p>
    );
  } else if (state.kind === "too_early") {
    body = (
      <p className="text-sm text-muted-foreground">{copy.tooEarly.replace("{date}", formatLocalDay(state.availableFrom, locale))}</p>
    );
  } else {
    if (rows.length === 0) return null;
    const { forecast } = state;
    const note = startEstimateNote(forecast, locale);
    body = (
      <>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <WeatherRow key={row.key} row={row} locale={locale} />
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {copy.forecastOn.replace("{date}", formatFetchedAt(forecast.fetchedAt, forecast.timeZone, locale))} ·{" "}
          <a href={forecast.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {forecast.source.attribution}
          </a>
        </p>
      </>
    );
  }

  return (
    <section aria-label={title} className={`space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5 ${className ?? ""}`}>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      {children}
      {body}
    </section>
  );
}
