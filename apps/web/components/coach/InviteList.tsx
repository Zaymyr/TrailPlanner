"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import type { CoachDashboardInvite } from "../../lib/coach-dashboard";
import type { Translations } from "../../locales/types";

type InviteListProps = {
  invites: CoachDashboardInvite[];
  isLoading: boolean;
  error?: Error | null;
  actionError?: string | null;
  onResend: (inviteId: string) => Promise<void>;
  onCancel: (inviteId: string) => Promise<void>;
  resendingInviteId?: string | null;
  cancelingInviteId?: string | null;
  copy: Translations["coachDashboard"]["invites"];
  locale: string;
};

const formatStatus = (status: string, copy: Translations["coachDashboard"]["invites"]["status"]) =>
  copy[status as keyof typeof copy] ?? status;

export function InviteList({
  invites,
  isLoading,
  error,
  actionError,
  onResend,
  onCancel,
  resendingInviteId,
  cancelingInviteId,
  copy,
  locale,
}: InviteListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        {copy.description ? <p className="text-sm text-slate-500">{copy.description}</p> : null}
        {isLoading ? <p>{copy.loading}</p> : null}
        {error ? <p className="text-red-600">{copy.error}</p> : null}
        {actionError ? <p className="text-red-600">{actionError}</p> : null}
        {!isLoading && !error ? (
          invites.length === 0 ? (
            <p className="text-sm text-slate-500">{copy.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.columns.email}</TableHead>
                  <TableHead>{copy.columns.status}</TableHead>
                  <TableHead>{copy.columns.sentAt}</TableHead>
                  <TableHead className="text-right">{copy.columns.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => {
                  const isResending = resendingInviteId === invite.id;
                  const isCanceling = cancelingInviteId === invite.id;
                  const isActionDisabled = isResending || isCanceling;

                  return (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium text-slate-900">{invite.email}</TableCell>
                      <TableCell>{formatStatus(invite.status, copy.status)}</TableCell>
                      <TableCell>
                        {new Date(invite.createdAt).toLocaleDateString(locale, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {invite.status === "pending" ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              disabled={isActionDisabled}
                              onClick={() => {
                                void onResend(invite.id);
                              }}
                            >
                              {isResending ? copy.actions.resending : copy.actions.resend}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-2 text-xs text-red-600 hover:text-red-700"
                              disabled={isActionDisabled}
                              onClick={() => {
                                if (copy.actions.confirmCancel && !window.confirm(copy.actions.confirmCancel)) {
                                  return;
                                }
                                void onCancel(invite.id);
                              }}
                            >
                              {isCanceling ? copy.actions.canceling : copy.actions.cancel}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">{copy.actions.unavailable}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
