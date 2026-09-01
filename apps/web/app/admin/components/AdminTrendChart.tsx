"use client";

type TrendPoint = {
  date: string;
  newAccounts: number;
  activatedUsers: number;
  activePlanUsers: number;
  newPlans: number;
  webVisitors: number | null;
  webPlansGenerated: number | null;
  appActiveUsers: number | null;
  appPlanCreators: number | null;
};
type TrendMetricKey = Exclude<keyof TrendPoint, "date">;

export type TrendSeries = {
  key: TrendMetricKey;
  label: string;
  color: string;
};

type Props = {
  title: string;
  description: string;
  points: TrendPoint[];
  series: TrendSeries[];
  locale: string;
};

const WIDTH = 760;
const HEIGHT = 260;
const PAD = { top: 18, right: 18, bottom: 38, left: 42 };

export default function AdminTrendChart({ title, description, points, series, locale }: Props) {
  const availableSeries = series.filter((item) => points.some((point) => typeof point[item.key] === "number"));
  const values = points.flatMap((point) => availableSeries.flatMap((item) => {
    const value = point[item.key];
    return typeof value === "number" ? [value] : [];
  }));
  const maxValue = Math.max(1, ...values);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + plotHeight - (value / maxValue) * plotHeight;
  const labelIndexes = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {availableSeries.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {points.length === 0 || availableSeries.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {locale.startsWith("fr") ? "Aucune série disponible sur cette période." : "No series available for this period."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full min-w-[620px]" role="img" aria-label={`${title}. ${description}`}>
            {[0, 0.5, 1].map((ratio) => {
              const gridY = PAD.top + plotHeight * ratio;
              const value = Math.round(maxValue * (1 - ratio));
              return (
                <g key={ratio}>
                  <line x1={PAD.left} x2={WIDTH - PAD.right} y1={gridY} y2={gridY} stroke="currentColor" className="text-border" strokeDasharray="4 5" />
                  <text x={PAD.left - 9} y={gridY + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{value}</text>
                </g>
              );
            })}
            {points.map((point, index) => labelIndexes.has(index) ? (
              <text key={point.date} x={x(index)} y={HEIGHT - 10} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">
                {formatDate(point.date)}
              </text>
            ) : null)}
            {availableSeries.map((item) => {
              const numericPoints = points.flatMap((point, index) => typeof point[item.key] === "number" ? [{ point, index, value: point[item.key] as number }] : []);
              const path = numericPoints.map(({ index, value }, pathIndex) => `${pathIndex === 0 ? "M" : "L"} ${x(index)} ${y(value)}`).join(" ");
              return (
                <g key={item.key}>
                  <path d={path} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {numericPoints.map(({ point, index, value }) => (
                    <circle key={`${item.key}-${point.date}`} cx={x(index)} cy={y(value)} r="3.5" fill={item.color}>
                      <title>{`${formatDate(point.date)} · ${item.label}: ${value}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
