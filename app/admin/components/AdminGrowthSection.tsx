"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { type AdminGrowthResponse, adminGrowthResponseSchema } from "../../api/admin/growth/route";
import { type AdminTranslations } from "../../../locales/types";

type GrowthTranslations = AdminTranslations["growth"];

type Props = {
  accessToken: string | null;
  t: GrowthTranslations;
};

const formatDate = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const isActiveSubscription = (row: AdminGrowthResponse["userRows"][number]): boolean => {
  if (!row.subscriptionStatus) return false;
  const normalized = row.subscriptionStatus.toLowerCase();
  if (normalized !== "active" && normalized !== "trialing") return false;
  if (!row.subscriptionPeriodEnd) return true;
  const end = new Date(row.subscriptionPeriodEnd);
  return Number.isFinite(end.getTime()) ? end.getTime() > Date.now() : false;
};

type StatusKey = "admin" | "premium" | "grant" | "active" | "profileOnly" | "inactive";

const getStatus = (row: AdminGrowthResponse["userRows"][number]): StatusKey => {
  if (row.isAdmin) return "admin";
  if (isActiveSubscription(row)) return "premium";
  if (row.grantReason !== null) return "grant";
  if (row.planCount > 0) return "active";
  if (row.hasProfile) return "profileOnly";
  return "inactive";
};

const statusClasses: Record<StatusKey, string> = {
  admin: "bg-violet-100 text-violet-800 dark:bg-violet-400/20 dark:text-violet-200",
  premium: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200",
  grant: "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200",
  profileOnly: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  inactive: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

type MiniBarChartProps = {
  data: Array<{ label: string; count: number }>;
};

const MiniBarChart = ({ data }: MiniBarChartProps) => {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-px overflow-x-auto pb-1" style={{ minHeight: "64px" }}>
      {data.map((entry) => {
        const heightPct = Math.max(4, Math.round((entry.count / maxCount) * 100));
        return (
          <div key={entry.label} className="group relative flex flex-col items-center" style={{ minWidth: "6px" }}>
            <div
              className="w-full rounded-t bg-emerald-500 dark:bg-emerald-400 transition-all"
              style={{ height: `${heightPct}%` }}
              title={`${entry.label}: ${entry.count}`}
            />
            <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded bg-slate-800 px-2 py-1 text-xs text-white group-hover:block dark:bg-slate-700 whitespace-nowrap z-10">
              {entry.label}: {entry.count}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const KpiCard = ({ label, value, sub }: { label: string; value: number | string; sub?: string }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
    <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
    <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
    {sub ? <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p> : null}
  </div>
);

export default function AdminGrowthSection({ accessToken, t }: Props) {
  const growthQuery = useQuery({
    queryKey: ["admin", "growth", accessToken],
    enabled: Boolean(accessToken),
    staleTime: 60_000,
    queryFn: async () => {
      if (!accessToken) throw new Error(t.loadError);

      const response = await fetch("/api/admin/growth", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.loadError;
        throw new Error(message);
      }

      const parsed = adminGrowthResponseSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.loadError);
      }

      return parsed.data;
    },
  });

  const growth = growthQuery.data;

  const conversionRate =
    growth && growth.totals.users > 0
      ? Math.round((growth.totals.usersWithPlan / growth.totals.users) * 100)
      : 0;

  const monthChartData = (growth?.signupsByMonth ?? []).map((d) => ({
    label: d.month,
    count: d.count,
  }));

  const dayChartData = (growth?.signupsByDay ?? []).map((d) => ({
    label: d.day,
    count: d.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.title}</CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {growthQuery.error ? (
          <p className="text-sm text-red-600 dark:text-red-300">
            {growthQuery.error instanceof Error ? growthQuery.error.message : t.loadError}
          </p>
        ) : null}

        {growth ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard label={t.totals.users} value={growth.totals.users} />
              <KpiCard
                label={t.totals.usersWithPlan}
                value={growth.totals.usersWithPlan}
                sub={`${conversionRate}%`}
              />
              <KpiCard label={t.totals.usersWithProfile} value={growth.totals.usersWithProfile} />
              <KpiCard label={t.totals.activeSubscriptions} value={growth.totals.activeSubscriptions} />
              <KpiCard label={t.totals.premiumGrants} value={growth.totals.premiumGrants} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t.signupsByMonthTitle}
                </p>
                <div
                  className="flex h-16 items-end gap-px overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <MiniBarChart data={monthChartData} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t.signupsByDayTitle}
                </p>
                <div
                  className="flex h-16 items-end gap-px overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <MiniBarChart data={dayChartData} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.userTableTitle}</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-slate-600 dark:text-slate-300">{t.userTable.email}</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-300">{t.userTable.createdAt}</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-300">{t.userTable.lastSignInAt}</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-300">{t.userTable.plans}</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-300">{t.userTable.profile}</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-300">{t.userTable.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {growth.userRows.map((row) => {
                      const status = getStatus(row);
                      const statusLabel = t.statusLabels[status === "profileOnly" ? "profileOnly" : status];
                      return (
                        <TableRow key={row.userId}>
                          <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.email ?? "—"}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-200">
                            {formatDate(row.createdAt)}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-200">
                            {formatDate(row.lastSignInAt)}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-200">{row.planCount}</TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-200">
                            {row.hasProfile ? "✓" : "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[status]}`}
                            >
                              {statusLabel}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
