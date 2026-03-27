"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function AdminUsersTab({ accessToken }: { accessToken: string | null }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [premiumDialogUser, setPremiumDialogUser] = useState<AdminUser | null>(null);

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
      coach: t.admin.users.roles.coach,
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

  const usersQuery = useQuery({
    queryKey: ["admin", "users", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error(t.admin.users.loadError);

      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.users.loadError;
        throw new Error(message);
      }

      const parsed = adminUsersSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.users.loadError);
      }

      return parsed.data.users;
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

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.users.messages.error;
        throw new Error(message);
      }

      const parsed = z.object({ user: adminUserSchema }).safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.users.messages.error);
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

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.users.premium.messages.error;
        throw new Error(message);
      }

      const parsed = premiumGrantResponseSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.users.premium.messages.error);
      }

      return parsed.data.premiumGrant;
    },
    onSuccess: () => {
      setUserError(null);
      setUserMessage(t.admin.users.premium.messages.created);
      setPremiumDialogOpen(false);
      setPremiumDialogUser(null);
      if (accessToken) {
        void queryClient.invalidateQueries({ queryKey: ["admin", "users", accessToken] });
      }
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

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.users.premium.messages.error;
        throw new Error(message);
      }

      const parsed = premiumGrantResponseSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.users.premium.messages.error);
      }

      return parsed.data.premiumGrant;
    },
    onSuccess: () => {
      setUserError(null);
      setUserMessage(t.admin.users.premium.messages.revoked);
      setRevokingGrantId(null);
      if (accessToken) {
        void queryClient.invalidateQueries({ queryKey: ["admin", "users", accessToken] });
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.users.premium.messages.error;
      setUserError(message);
      setRevokingGrantId(null);
    },
  });

  const isLoading = usersQuery.isLoading;
  const userRows = usersQuery.data ?? [];

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
                  <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.users.table.email}</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.users.table.role}</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.users.table.createdAt}</TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">
                    {t.admin.users.table.lastSignInAt}
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-slate-300">
                    {t.admin.users.table.premium}
                  </TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    </>
  );
}
