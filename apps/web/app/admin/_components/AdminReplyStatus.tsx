"use client";

import { z } from "zod";

export const adminReplySchema = z
  .object({
    title: z.string(),
    body: z.string(),
    sentAt: z.string(),
    readAt: z.string().nullable(),
    deletedAt: z.string().nullable(),
  })
  .nullable();
export type AdminReply = z.infer<typeof adminReplySchema>;

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

/** "Lue le …", "Non lue" or "Supprimée par l'utilisateur", for the last reply sent to a runner. */
export const replyStateLabel = (reply: NonNullable<AdminReply>) => {
  if (reply.deletedAt) return `Supprimée par l’utilisateur le ${formatDateTime(reply.deletedAt)}`;
  if (reply.readAt) return `Lue le ${formatDateTime(reply.readAt)}`;
  return "Non lue";
};

/** The last reply sent about an inbox item: its read state, and the text on demand. */
export function AdminReplyStatus({ reply }: { reply: AdminReply }) {
  if (!reply) return null;
  const tone = reply.deletedAt ? "text-muted-foreground" : reply.readAt ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300";
  return (
    <details className="mt-2 rounded border border-border bg-muted/30 px-2 py-1 text-xs">
      <summary className="cursor-pointer">
        Ta réponse du {formatDateTime(reply.sentAt)} · <span className={tone}>{replyStateLabel(reply)}</span>
      </summary>
      <p className="mt-1 font-semibold">{reply.title}</p>
      <p className="mt-1 whitespace-pre-wrap">{reply.body}</p>
    </details>
  );
}
