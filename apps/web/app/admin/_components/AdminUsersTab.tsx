"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useI18n } from "../../i18n-provider";
import { adminGrowthResponseSchema } from "../../api/admin/growth/schema";
import AdminTrendChart from "../components/AdminTrendChart";
import {
  AdminUser,
  adminUserSchema,
  adminUsersSchema,
  formatDate,
  formatDateTimeLocal,
  formatDuration,
  formatStatus,
  premiumGrantFormSchema,
  PremiumGrantFormValues,
  premiumGrantResponseSchema,
  userRoleOptions,
  UserRoleOption,
} from "./admin-types";

const readResponsePayload = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => "");

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const summarizeZodError = (error: z.ZodError): string =>
  error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "response"}: ${issue.message}`)
    .join("; ");

const buildApiErrorMessage = (response: Response, payload: unknown, fallback: string): string => {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const parts = [
      typeof record.message === "string" ? record.message : null,
      typeof record.details === "string" ? record.details : null,
      typeof record.source === "string" ? `Source: ${record.source}` : null,
    ].filter((value): value is string => Boolean(value && value.trim().length > 0));

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }

  return `${fallback} (HTTP ${response.status})`;
};

export function AdminUsersTab({ accessToken }: { accessToken: string | null }) {
  const { t } = useI18n();
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [premiumDialogUser, setPremiumDialogUser] = useState<AdminUser | null>(null);
  const [detailsDialogUser, setDetailsDialogUser] = useState<AdminUser | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"email" | "role" | "createdAt" | "lastSignInAt">("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const premiumReasonOptions = useMemo(
    () => [
      { value: "trial_extension", label: t.admin.users.premium.reasons.trialExtension },
      { value: "support", label: t.admin.users.premium.reasons.support },
      { value: "marketing", label: t.admin.users.premium.reasons.marketing },
      { value: "partner", label: t.admin.users.premium.reasons.partner },
      { value: "other", label: t.admin.users.premium.reasons.other },
    ],
    [t.admin.users.premium.reasons]
  );

  const roleLabels = useMemo(
    () => ({
      user: t.admin.users.roles.user,
      admin: t.admin.users.roles.admin,
    }),
    [t.admin.users.roles]
  );

  const premiumForm = useForm<PremiumGrantFormValues>({
    resolver: zodResolver(premiumGrantFormSchema),
    defaultValues: {
      startsAt: formatDateTimeLocal(new Date()),
      initialDurationDays: 30,
      reason: premiumReasonOptions[0]?.value ?? "",
    },
  });

  useEffect(() => {
    if (!premiumDialogOpen) {
      premiumForm.reset({
        startsAt: formatDateTimeLocal(new Date()),
        initialDurationDays: 30,
        reason: premiumReasonOptions[0]?.value ?? "",
      });
      return;
    }

    if (premiumDialogUser) {
      premiumForm.reset({
        startsAt: formatDateTimeLocal(new Date()),
        initialDurationDays: 30,
        reason: premiumReasonOptions[0]?.value ?? "",
      });
    }
  }, [premiumDialogOpen, premiumDialogUser, premiumForm, premiumReasonOptions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", accessToken, page, search, sort, order],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error(t.admin.users.loadError);

      const params = new URLSearchParams({
        page: String(page),
        search,
        sort,
        order,
      });
      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(buildApiErrorMessage(response, data, t.admin.users.loadError));
      }

      const parsed = adminUsersSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(`Invalid /api/admin/users response. ${summarizeZodError(parsed.error)}`);
      }

      return parsed.data;
    },
    onSuccess: (data) => {
      if (data.pagination.page !== page) setPage(data.pagination.page);
    },
  });
  const userTrendsQuery = useQuery({
    queryKey: ["admin", "growth", accessToken, "last30", "", ""],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error(t.admin.users.loadError);
      const response = await fetch("/api/admin/growth?range=last30", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) throw new Error(buildApiErrorMessage(response, payload, t.admin.users.loadError));
      const parsed = adminGrowthResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error(t.admin.users.loadError);
      return parsed.data;
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async (payload: { id: string; roles: UserRoleOption[] }) => {
      if (!accessToken) throw new Error(t.admin.users.messages.error);

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(buildApiErrorMessage(response, data, t.admin.users.messages.error));
      }

      const parsed = z.object({ user: adminUserSchema }).safeParse(data);

      if (!parsed.success) {
        throw new Error(`Invalid PATCH /api/admin/users response. ${summarizeZodError(parsed.error)}`);
      }

      return parsed.data.user;
    },
    onSuccess: () => {
      setUserError(null);
      setUserMessage(t.admin.users.messages.updated);
      setUpdatingUserId(null);
      void usersQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.users.messages.error;
      setUserError(message);
      setUserMessage(null);
      setUpdatingUserId(null);
    },
  });

  const createPremiumGrantMutation = useMutation({
    mutationFn: async (payload: { userId: string; startsAt: string; initialDurationDays: number; reason: string }) => {
      if (!accessToken) throw new Error(t.admin.users.premium.messages.error);

      const response = await fetch("/api/admin/premium", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(buildApiErrorMessage(response, data, t.admin.users.premium.messages.error));
      }

      const parsed = premiumGrantResponseSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(`Invalid POST /api/admin/premium response. ${summarizeZodError(parsed.error)}`);
      }

      return parsed.data.premiumGrant;
    },
    onSuccess: () => {
      setUserError(null);
      setUserMessage(t.admin.users.premium.messages.created);
      setPremiumDialogOpen(false);
      setPremiumDialogUser(null);
      void usersQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.users.premium.messages.error;
      setUserError(message);
    },
  });

  const revokePremiumGrantMutation = useMutation({
    mutationFn: async (payload: { id: string }) => {
      if (!accessToken) throw new Error(t.admin.users.premium.messages.error);

      const response = await fetch("/api/admin/premium", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(buildApiErrorMessage(response, data, t.admin.users.premium.messages.error));
      }

      const parsed = premiumGrantResponseSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(`Invalid DELETE /api/admin/premium response. ${summarizeZodError(parsed.error)}`);
      }

      return parsed.data.premiumGrant;
    },
    onSuccess: () => {
      setUserError(null);
      setUserMessage(t.admin.users.premium.messages.revoked);
      setRevokingGrantId(null);
      void usersQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.users.premium.messages.error;
      setUserError(message);
      setRevokingGrantId(null);
    },
  });

  const isLoading = usersQuery.isLoading;
  const userRows = usersQuery.data?.users ?? [];
  const pagination = usersQuery.data?.pagination;
  const isFrench = t.admin.users.title.toLocaleLowerCase().includes("utilisateur");
  const userTrend = userTrendsQuery.data;

  const pageNumbers = useMemo(() => {
    if (!pagination || pagination.totalPages <= 1) return [];
    return Array.from(
      new Set([1, pagination.page - 1, pagination.page, pagination.page + 1, pagination.totalPages])
    )
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= pagination.totalPages)
      .sort((left, right) => left - right);
  }, [pagination]);

  const handleSort = (column: "email" | "role" | "createdAt" | "lastSignInAt") => {
    setPage(1);
    if (sort === column) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSort(column);
    setOrder(column === "createdAt" || column === "lastSignInAt" ? "desc" : "asc");
  };

  const renderSortableHeader = (
    column: "email" | "role" | "createdAt" | "lastSignInAt",
    label: string
  ) => (
    <TableHead
      className="text-slate-600 dark:text-slate-300"
      aria-sort={sort === column ? (order === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-sm text-left hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:hover:text-slate-50"
        onClick={() => handleSort(column)}
      >
        {label}
        <span aria-hidden className={sort === column ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
          {sort === column ? (order === "asc" ? "↑" : "↓") : "↕"}
        </span>
        <span className="sr-only">
          {sort === column
            ? order === "asc"
              ? t.admin.users.sort.descending
              : t.admin.users.sort.ascending
            : t.admin.users.sort.ascending}
        </span>
      </button>
    </TableHead>
  );

  const getUserRoles = (user: z.infer<typeof adminUserSchema>): UserRoleOption[] => {
    const roles = (user.roles ?? (user.role ? [user.role] : [])) as UserRoleOption[];
    return roles.length > 0 ? roles : ["user"];
  };

  const handlePremiumSubmit = premiumForm.handleSubmit((values) => {
    if (!premiumDialogUser) return;

    const startsAt = new Date(values.startsAt);

    if (Number.isNaN(startsAt.getTime())) {
      premiumForm.setError("startsAt", { message: t.admin.users.premium.form.errors.invalidDate });
      return;
    }

    createPremiumGrantMutation.mutate({
      userId: premiumDialogUser.id,
      startsAt: startsAt.toISOString(),
      initialDurationDays: values.initialDurationDays,
      reason: values.reason,
    });
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.admin.users.title}</CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t.admin.users.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {userTrend ? (
            <AdminTrendChart
              title={isFrench ? "Dynamique des utilisateurs · 30 jours" : "User momentum · 30 days"}
              description={isFrench
                ? `${userTrend.overview.newAccounts} nouveaux comptes, ${userTrend.overview.activatedUsers} activés en 24 h. Données issues de Supabase.`
                : `${userTrend.overview.newAccounts} new accounts, ${userTrend.overview.activatedUsers} activated within 24h. Data from Supabase.`}
              points={userTrend.trend}
              locale={isFrench ? "fr-FR" : "en-US"}
              series={[
                { key: "newAccounts", label: isFrench ? "Nouveaux comptes" : "New accounts", color: "#2563eb" },
                { key: "activePlanUsers", label: isFrench ? "Actifs sur un plan" : "Active on a plan", color: "#16a34a" },
                { key: "newPlans", label: isFrench ? "Nouveaux plans" : "New plans", color: "#7c3aed" },
              ]}
            />
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-sm">
              <Label htmlFor="admin-users-search" className="sr-only">
                {t.admin.users.searchLabel}
              </Label>
              <Input
                id="admin-users-search"
                type="search"
                value={searchInput}
                placeholder={t.admin.users.searchPlaceholder}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            {pagination ? (
              <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
                {t.admin.users.pagination.results.replace("{count}", String(pagination.total))}
              </p>
            ) : null}
          </div>
          {userMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-200">{userMessage}</p> : null}
          {userError ? <p className="text-sm text-red-600 dark:text-red-300">{userError}</p> : null}
          {usersQuery.error ? (
            <p className="text-sm text-red-600 dark:text-red-300">
              {usersQuery.error instanceof Error ? usersQuery.error.message : t.admin.users.loadError}
            </p>
          ) : null}

          {isLoading && userRows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.access.checking}</p>
          ) : null}

          {!isLoading && userRows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.users.empty}</p>
          ) : null}

          {userRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {renderSortableHeader("email", t.admin.users.table.email)}
                  {renderSortableHeader("role", t.admin.users.table.role)}
                  {renderSortableHeader("createdAt", t.admin.users.table.createdAt)}
                  {renderSortableHeader("lastSignInAt", t.admin.users.table.lastSignInAt)}
                  <TableHead className="text-slate-600 dark:text-slate-300">
                    {t.admin.users.table.premium}
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.users.table.details}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      {user.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-200">
                      <div className="flex flex-wrap items-center gap-3">
                        {userRoleOptions.map((option) => {
                          const activeRoles = getUserRoles(user);
                          const isChecked = activeRoles.includes(option);
                          return (
                            <label
                              key={option}
                              className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-emerald-400"
                                checked={isChecked}
                                onChange={() => {
                                  const currentRoles = getUserRoles(user);
                                  const nextRoles: UserRoleOption[] = isChecked
                                    ? currentRoles.filter((role) => role !== option)
                                    : [...currentRoles, option];
                                  const normalizedRoles: UserRoleOption[] =
                                    nextRoles.length > 0 ? nextRoles : ["user"];
                                  setUpdatingUserId(user.id);
                                  updateUserRoleMutation.mutate({ id: user.id, roles: normalizedRoles });
                                }}
                                disabled={updateUserRoleMutation.isPending && updatingUserId === user.id}
                              />
                              <span>{roleLabels[option]}</span>
                            </label>
                          );
                        })}
                        {updateUserRoleMutation.isPending && updatingUserId === user.id ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {t.admin.users.messages.updating}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-200">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-200">
                      {formatDate(user.lastSignInAt)}
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-200">
                      <div className="space-y-2">
                        {user.subscription ? (
                          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <div>
                              <span className="font-semibold">{t.admin.users.premium.subscription.label}</span>{" "}
                              {formatStatus(user.subscription.status)}
                            </div>
                            {user.subscription.currentPeriodEnd ? (
                              <div>
                                <span className="font-semibold">{t.admin.users.premium.subscription.ends}</span>{" "}
                                {formatDate(user.subscription.currentPeriodEnd)}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {user.trial ? (
                          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <div>
                              <span className="font-semibold">{t.admin.users.premium.trial.label}</span>{" "}
                              {formatDate(user.trial.endsAt)}
                            </div>
                            <div>
                              <span className="font-semibold">{t.admin.users.premium.trial.remaining}</span>{" "}
                              {formatDuration(user.trial.remainingDays)}
                            </div>
                          </div>
                        ) : null}
                        {user.premiumGrant ? (
                          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <div>
                              <span className="font-semibold">{t.admin.users.premium.starts}</span>{" "}
                              {formatDate(user.premiumGrant.startsAt)}
                            </div>
                            <div>
                              <span className="font-semibold">{t.admin.users.premium.duration}</span>{" "}
                              {formatDuration(user.premiumGrant.initialDurationDays)}
                            </div>
                            <div>
                              <span className="font-semibold">{t.admin.users.premium.remaining}</span>{" "}
                              {formatDuration(user.premiumGrant.remainingDurationDays)}
                            </div>
                            <div>
                              <span className="font-semibold">{t.admin.users.premium.reason}</span>{" "}
                              {user.premiumGrant.reason}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-2 text-xs text-red-600 hover:text-red-600"
                              onClick={() => {
                                if (!user.premiumGrant) return;
                                setRevokingGrantId(user.premiumGrant.id);
                                revokePremiumGrantMutation.mutate({ id: user.premiumGrant.id });
                              }}
                              disabled={
                                revokePremiumGrantMutation.isPending && revokingGrantId === user.premiumGrant.id
                              }
                            >
                              {revokePremiumGrantMutation.isPending && revokingGrantId === user.premiumGrant.id
                                ? t.admin.users.premium.revoke.loading
                                : t.admin.users.premium.revoke.action}
                            </Button>
                          </div>
                        ) : null}
                        {!user.premiumGrant && !user.trial && !user.subscription ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t.admin.users.premium.empty}
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => {
                            setPremiumDialogUser(user);
                            setPremiumDialogOpen(true);
                          }}
                          disabled={createPremiumGrantMutation.isPending}
                        >
                          {t.admin.users.premium.action}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setDetailsDialogUser(user)}>
                        {t.admin.users.details.open}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {pagination && pagination.totalPages > 1 ? (
            <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={t.admin.users.pagination.label}>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t.admin.users.pagination.page
                  .replace("{page}", String(pagination.page))
                  .replace("{totalPages}", String(pagination.totalPages))}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={pagination.page <= 1 || isLoading}
                >
                  {t.admin.users.pagination.previous}
                </Button>
                {pageNumbers.map((pageNumber, index) => {
                  const previousPageNumber = pageNumbers[index - 1];
                  return (
                    <span key={pageNumber} className="flex items-center gap-1">
                      {previousPageNumber && pageNumber - previousPageNumber > 1 ? (
                        <span className="px-1 text-slate-400" aria-hidden>
                          …
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        variant={pageNumber === pagination.page ? "default" : "outline"}
                        className="h-9 min-w-9 px-2"
                        aria-current={pageNumber === pagination.page ? "page" : undefined}
                        aria-label={t.admin.users.pagination.goToPage.replace("{page}", String(pageNumber))}
                        onClick={() => setPage(pageNumber)}
                        disabled={isLoading}
                      >
                        {pageNumber}
                      </Button>
                    </span>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                >
                  {t.admin.users.pagination.next}
                </Button>
              </div>
            </nav>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={premiumDialogOpen}
        onOpenChange={(open) => {
          setPremiumDialogOpen(open);
          if (!open) {
            setPremiumDialogUser(null);
            premiumForm.reset({
              startsAt: formatDateTimeLocal(new Date()),
              initialDurationDays: 30,
              reason: premiumReasonOptions[0]?.value ?? "",
            });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.admin.users.premium.form.title}</DialogTitle>
            <DialogDescription>{t.admin.users.premium.form.description}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePremiumSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="premium-starts-at">{t.admin.users.premium.form.startsAtLabel}</Label>
              <Input
                id="premium-starts-at"
                type="datetime-local"
                {...premiumForm.register("startsAt")}
              />
              {premiumForm.formState.errors.startsAt ? (
                <p className="text-xs text-red-600 dark:text-red-300">
                  {premiumForm.formState.errors.startsAt.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="premium-duration">{t.admin.users.premium.form.durationLabel}</Label>
              <Input
                id="premium-duration"
                type="number"
                min="1"
                {...premiumForm.register("initialDurationDays", { valueAsNumber: true })}
              />
              {premiumForm.formState.errors.initialDurationDays ? (
                <p className="text-xs text-red-600 dark:text-red-300">
                  {premiumForm.formState.errors.initialDurationDays.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="premium-reason">{t.admin.users.premium.form.reasonLabel}</Label>
              <select
                id="premium-reason"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                {...premiumForm.register("reason")}
              >
                {premiumReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {premiumForm.formState.errors.reason ? (
                <p className="text-xs text-red-600 dark:text-red-300">
                  {premiumForm.formState.errors.reason.message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPremiumDialogOpen(false);
                  setPremiumDialogUser(null);
                }}
              >
                {t.admin.users.premium.form.cancel}
              </Button>
              <Button type="submit" disabled={createPremiumGrantMutation.isPending}>
                {createPremiumGrantMutation.isPending
                  ? t.admin.users.premium.form.submitting
                  : t.admin.users.premium.form.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailsDialogUser)} onOpenChange={(open) => !open && setDetailsDialogUser(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.admin.users.details.title}</DialogTitle>
            <DialogDescription>{detailsDialogUser?.email ?? "—"}</DialogDescription>
          </DialogHeader>
          {detailsDialogUser ? (
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p><span className="font-semibold">{t.admin.users.details.createdAt}</span> {formatDate(detailsDialogUser.createdAt)}</p>
              <p><span className="font-semibold">{t.admin.users.details.lastSignInAt}</span> {formatDate(detailsDialogUser.lastSignInAt)}</p>
              <p><span className="font-semibold">{t.admin.users.details.signInCount}</span> {detailsDialogUser.insights?.signInCount ?? t.admin.users.details.unavailable}</p>
              <p><span className="font-semibold">{t.admin.users.details.activityWindow}</span> {detailsDialogUser.insights?.activityWindowDays !== null && detailsDialogUser.insights?.activityWindowDays !== undefined ? `${detailsDialogUser.insights.activityWindowDays}j` : t.admin.users.details.unavailable}</p>
              <p><span className="font-semibold">{t.admin.users.details.planCount}</span> {detailsDialogUser.insights?.planCount ?? 0}</p>
              <p><span className="font-semibold">{t.admin.users.details.latestPlan}</span> {detailsDialogUser.insights?.latestPlanName ?? "—"}</p>
              <p><span className="font-semibold">{t.admin.users.details.favoriteProducts}</span> {(detailsDialogUser.insights?.favoriteProducts ?? []).join(", ") || "—"}</p>
              <p><span className="font-semibold">{t.admin.users.details.onboarding}</span> {detailsDialogUser.insights?.onboardingCompleted ? t.admin.users.details.completed : t.admin.users.details.notCompleted}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
