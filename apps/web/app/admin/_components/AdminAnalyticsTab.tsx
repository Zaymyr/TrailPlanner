"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useI18n } from "../../i18n-provider";
import { adminAnalyticsSchema, formatDate } from "./admin-types";

export function AdminAnalyticsTab({ accessToken }: { accessToken: string | null }) {
  const { t } = useI18n();

  const analyticsQuery = useQuery({
    queryKey: ["admin", "analytics", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error(t.admin.analytics.loadError);

      const response = await fetch("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.analytics.loadError;
        throw new Error(message);
      }

      const parsed = adminAnalyticsSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.analytics.loadError);
      }

      return parsed.data;
    },
  });

  const analytics = analyticsQuery.data;
  const productStats = useMemo(() => analytics?.productStats ?? [], [analytics?.productStats]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.admin.analytics.title}</CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.admin.analytics.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {analyticsQuery.error ? (
          <p className="text-sm text-red-600 dark:text-red-300">
            {analyticsQuery.error instanceof Error ? analyticsQuery.error.message : t.admin.analytics.loadError}
          </p>
        ) : null}

        {analytics ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t.admin.analytics.totals.popupOpens}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {analytics.totals.popupOpens}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t.admin.analytics.totals.clicks}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {analytics.totals.clicks}
              </p>
            </div>
          </div>
        ) : null}

        {productStats.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t.admin.analytics.statsTitle}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {productStats.map((stat) => (
                <div
                  key={stat.productId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-50">
                      {stat.productName ?? stat.productId}
                    </p>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {t.admin.analytics.totals.popupOpens}: {stat.popupOpens}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-200">
                    {t.admin.analytics.totals.clicks}: {stat.clicks}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {analytics && analytics.recentEvents.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.analytics.empty}</p>
        ) : null}

        {analytics && analytics.recentEvents.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t.admin.analytics.eventsTitle}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-600 dark:text-slate-300">
                    {t.admin.analytics.table.product}
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">
                    {t.admin.analytics.table.eventType}
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">
                    {t.admin.analytics.table.country}
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">
                    {t.admin.analytics.table.merchant}
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">
                    {t.admin.analytics.table.timestamp}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-50">
                      {event.productName ?? event.productId}
                    </TableCell>
                    <TableCell className="capitalize text-slate-700 dark:text-slate-200">
                      {event.eventType.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-200">
                      {event.countryCode ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-200">
                      {event.merchant ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-200">
                      {formatDate(event.occurredAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
