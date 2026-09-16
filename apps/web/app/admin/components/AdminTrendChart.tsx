"use client";

import { TimeSeriesLineChart } from "../../../components/ui/TimeSeriesLineChart";

type TrendPoint = {
  date: string;
  newAccounts: number;
  activatedUsers: number;
  activePlanUsers: number;
  newPlans: number;
};
type TrendMetricKey = Exclude<keyof TrendPoint, "date">;

export type TrendSeries = { key: TrendMetricKey; label: string; color: string };

type Props = {
  title: string;
  description: string;
  points: TrendPoint[];
  series: TrendSeries[];
  locale: string;
};

export default function AdminTrendChart({ title, description, points, series, locale }: Props) {
  return (
    <TimeSeriesLineChart
      title={title}
      description={description}
      points={points.map((point) => ({
        date: point.date,
        values: Object.fromEntries(series.map((item) => [item.key, point[item.key]])),
      }))}
      series={series}
      locale={locale}
    />
  );
}
