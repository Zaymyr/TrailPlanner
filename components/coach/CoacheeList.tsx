import Link from "next/link";

import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import type { CoachCoachee } from "../../lib/coach-coachees";
import type { Translations } from "../../locales/types";

type CoacheeListProps = {
  coachees: CoachCoachee[];
  isLoading: boolean;
  error?: Error | null;
  actionError?: string | null;
  onReactivate?: (coacheeId: string) => void;
  reactivatingId?: string | null;
  copy: Translations["coachDashboard"]["coachees"];
  locale: string;
};

const formatStatus = (status: string, copy: Translations["coachDashboard"]["coachees"]["status"]) =>
  copy[status as keyof typeof copy] ?? status;

export function CoacheeList({
  coachees,
  isLoading,
  error,
  actionError,
  onReactivate,
  reactivatingId,
  copy,
  locale,
}: CoacheeListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        {copy.description ? <p className="text-sm text-slate-500">{copy.description}</p> : null}
        {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
        {isLoading ? <p>{copy.loading}</p> : null}
        {error ? <p className="text-red-600">{copy.error}</p> : null}
        {!isLoading && !error ? (
          coachees.length === 0 ? (
            <p className="text-sm text-slate-500">{copy.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.columns.name}</TableHead>
                  <TableHead>{copy.columns.status}</TableHead>
                  <TableHead>{copy.columns.age}</TableHead>
                  <TableHead>{copy.columns.added}</TableHead>
                  <TableHead>{copy.columns.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coachees.map((coachee) => {
                  const name = coachee.fullName ?? coachee.invitedEmail ?? copy.unknownName;
                  const ageLabel = coachee.age !== null ? coachee.age : "-";
                  const canOpen = coachee.status === "active";
                  const isReactivating = reactivatingId === coachee.id;
                  return (
                    <TableRow key={coachee.id}>
                      <TableCell className="font-medium text-slate-900">
                        <div className="space-y-1">
                          {canOpen ? (
                            <Link className="hover:underline" href={`/coach/coachees/${coachee.id}`}>
                              {name}
                            </Link>
                          ) : (
                            <span>{name}</span>
                          )}
                          {coachee.invitedEmail ? (
                            <p className="text-xs text-slate-500">{coachee.invitedEmail}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{formatStatus(coachee.status, copy.status)}</TableCell>
                      <TableCell>{ageLabel}</TableCell>
                      <TableCell>
                        {new Date(coachee.createdAt).toLocaleDateString(locale, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {coachee.status === "disabled" && onReactivate ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => onReactivate(coachee.id)}
                            disabled={isReactivating}
                          >
                            {isReactivating ? copy.actions.reactivating : copy.actions.reactivate}
                          </Button>
                        ) : (
                          <span className="text-slate-400">{copy.actions.unavailable}</span>
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
