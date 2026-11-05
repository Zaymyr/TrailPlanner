"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { adminMessageBody, adminMessageTitle, handledRowClassName } from "./admin-message-template";
import { AdminNotificationDialog, type AdminNotificationFormValue } from "./AdminNotificationDialog";
import { AdminReplyStatus, adminReplySchema } from "./AdminReplyStatus";

const statusSchema = z.enum(["pending", "completed", "rejected"]);
type RequestStatus = z.infer<typeof statusSchema>;
const requestSchema = z.object({
  id: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  userId: z.string().uuid(),
  userEmail: z.string().nullable(),
  userName: z.string().nullable(),
  raceName: z.string(),
  location: z.string(),
  requestedDate: z.string(),
  status: statusSchema,
  reviewedAt: z.string().nullable(),
  reply: adminReplySchema,
});
const responseSchema = z.object({
  requests: z.array(requestSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  }),
});
type RaceRequest = z.infer<typeof requestSchema>;

const statusLabels: Record<RequestStatus, string> = {
  pending: "À traiter",
  completed: "Terminée",
  rejected: "Refusée",
};

export const notificationCopy = (request: Pick<RaceRequest, "raceName" | "location">, status: RequestStatus) => {
  if (status === "completed") {
    return {
      title: adminMessageTitle(`Ta demande pour ${request.raceName} est terminée`),
      body: adminMessageBody(`La course ${request.raceName} (${request.location}) a été traitée par l’équipe Pace Yourself.`),
    };
  }
  if (status === "rejected") {
    return {
      title: adminMessageTitle(`Mise à jour de ta demande pour ${request.raceName}`),
      body: adminMessageBody(`Nous ne pouvons pas donner suite à la demande concernant ${request.raceName} pour le moment.`),
    };
  }
  return {
    title: adminMessageTitle(`Ta demande pour ${request.raceName} est à nouveau à traiter`),
    body: adminMessageBody(`La demande concernant ${request.raceName} a été replacée dans la file de traitement.`),
  };
};

/** Race requests, shown as a sub-tab of the admin inbox (AdminMessagingTab). */
export function AdminRaceRequestsTab({ accessToken, onChanged }: { accessToken: string | null; onChanged?: () => void }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | RequestStatus>("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ request: RaceRequest; status: RequestStatus } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "race-requests", accessToken, page, status, search],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error("Session admin manquante.");
      const params = new URLSearchParams({ page: String(page), status, search: search.trim() });
      const response = await fetch(`/api/admin/race-requests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Impossible de charger les demandes.");
      return responseSchema.parse(payload);
    },
  });

  const initialCopy = useMemo(
    () => dialog ? notificationCopy(dialog.request, dialog.status) : { title: "", body: "" },
    [dialog]
  );

  const submitReview = async (value: AdminNotificationFormValue) => {
    if (!accessToken || !dialog) throw new Error("Session admin manquante.");
    const response = await fetch("/api/admin/race-requests", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: dialog.request.id,
        notificationId: value.notificationId,
        status: dialog.status,
        title: value.title,
        body: value.body,
        sendEmail: value.sendEmail,
        sendPush: value.sendPush,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message ?? "Impossible de mettre à jour la demande.");
    const delivery = payload?.delivery as Record<string, unknown> | undefined;
    const hasFailure = delivery && Object.values(delivery).some((entry) => entry === "failed" || entry === "unavailable");
    setMessage(hasFailure ? "Statut modifié; au moins un canal externe n’a pas pu être livré." : "Statut et notification enregistrés.");
    setDialog(null);
    await query.refetch();
    onChanged?.();
  };

  const rows = query.data?.requests ?? [];
  const pagination = query.data?.pagination;

  return (
    <>
      <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="space-y-1">
              <Label htmlFor="race-request-search">Course ou lieu</Label>
              <Input
                id="race-request-search"
                value={search}
                onChange={(event) => { setPage(1); setSearch(event.target.value); }}
                placeholder="Rechercher…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="race-request-status">Statut</Label>
              <select
                id="race-request-status"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(event) => { setPage(1); setStatus(event.target.value as typeof status); }}
              >
                <option value="all">Tous</option>
                {statusSchema.options.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
              </select>
            </div>
          </div>
          {message ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
          {query.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
          {query.error ? <p role="alert" className="text-sm text-red-600">{query.error instanceof Error ? query.error.message : "Erreur"}</p> : null}
          {!query.isLoading && !query.error && rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune demande.</p> : null}
          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Course</TableHead><TableHead>Demandeur</TableHead><TableHead>Date souhaitée</TableHead><TableHead>Statut</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((request) => (
                    <TableRow key={request.id} className={handledRowClassName(request.status)}>
                      <TableCell><div className="font-semibold">{request.raceName}</div><div className="text-xs text-muted-foreground">{request.location}</div><AdminReplyStatus reply={request.reply} /></TableCell>
                      <TableCell><div>{request.userName || "—"}</div><div className="text-xs text-muted-foreground">{request.userEmail || request.userId}</div></TableCell>
                      <TableCell>{new Intl.DateTimeFormat("fr-FR").format(new Date(`${request.requestedDate}T12:00:00`))}</TableCell>
                      <TableCell>{statusLabels[request.status]}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {statusSchema.options.filter((next) => next !== request.status).map((next) => (
                            <Button key={next} type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => setDialog({ request, status: next })}>
                              {statusLabels[next]}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {pagination && pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Précédent</Button>
              <span className="text-sm text-muted-foreground">Page {pagination.page} sur {pagination.totalPages}</span>
              <Button variant="outline" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages}>Suivant</Button>
            </div>
          ) : null}
      </div>
      <AdminNotificationDialog
        open={Boolean(dialog)}
        recipient={dialog?.request.userEmail ?? dialog?.request.userId ?? ""}
        initialTitle={initialCopy.title}
        initialBody={initialCopy.body}
        submitLabel={`Passer à « ${dialog ? statusLabels[dialog.status] : ""} »`}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={submitReview}
      />
    </>
  );
}
