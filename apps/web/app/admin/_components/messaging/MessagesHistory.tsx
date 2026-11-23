"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { useToast } from "../../../../components/ui/Toast";
import { formatBillingDate } from "../../../../lib/admin-billing";
import {
  ADMIN_MESSAGE_KIND_LABEL,
  ADMIN_MESSAGE_KINDS,
  adminMessagesResponseSchema,
  READ_STATE_LABEL,
  readAdminMessagesQuery,
  writeAdminMessagesQuery,
  type AdminMessagesQuery,
} from "../../../../lib/admin-messages";
import { replaceLocationSearch } from "../../admin-tabs";
import { adminMessageBody } from "../admin-message-template";
import { NOTIFICATION_SENT_MESSAGE, sendAdminUserNotification } from "../admin-notification-api";
import { AdminNotificationDialog } from "../AdminNotificationDialog";
import { chipClass, InboxSkeletonRows } from "../inbox/InboxQueue";
import { adminFetch } from "../../publications/publications-api";

const linkClass = "font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const toggle = <T,>(values: T[], value: T) => (values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value]);

const userSearchSchema = z.object({ users: z.array(z.object({ id: z.string(), email: z.string().optional(), createdAt: z.string() }).passthrough()) });
type Recipient = { userId: string; label: string };

/**
 * « Nouveau message »: choose the recipient through the runner search of `GET /api/admin/users`
 * (same backend as Coureurs and the ⌘K palette), then the one message dialog `AdminNotificationDialog`.
 */
function RecipientPicker({ accessToken, open, onOpenChange, onPick }: { accessToken: string; open: boolean; onOpenChange: (open: boolean) => void; onPick: (recipient: Recipient) => void }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (open) {
      setDraft("");
      setSearch("");
    }
  }, [open]);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(draft.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [draft]);
  const results = useQuery({
    queryKey: ["admin", "messaging", "recipients", accessToken, search],
    enabled: open && search.length >= 2,
    staleTime: 30_000,
    queryFn: () => adminFetch(accessToken, `/api/admin/users?${new URLSearchParams({ search, page: "1" }).toString()}`, userSearchSchema, {}, "La recherche de coureurs a échoué."),
  });
  const users = results.data?.users ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau message</DialogTitle>
          <DialogDescription>Choisissez le coureur destinataire (recherche sur l’e-mail ou l’identifiant).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="messaging-recipient-search">Destinataire</Label>
            <Input id="messaging-recipient-search" type="search" autoComplete="off" value={draft} placeholder="camille@exemple.fr" onChange={(event) => setDraft(event.target.value)} />
          </div>
          {search.length < 2 ? <p className="text-sm text-muted-foreground">Saisissez au moins 2 caractères.</p> : null}
          {search.length >= 2 && results.isLoading ? <p role="status" className="text-sm text-muted-foreground">Recherche…</p> : null}
          {results.error ? <p role="alert" className="text-sm text-red-700">{results.error instanceof Error ? results.error.message : "La recherche a échoué."}</p> : null}
          {search.length >= 2 && results.isSuccess && users.length === 0 ? <p className="text-sm text-muted-foreground">Aucun compte ne correspond.</p> : null}
          {users.length ? (
            <ul className="max-h-72 space-y-1 overflow-y-auto" aria-label="Comptes trouvés">
              {users.slice(0, 20).map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => onPick({ userId: user.id, label: user.email ?? user.id })}
                  >
                    <span className="min-w-0 truncate font-medium text-foreground">{user.email ?? user.id}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">Choisir</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Communication › Messages & notifications (lot 5): history of every `user_notifications` row (all of
 * them are sent by an admin: messages, race-request replies, questionnaires), newest first, with search
 * (title and body), type chips and the recipient filter in the URL (`?recherche`, `?type`,
 * `?destinataire`, `?page`), and « Nouveau message ».
 */
export function MessagesHistory({ accessToken }: { accessToken: string }) {
  const toast = useToast();
  const [query, setQuery] = useState<AdminMessagesQuery | null>(null);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recipient, setRecipient] = useState<Recipient | null>(null);

  useEffect(() => {
    const initial = readAdminMessagesQuery(new URLSearchParams(window.location.search));
    setQuery(initial);
    setDraft(initial.search);
  }, []);

  const update = (patch: Partial<AdminMessagesQuery>) => {
    if (!query) return;
    const next = { ...query, page: 1, ...patch };
    setQuery(next);
    const search = writeAdminMessagesQuery(next).toString();
    replaceLocationSearch(search ? `?${search}` : "");
  };

  useEffect(() => {
    if (!query || draft.trim() === query.search) return;
    const timeout = window.setTimeout(() => update({ search: draft.trim() }), 350);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const apiSearch = query ? writeAdminMessagesQuery(query).toString() : "";
  const history = useQuery({
    queryKey: ["admin", "messaging", "history", accessToken, apiSearch],
    enabled: query !== null,
    staleTime: 15_000,
    queryFn: () => adminFetch(accessToken, `/api/admin/user-notifications${apiSearch ? `?${apiSearch}` : ""}`, adminMessagesResponseSchema, {}, "L’historique des messages n’a pas pu être chargé."),
  });
  const messages = history.data?.messages ?? [];
  const pagination = history.data?.pagination;
  const recipientLabel = query?.userId ? messages[0]?.recipient ?? "ce coureur" : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm space-y-1">
          <Label htmlFor="messaging-search">Rechercher dans les messages</Label>
          <Input id="messaging-search" type="search" value={draft} placeholder="Titre ou texte du message" onChange={(event) => setDraft(event.target.value)} />
        </div>
        <Button type="button" onClick={() => setPickerOpen(true)}>Nouveau message</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Type de message">
        <button type="button" className={chipClass(!query?.kinds.length, false)} aria-pressed={!query?.kinds.length} onClick={() => update({ kinds: [] })}>Tous</button>
        {ADMIN_MESSAGE_KINDS.map((kind) => {
          const selected = Boolean(query?.kinds.includes(kind));
          return (
            <button key={kind} type="button" className={chipClass(selected, false)} aria-pressed={selected} onClick={() => update({ kinds: toggle(query?.kinds ?? [], kind) })}>
              {ADMIN_MESSAGE_KIND_LABEL[kind]}
            </button>
          );
        })}
        {query?.userId ? (
          <button type="button" className={chipClass(true, false)} aria-label={`Retirer le filtre destinataire ${recipientLabel}`} onClick={() => update({ userId: null })}>
            Destinataire : {recipientLabel} <span aria-hidden="true">✕</span>
          </button>
        ) : null}
      </div>

      {history.error ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {history.error instanceof Error ? history.error.message : "L’historique n’a pas pu être chargé."}{" "}
          <button type="button" className={linkClass} onClick={() => history.refetch()}>Réessayer</button>
        </div>
      ) : null}

      {history.isLoading && !history.data ? <InboxSkeletonRows /> : null}

      {history.data && messages.length === 0 ? (
        <EmptyState
          title={query?.search || query?.kinds.length || query?.userId ? "Aucun message ne correspond" : "Aucun message envoyé"}
          description="Les messages écrits depuis la console, les réponses aux demandes de course et les questionnaires apparaissent ici."
          action={<Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>Nouveau message</Button>}
        />
      ) : null}

      {messages.length ? (
        <ul className="space-y-2" aria-label="Messages envoyés">
          {messages.map((message) => (
            <li key={message.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold text-foreground">{message.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={message.createdAt}>{formatBillingDate(message.createdAt)}</time>
                    {" · "}
                    <Link href={`/admin/runners?coureur=${message.userId}&fiche=messages` as Route} className={linkClass}>{message.recipient}</Link>
                    {message.recipientEmail && message.recipientEmail !== message.recipient ? ` (${message.recipientEmail})` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <StatusBadge tone="neutral" dot={false}>{message.kindLabel}</StatusBadge>
                  <StatusBadge tone={message.readState === "read" ? "success" : message.readState === "deleted" ? "neutral" : "info"}>{READ_STATE_LABEL[message.readState]}</StatusBadge>
                </div>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{message.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {message.channels.map((channel) => <StatusBadge key={channel.channel} tone={channel.tone} dot={false}>{channel.label}</StatusBadge>)}
                {message.context ? (
                  message.href
                    ? <Link href={message.href as Route} className={`ml-1 text-xs ${linkClass}`}>{message.context} →</Link>
                    : <span className="ml-1 text-xs text-muted-foreground">{message.context}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination des messages">
          <p className="text-sm text-muted-foreground">{pagination.total} message(s) · page {pagination.page} sur {pagination.totalPages}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={pagination.page <= 1} onClick={() => update({ page: pagination.page - 1 })}>Précédente</Button>
            <Button type="button" variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => update({ page: pagination.page + 1 })}>Suivante</Button>
          </div>
        </nav>
      ) : pagination ? <p className="text-sm text-muted-foreground">{pagination.total} message(s)</p> : null}

      <RecipientPicker
        accessToken={accessToken}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(picked) => {
          setPickerOpen(false);
          setRecipient(picked);
        }}
      />
      <AdminNotificationDialog
        open={Boolean(recipient)}
        recipient={recipient?.label ?? ""}
        initialBody={adminMessageBody()}
        onOpenChange={(open) => { if (!open) setRecipient(null); }}
        onSubmit={async (value) => {
          if (!recipient) throw new Error("Choisissez un destinataire.");
          await sendAdminUserNotification(accessToken, recipient.userId, value);
          toast.show({ message: NOTIFICATION_SENT_MESSAGE, tone: "success" });
          setRecipient(null);
          history.refetch();
        }}
      />
    </div>
  );
}
