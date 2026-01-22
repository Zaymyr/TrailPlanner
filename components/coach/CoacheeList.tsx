import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import type { CoachCoachee } from "../../lib/coach-coachees";
import type { Translations } from "../../locales/types";

type CoacheeListProps = {
  coachees: CoachCoachee[];
  isLoading: boolean;
  error?: Error | null;
  copy: Translations["coachDashboard"]["coachees"];
  locale: string;
};

const formatStatus = (status: string, copy: Translations["coachDashboard"]["coachees"]["status"]) =>
  copy[status as keyof typeof copy] ?? status;

export function CoacheeList({ coachees, isLoading, error, copy, locale }: CoacheeListProps) {
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {coachees.map((coachee) => {
                  const name = coachee.fullName ?? coachee.invitedEmail ?? copy.unknownName;
                  const ageLabel = coachee.age !== null ? coachee.age : "-";
                  return (
                    <TableRow key={coachee.id}>
                      <TableCell className="font-medium text-slate-900">
                        <div className="space-y-1">
                          <Link className="hover:underline" href={`/coach/coachees/${coachee.id}`}>
                            {name}
                          </Link>
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
