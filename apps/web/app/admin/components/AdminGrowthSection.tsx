"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { type AdminGrowthResponse, adminGrowthResponseSchema } from "../../api/admin/growth/schema";
import { type AdminTranslations } from "../../../locales/types";

type GrowthTranslations = AdminTranslations["growth"];

type Props = {
  accessToken: string | null | undefined;
  t: GrowthTranslations;
};

const formatDate = (value: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatPercent = (value: number, total: number): string => {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
};

const isWithinDays = (value: string | null, days: number): boolean => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const elapsedMs = Date.now() - date.getTime();
  return elapsedMs >= 0 && elapsedMs <= days * 24 * 60 * 60 * 1000;
};

const isActiveSubscription = (row: AdminGrowthResponse["userRows"][number]): boolean => {
  const normalizedStatus = row.subscriptionStatus?.toLowerCase() ?? null;
  return normalizedStatus === "active" || normalizedStatus === "trialing";
};

const hasSubscriptionRecord = (row: AdminGrowthResponse["userRows"][number]): boolean => {
  return row.subscriptionStatus !== null && row.subscriptionStatus !== undefined;
};

const hasPremiumAccess = (row: AdminGrowthResponse["userRows"][number]): boolean => {
  return isActiveSubscription(row) || row.grantReason !== null;
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
  const userRows = growth?.userRows ?? [];
  const totalUsers = growth?.totals.users ?? 0;
  const activatedUsers = userRows.filter((row) => row.planCount > 0).length;
  const profileOnlyUsers = userRows.filter((row) => row.hasProfile && row.planCount === 0).length;
  const premiumUsers = userRows.filter(hasPremiumAccess).length;
  const recentSignups7d = userRows.filter((row) => isWithinDays(row.createdAt, 7)).length;
  const recentSignups30d = userRows.filter((row) => isWithinDays(row.createdAt, 30)).length;
  const activeUsers30d = userRows.filter((row) => isWithinDays(row.lastSignInAt, 30)).length;

  const funnelData = growth
    ? [
        {
          label: t.funnel.accounts,
          count: totalUsers,
          rate: "100%",
        },
        {
          label: t.funnel.profile,
          count: growth.totals.usersWithProfile,
          rate: formatPercent(growth.totals.usersWithProfile, totalUsers),
        },
        {
          label: t.funnel.plan,
          count: activatedUsers,
          rate: formatPercent(activatedUsers, totalUsers),
        },
        {
          label: t.funnel.premium,
          count: premiumUsers,
          rate: formatPercent(premiumUsers, totalUsers),
        },
      ]
    : [];

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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label={t.totals.users} value={totalUsers} />
              <KpiCard
                label={t.totals.recentSignups}
                value={recentSignups7d}
                sub={t.totals.recentSignupsSub.replace("{count}", String(recentSignups30d))}
              />
              <KpiCard
                label={t.totals.activatedUsers}
                value={activatedUsers}
                sub={formatPercent(activatedUsers, totalUsers)}
              />
              <KpiCard
                label={t.totals.profileOnly}
                value={profileOnlyUsers}
                sub={formatPercent(profileOnlyUsers, totalUsers)}
              />
              <KpiCard
                label={t.totals.premiumUsers}
                value={premiumUsers}
                sub={t.totals.premiumUsersSub
                  .replace("{subscriptions}", String(growth.totals.activeSubscriptions))
                  .replace("{grants}", String(growth.totals.premiumGrants))}
              />
              <KpiCard
                label={t.totals.activeUsers30d}
                value={activeUsers30d}
                sub={formatPercent(activeUsers30d, totalUsers)}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.funnel.title}</p>
              <div className="space-y-3">
                {funnelData.map((step) => (
                  <div key={step.label} className="grid gap-2 sm:grid-cols-[160px_1fr_72px] sm:items-center">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{step.label}</div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                        style={{
                          width:
                            totalUsers > 0 && step.count > 0
                              ? `${Math.max(4, Math.round((step.count / totalUsers) * 100))}%`
                              : "0%",
                        }}
                      />
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {step.count} - {step.rate}
                    </div>
                  </div>
                ))}
              </div>
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
                      <TableHead className="text-slate-600 dark:text-slate-300">{t.userTable.activation}</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-300">{t.userTable.premium}</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-300">{t.userTable.segment}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {growth.userRows.map((row) => {
                      const status = getStatus(row);
                      const statusLabel = t.statusLabels[status];
                      const activationLabel =
                        row.planCount > 0
                          ? t.activation.withPlans.replace("{count}", String(row.planCount))
                          : row.hasProfile
                            ? t.activation.profileOnly
                            : t.activation.noProfile;
                      const activationHint =
                        row.planCount > 0
                          ? t.activation.withPlansHint
                          : row.hasProfile
                            ? t.activation.profileOnlyHint
                            : t.activation.noProfileHint;
                      const premiumLabel = row.isAdmin
                        ? t.premium.admin
                        : isActiveSubscription(row)
                          ? t.premium.subscription
                          : row.grantReason !== null
                            ? t.premium.grant
                            : hasSubscriptionRecord(row)
                              ? t.premium.inactiveSubscription
                              : t.premium.free;
                      const premiumHint = row.isAdmin
                        ? t.premium.adminHint
                        : isActiveSubscription(row)
                          ? row.subscriptionPeriodEnd
                            ? t.premium.renewsOn.replace("{date}", formatDate(row.subscriptionPeriodEnd))
                            : t.premium.subscriptionHint
                          : row.grantReason !== null
                            ? t.premium.reason.replace("{reason}", row.grantReason)
                            : hasSubscriptionRecord(row)
                              ? t.premium.inactiveSubscriptionHint.replace("{status}", row.subscriptionStatus ?? "-")
                              : t.premium.freeHint;

                      return (
                        <TableRow key={row.userId}>
                          <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.email ?? "-"}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-200">
                            {formatDate(row.createdAt)}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-200">
                            {formatDate(row.lastSignInAt)}
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-200">
                            <div className="space-y-1">
                              <p className="font-medium">{activationLabel}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{activationHint}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-200">
                            <div className="space-y-1">
                              <p className="font-medium">{premiumLabel}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{premiumHint}</p>
                            </div>
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
