"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useI18n } from "../../i18n-provider";
import { adminGrowthResponseSchema } from "../../api/admin/growth/schema";
import { replaceLocationSearch } from "../admin-tabs";
import AdminTrendChart from "../components/AdminTrendChart";
import { adminMessageBody } from "./admin-message-template";
import { NOTIFICATION_SENT_MESSAGE, sendAdminUserNotification } from "./admin-notification-api";
import { AdminNotificationDialog, type AdminNotificationFormValue } from "./AdminNotificationDialog";
import {
  adminUserSchema,
  adminUsersSchema,
  formatDate,
  premiumGrantResponseSchema,
  userRoleOptions,
  UserRoleOption,
} from "./admin-types";
import { PremiumGrantDialog, type PremiumGrantDraft, type PremiumGrantSubmit } from "./runners/PremiumGrantDialog";
import { RunnerProfileDrawer, runnerProfileQueryKey } from "./runners/RunnerProfileDrawer";
import {
  DEFAULT_RUNNERS_STATE,
  nextSort,
  readRunnersUrl,
  runnersApiQuery,
  writeRunnersUrl,
  type RunnerProfileTab,
  type RunnerSort,
  type RunnersUrlState,
} from "./runners/runner-url";

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

type PremiumDialogTarget = { userId: string; grant: PremiumGrantDraft | null };
type MessageTarget = { userId: string; label: string };

const currentSearch = () => (typeof window === "undefined" ? "" : window.location.search);

/** Clicks on the role checkboxes and buttons of a row must not open the profile. */
const isInteractive = (event: MouseEvent<HTMLElement>) => Boolean((event.target as HTMLElement).closest("input,label,button,a,select"));

/**
 * Coureurs (`/admin/runners`): the list of accounts (search, column filters, sort and page, all in
 * the URL — `?recherche=` of the ⌘K palette included) and, on a row, the runner profile drawer
 * (`?coureur=<userId>&fiche=`, lot 5) with the Premium and message actions. Roles stay editable in the
 * table. The former « Voir détails » and « Accorder Premium » dialogs are now in the profile.
 */
export function AdminUsersTab({ accessToken }: { accessToken: string | null }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [state, setState] = useState<RunnersUrlState | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [emailFilterInput, setEmailFilterInput] = useState("");
  const lastWrittenSearch = useRef<string | null>(null);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [premiumTarget, setPremiumTarget] = useState<PremiumDialogTarget | null>(null);
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);

  // The URL is the state: read on load and whenever it changes from outside (⌘K palette → `?recherche=`).
  const urlSearch = searchParams?.toString() ? `?${searchParams.toString()}` : currentSearch();
  useEffect(() => {
    if (urlSearch === lastWrittenSearch.current) return;
    const next = readRunnersUrl(urlSearch);
    lastWrittenSearch.current = writeRunnersUrl(next);
    setState(next);
    setSearchInput(next.search);
    setEmailFilterInput(next.email);
  }, [urlSearch]);

  const update = (patch: Partial<RunnersUrlState> | ((current: RunnersUrlState) => Partial<RunnersUrlState>)) => {
    setState((current) => (current ? { ...current, ...(typeof patch === "function" ? patch(current) : patch) } : current));
  };
  // Every change of the view is written to the URL (no history entry), so it can be shared.
  useEffect(() => {
    if (!state) return;
    const search = writeRunnersUrl(state);
    if (search === currentSearch()) return;
    lastWrittenSearch.current = search;
    replaceLocationSearch(search);
  }, [state]);
  const updateFilters = (patch: Partial<RunnersUrlState>) => update({ ...patch, page: 1 });

  useEffect(() => {
    if (!state) return;
    const search = searchInput.trim();
    const email = emailFilterInput.trim();
    if (search === state.search && email === state.email) return;
    const timeout = window.setTimeout(() => updateFilters({ search, email }), 300);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFilterInput, searchInput]);

  const roleLabels = useMemo(
    () => ({
      user: t.admin.users.roles.user,
      admin: t.admin.users.roles.admin,
    }),
    [t.admin.users.roles]
  );

  const apiQuery = state ? runnersApiQuery(state) : "";
  const usersQuery = useQuery({
    queryKey: ["admin", "users", accessToken, apiQuery],
    enabled: Boolean(accessToken && state),
    queryFn: async () => {
      if (!accessToken) throw new Error(t.admin.users.loadError);
      const response = await fetch(`/api/admin/users?${apiQuery}`, {
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
      // The route clamps a page past the end: follow it in the URL.
      update((current) => (data.pagination.page !== current.page ? { page: data.pagination.page } : {}));
    },
  });
  const userTrendsQuery = useQuery({
    queryKey: ["admin", "growth", accessToken, "last30", "", ""],
    staleTime: 60_000,
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

  const refreshProfile = (userId: string) => queryClient.invalidateQueries({ queryKey: runnerProfileQueryKey(accessToken, userId) });

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
    onSuccess: (user) => {
      setUserError(null);
      setUserMessage(t.admin.users.messages.updated);
      setUpdatingUserId(null);
      void usersQuery.refetch();
      refreshProfile(user.id);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.users.messages.error;
      setUserError(message);
      setUserMessage(null);
      setUpdatingUserId(null);
    },
  });

  /** POST (new grant) or PATCH (`id`: change start, duration, reason) of `/api/admin/premium`. */
  const savePremiumGrantMutation = useMutation({
    mutationFn: async (payload: { id?: string; userId: string; startsAt: string; initialDurationDays: number; reason: string }) => {
      if (!accessToken) throw new Error(t.admin.users.premium.messages.error);

      const response = await fetch("/api/admin/premium", {
        method: payload.id ? "PATCH" : "POST",
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
        throw new Error(`Invalid ${payload.id ? "PATCH" : "POST"} /api/admin/premium response. ${summarizeZodError(parsed.error)}`);
      }

      return parsed.data.premiumGrant;
    },
    onSuccess: (_grant, payload) => {
      setUserError(null);
      setUserMessage(payload.id ? "L’attribution Premium a été modifiée." : t.admin.users.premium.messages.created);
      setPremiumTarget(null);
      void usersQuery.refetch();
      refreshProfile(payload.userId);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.users.premium.messages.error;
      setUserError(message);
    },
  });

  const revokePremiumGrantMutation = useMutation({
    mutationFn: async (payload: { id: string; userId: string }) => {
      if (!accessToken) throw new Error(t.admin.users.premium.messages.error);

      const response = await fetch("/api/admin/premium", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: payload.id }),
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
    onSuccess: (_grant, payload) => {
      setUserError(null);
      setUserMessage(t.admin.users.premium.messages.revoked);
      setRevokingGrantId(null);
      void usersQuery.refetch();
      refreshProfile(payload.userId);
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
  const view = state ?? DEFAULT_RUNNERS_STATE;
  const openRow = userRows.find((user) => user.id === view.runnerId);

  const pageNumbers = useMemo(() => {
    if (!pagination || pagination.totalPages <= 1) return [];
    return Array.from(
      new Set([1, pagination.page - 1, pagination.page, pagination.page + 1, pagination.totalPages])
    )
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= pagination.totalPages)
      .sort((left, right) => left - right);
  }, [pagination]);

  const handleSort = (column: RunnerSort) => updateFilters(nextSort(view, column));

  const clearColumnFilters = () => {
    setEmailFilterInput("");
    updateFilters({
      email: "",
      role: "all",
      createdFrom: "",
      createdTo: "",
      lastSignInFrom: "",
      lastSignInTo: "",
    });
  };

  const openRunner = (userId: string) => update({ runnerId: userId, tab: "resume" });

  const sendUserNotification = async (value: AdminNotificationFormValue) => {
    if (!messageTarget) throw new Error("Session admin manquante.");
    await sendAdminUserNotification(accessToken, messageTarget.userId, value);
    setUserError(null);
    setUserMessage(NOTIFICATION_SENT_MESSAGE);
    refreshProfile(messageTarget.userId);
    setMessageTarget(null);
  };

  const submitPremium = (value: PremiumGrantSubmit) => {
    if (!premiumTarget) return;
    savePremiumGrantMutation.mutate({ id: premiumTarget.grant?.id, userId: premiumTarget.userId, ...value });
  };

  const renderSortableHeader = (column: RunnerSort, label: string) => (
    <TableHead
      className="text-slate-600 dark:text-slate-300"
      aria-sort={view.sort === column ? (view.order === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-sm text-left hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:hover:text-slate-50"
        onClick={() => handleSort(column)}
      >
        {label}
        <span aria-hidden className={view.sort === column ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
          {view.sort === column ? (view.order === "asc" ? "↑" : "↓") : "↕"}
        </span>
        <span className="sr-only">
          {view.sort === column
            ? view.order === "asc"
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

  const premiumSummary = (user: z.infer<typeof adminUserSchema>) => {
    if (user.subscription) return <StatusBadge tone="success">Abonnement</StatusBadge>;
    if (user.premiumGrant) return <StatusBadge tone="success" title={`${user.premiumGrant.remainingDurationDays} j restants`}>Attribution</StatusBadge>;
    if (user.trial) return <StatusBadge tone="info" title={`${user.trial.remainingDays} j restants`}>Essai</StatusBadge>;
    return <span className="text-xs text-slate-500 dark:text-slate-400">{t.admin.users.premium.empty}</span>;
  };

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
          {userMessage ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-200">{userMessage}</p> : null}
          {userError ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{userError}</p> : null}
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
            <ul className="space-y-2 md:hidden" aria-label="Comptes">
              {userRows.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => openRunner(user.id)}
                    aria-label={`Ouvrir la fiche de ${user.email ?? user.id}`}
                    className={`flex w-full flex-col gap-1 rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${view.runnerId === user.id ? "border-brand bg-brand/5" : "border-border bg-card"}`}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold text-foreground">{user.email ?? "—"}</span>
                      {premiumSummary(user)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getUserRoles(user).map((role) => roleLabels[role]).join(", ")} · créé le {formatDate(user.createdAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">Dernière activité : {formatDate(user.lastSignInAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {userRows.length > 0 ? (
            <div className="hidden md:block">
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
                <TableRow className="align-top hover:bg-transparent">
                  <TableHead className="min-w-52 p-2">
                    <Label htmlFor="admin-users-email-filter" className="sr-only">
                      {isFrench ? "Filtrer par e-mail" : "Filter by email"}
                    </Label>
                    <Input
                      id="admin-users-email-filter"
                      type="search"
                      className="h-9 font-normal"
                      value={emailFilterInput}
                      placeholder={isFrench ? "Filtrer l’e-mail…" : "Filter email…"}
                      onChange={(event) => setEmailFilterInput(event.target.value)}
                    />
                  </TableHead>
                  <TableHead className="min-w-36 p-2">
                    <Label htmlFor="admin-users-role-filter" className="sr-only">
                      {isFrench ? "Filtrer par rôle" : "Filter by role"}
                    </Label>
                    <select
                      id="admin-users-role-filter"
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
                      value={view.role}
                      onChange={(event) => updateFilters({ role: event.target.value as RunnersUrlState["role"] })}
                    >
                      <option value="all">{isFrench ? "Tous les rôles" : "All roles"}</option>
                      <option value="user">{roleLabels.user}</option>
                      <option value="admin">{roleLabels.admin}</option>
                    </select>
                  </TableHead>
                  <TableHead className="min-w-44 p-2">
                    <div className="space-y-1">
                      <Label htmlFor="admin-users-created-from" className="block text-[10px] font-normal text-muted-foreground">
                        {isFrench ? "Du" : "From"}
                      </Label>
                      <Input
                        id="admin-users-created-from"
                        type="date"
                        className="h-9 font-normal"
                        value={view.createdFrom}
                        max={view.createdTo || undefined}
                        onChange={(event) => updateFilters({ createdFrom: event.target.value })}
                        title={isFrench ? "Créé à partir du" : "Created from"}
                      />
                      <Label htmlFor="admin-users-created-to" className="block text-[10px] font-normal text-muted-foreground">
                        {isFrench ? "Au" : "To"}
                      </Label>
                      <Input
                        id="admin-users-created-to"
                        type="date"
                        className="h-9 font-normal"
                        value={view.createdTo}
                        min={view.createdFrom || undefined}
                        onChange={(event) => updateFilters({ createdTo: event.target.value })}
                        title={isFrench ? "Créé jusqu’au" : "Created to"}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-44 p-2">
                    <div className="space-y-1">
                      <Label htmlFor="admin-users-active-from" className="block text-[10px] font-normal text-muted-foreground">
                        {isFrench ? "Du" : "From"}
                      </Label>
                      <Input
                        id="admin-users-active-from"
                        type="date"
                        className="h-9 font-normal"
                        value={view.lastSignInFrom}
                        max={view.lastSignInTo || undefined}
                        onChange={(event) => updateFilters({ lastSignInFrom: event.target.value })}
                        title={isFrench ? "Actif à partir du" : "Active from"}
                      />
                      <Label htmlFor="admin-users-active-to" className="block text-[10px] font-normal text-muted-foreground">
                        {isFrench ? "Au" : "To"}
                      </Label>
                      <Input
                        id="admin-users-active-to"
                        type="date"
                        className="h-9 font-normal"
                        value={view.lastSignInTo}
                        min={view.lastSignInFrom || undefined}
                        onChange={(event) => updateFilters({ lastSignInTo: event.target.value })}
                        title={isFrench ? "Actif jusqu’au" : "Active to"}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="p-2" />
                  <TableHead className="p-2">
                    <Button type="button" variant="ghost" className="h-9 px-2 text-xs" onClick={clearColumnFilters}>
                      {isFrench ? "Réinitialiser" : "Reset"}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRows.map((user) => (
                  <TableRow
                    key={user.id}
                    className={view.runnerId === user.id ? "cursor-pointer bg-brand/5" : "cursor-pointer"}
                    onClick={(event) => {
                      if (!isInteractive(event)) openRunner(user.id);
                    }}
                  >
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      <button
                        type="button"
                        className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        onClick={() => openRunner(user.id)}
                        aria-label={`Ouvrir la fiche de ${user.email ?? user.id}`}
                      >
                        {user.email ?? "—"}
                      </button>
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
                    <TableCell className="text-slate-700 dark:text-slate-200">{premiumSummary(user)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => openRunner(user.id)}>
                          Ouvrir la fiche
                        </Button>
                        <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => setMessageTarget({ userId: user.id, label: user.email ?? user.id })}>
                          Envoyer un message
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
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
                  onClick={() => update({ page: Math.max(1, view.page - 1) })}
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
                        onClick={() => update({ page: pageNumber })}
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
                  onClick={() => update({ page: Math.min(pagination.totalPages, view.page + 1) })}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                >
                  {t.admin.users.pagination.next}
                </Button>
              </div>
            </nav>
          ) : null}
        </CardContent>
      </Card>

      <RunnerProfileDrawer
        accessToken={accessToken}
        runnerId={state?.runnerId ?? null}
        listInsights={openRow?.insights ? { favoriteProducts: openRow.insights.favoriteProducts, activityWindowDays: openRow.insights.activityWindowDays } : null}
        tab={view.tab}
        revokingGrantId={revokingGrantId}
        onTabChange={(tab: RunnerProfileTab) => update({ tab })}
        onClose={() => update({ runnerId: null, tab: "resume" })}
        onGrant={(profile) => setPremiumTarget({ userId: profile.id, grant: null })}
        onEditGrant={(profile, grant) => setPremiumTarget({ userId: profile.id, grant })}
        onRevokeGrant={(profile, grant) => {
          if (!window.confirm("Révoquer cette attribution Premium dès maintenant ?")) return;
          setRevokingGrantId(grant.id);
          revokePremiumGrantMutation.mutate({ id: grant.id, userId: profile.id });
        }}
        onMessage={(profile) => setMessageTarget({ userId: profile.id, label: profile.email ?? profile.fullName ?? profile.id })}
      />

      <PremiumGrantDialog
        open={Boolean(premiumTarget)}
        grant={premiumTarget?.grant ?? null}
        pending={savePremiumGrantMutation.isPending}
        onOpenChange={(open) => { if (!open) setPremiumTarget(null); }}
        onSubmit={submitPremium}
      />

      <AdminNotificationDialog
        open={Boolean(messageTarget)}
        recipient={messageTarget?.label ?? ""}
        initialBody={adminMessageBody()}
        onOpenChange={(open) => !open && setMessageTarget(null)}
        onSubmit={sendUserNotification}
      />
    </>
  );
}
