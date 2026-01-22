import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import type { CoachDashboardInvite } from "../../lib/coach-dashboard";
import type { Translations } from "../../locales/types";

type InviteListProps = {
  invites: CoachDashboardInvite[];
  isLoading: boolean;
  error?: Error | null;
  copy: Translations["coachDashboard"]["invites"];
  locale: string;
};

const formatStatus = (status: string, copy: Translations["coachDashboard"]["invites"]["status"]) =>
  copy[status as keyof typeof copy] ?? status;

export function InviteList({ invites, isLoading, error, copy, locale }: InviteListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        {copy.description ? <p className="text-sm text-slate-500">{copy.description}</p> : null}
        {isLoading ? <p>{copy.loading}</p> : null}
        {error ? <p className="text-red-600">{copy.error}</p> : null}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
