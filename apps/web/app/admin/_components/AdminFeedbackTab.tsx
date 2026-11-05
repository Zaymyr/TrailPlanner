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

const kindSchema = z.enum(["bug", "feedback"]);
export type FeedbackKind = z.infer<typeof kindSchema>;
const statusSchema = z.enum(["pending", "completed", "rejected"]);
type FeedbackStatus = z.infer<typeof statusSchema>;
const itemSchema = z.object({
  id: z.number().int().positive(),
  createdAt: z.string(),
  userId: z.string().uuid().nullable(),
  userEmail: z.string().nullable(),
  userName: z.string().nullable(),
  kind: kindSchema,
  source: z.string(),
  screen: z.string().nullable(),
  appVersion: z.string().nullable(),
  subject: z.string(),
  detail: z.string(),
  status: statusSchema,
  reviewedAt: z.string().nullable(),
  reply: adminReplySchema,
});
const responseSchema = z.object({
  items: z.array(itemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  }),
});
type FeedbackItem = z.infer<typeof itemSchema>;

const statusLabels: Record<FeedbackKind, Record<FeedbackStatus, string>> = {
  bug: { pending: "À traiter", completed: "Corrigé", rejected: "Non retenu" },
  feedback: { pending: "À traiter", completed: "Traité", rejected: "Non retenu" },
};

const kindCopy: Record<FeedbackKind, { title: string; noun: string; empty: string }> = {
  bug: { title: "Bugs", noun: "ton signalement", empty: "Aucun bug." },
  feedback: { title: "Feedback", noun: "ton retour", empty: "Aucun feedback." },
};

/** "reply" answers without changing the status. */
type DialogAction = FeedbackStatus | "reply";

export const feedbackNotificationCopy = (item: Pick<FeedbackItem, "kind" | "subject">, action: DialogAction) => {
  const noun = kindCopy[item.kind].noun;
  const subject = `« ${item.subject} »`;
  if (action === "reply") {
    return { title: adminMessageTitle(`Réponse à ${noun} ${subject}`), body: adminMessageBody() };
  }
  if (action === "completed") {
    return item.kind === "bug"
      ? {
          title: adminMessageTitle(`Ton signalement ${subject} est corrigé`),
          body: adminMessageBody(`Merci pour ton signalement ${subject}. Le problème est corrigé, la correction arrive avec la prochaine mise à jour de l’app.`),
        }
      : {
          title: adminMessageTitle(`Merci pour ton retour ${subject}`),
          body: adminMessageBody(`Merci pour ton retour ${subject}. Nous l’avons bien pris en compte.`),
        };
  }
  if (action === "rejected") {
    return {
      title: adminMessageTitle(`Suite donnée à ${noun} ${subject}`),
      body: adminMessageBody(`Merci pour ${noun} ${subject}. Nous ne pouvons pas y donner suite pour le moment.`),
    };
  }
  return {
    title: adminMessageTitle(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${subject} est de nouveau en cours`),
    body: adminMessageBody(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${subject} est de nouveau en cours de traitement.`),
  };
};

/** The detail the clients store ends with "---" and technical lines (source, screen, version). */
const splitDetail = (detail: string) => {
  const index = detail.lastIndexOf("\n---\n");
  return index === -1 ? { message: detail, meta: null } : { message: detail.slice(0, index).trim(), meta: detail.slice(index + 5).trim() };
};

export function AdminFeedbackTab({
  accessToken,
  kind,
  onChanged,
}: {
  accessToken: string | null;
  kind: FeedbackKind;
  onChanged?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | FeedbackStatus>("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ item: FeedbackItem; action: DialogAction } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labels = statusLabels[kind];

  const query = useQuery({
    queryKey: ["admin", "feedback", kind, accessToken, page, status, search],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error("Session admin manquante.");
      const params = new URLSearchParams({ kind, page: String(page), status, search: search.trim() });
      const response = await fetch(`/api/admin/feedback?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Impossible de charger les messages.");
      return responseSchema.parse(payload);
    },
  });

  const initialCopy = useMemo(
    () => (dialog ? feedbackNotificationCopy(dialog.item, dialog.action) : { title: "", body: "" }),
    [dialog]
  );

  const patch = async (body: Record<string, unknown>) => {
    if (!accessToken) throw new Error("Session admin manquante.");
    const response = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message ?? "Impossible de mettre à jour le message.");
    await query.refetch();
    onChanged?.();
    return payload as { delivery?: Record<string, unknown> } | null;
  };

  const submitReview = async (value: AdminNotificationFormValue) => {
    if (!dialog) throw new Error("Session admin manquante.");
    const payload = await patch({
      feedbackId: dialog.item.id,
      status: dialog.action === "reply" ? dialog.item.status : dialog.action,
      notification: { id: value.notificationId, title: value.title, body: value.body, sendEmail: value.sendEmail, sendPush: value.sendPush },
    });
    const hasFailure = payload?.delivery && Object.values(payload.delivery).some((entry) => entry === "failed" || entry === "unavailable");
    setMessage(hasFailure ? "Message enregistré; au moins un canal externe n’a pas pu être livré." : "Message envoyé.");
    setDialog(null);
  };

  // An author without an account cannot be notified: the status changes silently.
  const changeStatus = (item: FeedbackItem, next: FeedbackStatus) => {
    if (item.userId) {
      setDialog({ item, action: next });
      return;
    }
    setError(null);
    patch({ feedbackId: item.id, status: next })
      .then(() => setMessage(`Passé à « ${labels[next]} » (auteur sans compte, aucun message envoyé).`))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Erreur"));
  };

  const rows = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="space-y-1">
          <Label htmlFor={`feedback-search-${kind}`}>Sujet ou message</Label>
          <Input
            id={`feedback-search-${kind}`}
            value={search}
            onChange={(event) => { setPage(1); setSearch(event.target.value); }}
            placeholder="Rechercher…"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`feedback-status-${kind}`}>Statut</Label>
          <select
            id={`feedback-status-${kind}`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => { setPage(1); setStatus(event.target.value as typeof status); }}
          >
            <option value="all">Tous</option>
            {statusSchema.options.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
          </select>
        </div>
      </div>
      {message ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {query.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {query.error ? <p role="alert" className="text-sm text-red-600">{query.error instanceof Error ? query.error.message : "Erreur"}</p> : null}
      {!query.isLoading && !query.error && rows.length === 0 ? <p className="text-sm text-muted-foreground">{kindCopy[kind].empty}</p> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Message</TableHead><TableHead>Auteur</TableHead><TableHead>Reçu le</TableHead><TableHead>Statut</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((item) => {
                const { message: text, meta } = splitDetail(item.detail);
                return (
                  <TableRow key={item.id} className={handledRowClassName(item.status)}>
                    <TableCell className="max-w-md align-top">
                      <div className="font-semibold">{item.subject}</div>
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">{text.length > 90 ? `${text.slice(0, 90)}…` : text}</summary>
                        <p className="mt-1 whitespace-pre-wrap text-foreground">{text}</p>
                        {meta ? <p className="mt-1 whitespace-pre-wrap">{meta}</p> : null}
                      </details>
                      <AdminReplyStatus reply={item.reply} />
                    </TableCell>
                    <TableCell className="align-top">
                      <div>{item.userName || (item.userId ? "—" : "Sans compte")}</div>
                      <div className="text-xs text-muted-foreground">{item.userEmail || item.userId || item.source}</div>
                    </TableCell>
                    <TableCell className="align-top">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</TableCell>
                    <TableCell className="align-top">{labels[item.status]}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        {item.userId ? (
                          <Button type="button" className="h-8 px-2 text-xs" onClick={() => setDialog({ item, action: "reply" })}>
                            Répondre
                          </Button>
                        ) : null}
                        {statusSchema.options.filter((next) => next !== item.status).map((next) => (
                          <Button key={next} type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => changeStatus(item, next)}>
                            {labels[next]}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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
      <AdminNotificationDialog
        open={Boolean(dialog)}
        recipient={dialog?.item.userEmail ?? dialog?.item.userId ?? ""}
        initialTitle={initialCopy.title}
        initialBody={initialCopy.body}
        submitLabel={dialog?.action === "reply" ? "Envoyer la réponse" : `Passer à « ${dialog ? labels[dialog.action as FeedbackStatus] : ""} »`}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={submitReview}
      />
    </div>
  );
}
