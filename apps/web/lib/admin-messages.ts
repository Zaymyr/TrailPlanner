import { z } from "zod";

/**
 * Admin message history (`user_notifications`), pure and tested. Every row of the table is written by
 * the admin service role after an admin action (`created_by` = the admin): there is no automatic
 * notification in it. The `kind` tells the origin: a message written in the console (`admin_message`),
 * the reply sent with a race-request decision (`race_request_status`), a feedback survey
 * (`feedback_survey`). A bug / feedback reply is an `admin_message` carrying `feedback_id`.
 * Shared by `GET /api/admin/user-notifications` (Communication) and the runner profile drawer.
 */

export const ADMIN_MESSAGE_KINDS = ["admin_message", "race_request_status", "feedback_survey"] as const;
export type AdminMessageKind = (typeof ADMIN_MESSAGE_KINDS)[number];

/** Filter values of `?type=` (French, as in the URL of the page). */
export const ADMIN_MESSAGE_TYPE_PARAM: Record<AdminMessageKind, string> = {
  admin_message: "message",
  race_request_status: "demande",
  feedback_survey: "questionnaire",
};

export const ADMIN_MESSAGE_KIND_LABEL: Record<AdminMessageKind, string> = {
  admin_message: "Message",
  race_request_status: "Réponse à une demande de course",
  feedback_survey: "Questionnaire",
};

const DELIVERY_STATUSES = ["not_requested", "pending", "sent", "failed", "unavailable"] as const;
type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  not_requested: "non demandé",
  pending: "en cours",
  sent: "envoyé",
  failed: "échec",
  unavailable: "indisponible",
};

/** Columns read by the admin (service role); `email_error` / `push_error` stay on the server. */
export const ADMIN_MESSAGE_COLUMNS =
  "id,user_id,created_by,race_request_id,feedback_id,kind,title,body,read_at,deleted_at,email_requested,email_status,push_requested,push_status,push_sent_count,created_at";

export const adminMessageRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  created_by: z.string().nullable().optional(),
  race_request_id: z.coerce.number().int().nullable().optional(),
  feedback_id: z.coerce.number().int().nullable().optional(),
  kind: z.enum(ADMIN_MESSAGE_KINDS),
  title: z.string(),
  body: z.string(),
  read_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  email_requested: z.boolean(),
  email_status: z.enum(DELIVERY_STATUSES),
  push_requested: z.boolean(),
  push_status: z.enum(DELIVERY_STATUSES),
  push_sent_count: z.coerce.number().int().nonnegative().catch(0),
  created_at: z.string(),
});
export type AdminMessageRow = z.infer<typeof adminMessageRowSchema>;

export const adminMessageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** Recipient label for the list (name, then e-mail, then « Compte coureur »). */
  recipient: z.string(),
  recipientEmail: z.string().nullable(),
  kind: z.enum(ADMIN_MESSAGE_KINDS),
  kindLabel: z.string(),
  /** What the message answers, when it answers something. */
  context: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  readState: z.enum(["read", "unread", "deleted"]),
  readAt: z.string().nullable(),
  channels: z.array(z.object({ channel: z.enum(["app", "email", "push"]), label: z.string(), tone: z.enum(["neutral", "success", "warning", "danger", "info"]) })),
  /** Where the related item is handled (bug, feedback or race request), if any. */
  href: z.string().nullable(),
});
export type AdminMessage = z.infer<typeof adminMessageSchema>;

export const adminMessagesResponseSchema = z.object({
  messages: z.array(adminMessageSchema),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().positive() }),
});
export type AdminMessagesResponse = z.infer<typeof adminMessagesResponseSchema>;

export const ADMIN_MESSAGES_PAGE_SIZE = 30;

const deliveryTone = (status: DeliveryStatus) =>
  status === "sent" ? "success" as const : status === "failed" ? "danger" as const : status === "unavailable" ? "warning" as const : status === "pending" ? "info" as const : "neutral" as const;

/** Channels of one message: the app inbox always, e-mail and push when they were requested. */
export const messageChannels = (row: Pick<AdminMessageRow, "email_requested" | "email_status" | "push_requested" | "push_status" | "push_sent_count">): AdminMessage["channels"] => [
  { channel: "app", label: "Boîte de réception", tone: "neutral" },
  ...(row.email_requested ? [{ channel: "email" as const, label: `E-mail ${DELIVERY_STATUS_LABEL[row.email_status]}`, tone: deliveryTone(row.email_status) }] : []),
  ...(row.push_requested
    ? [{ channel: "push" as const, label: `Push ${DELIVERY_STATUS_LABEL[row.push_status]}${row.push_status === "sent" && row.push_sent_count > 1 ? ` (${row.push_sent_count} appareils)` : ""}`, tone: deliveryTone(row.push_status) }]
    : []),
];

export type RecipientIdentity = { name?: string | null; email?: string | null };

/** Console URL of what the message answers (same views as the inbox). */
export const messageContextHref = (row: Pick<AdminMessageRow, "race_request_id" | "feedback_id">, feedbackKind?: "bug" | "feedback" | null) => {
  if (row.race_request_id) return "/admin/inbox?vue=demandes";
  if (row.feedback_id) return `/admin/inbox?vue=${feedbackKind === "bug" ? "bugs" : "feedback"}`;
  return null;
};

export const mapAdminMessage = (row: AdminMessageRow, identity: RecipientIdentity = {}, feedbackKind?: "bug" | "feedback" | null): AdminMessage => ({
  id: row.id,
  userId: row.user_id,
  recipient: identity.name?.trim() || identity.email?.trim() || "Compte coureur",
  recipientEmail: identity.email?.trim() || null,
  kind: row.kind,
  kindLabel: ADMIN_MESSAGE_KIND_LABEL[row.kind],
  context: row.race_request_id
    ? `Demande de course n° ${row.race_request_id}`
    : row.feedback_id
      ? `${feedbackKind === "bug" ? "Bug" : feedbackKind === "feedback" ? "Retour" : "Bug ou retour"} n° ${row.feedback_id}`
      : null,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
  readState: row.deleted_at ? "deleted" : row.read_at ? "read" : "unread",
  readAt: row.read_at ?? null,
  channels: messageChannels(row),
  href: messageContextHref(row, feedbackKind),
});

export const READ_STATE_LABEL: Record<AdminMessage["readState"], string> = {
  read: "Lu",
  unread: "Non lu",
  deleted: "Supprimé par le coureur",
};

// ---------------------------------------------------------------------------------------------
// Query of the history (URL of /admin/messaging = query of the route)

export type AdminMessagesQuery = {
  search: string;
  kinds: AdminMessageKind[];
  userId: string | null;
  page: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads `?recherche=`, `?type=message,demande,questionnaire`, `?destinataire=<userId>`, `?page=`. */
export const readAdminMessagesQuery = (params: URLSearchParams): AdminMessagesQuery => {
  const typeValues = (params.get("type") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const kinds = ADMIN_MESSAGE_KINDS.filter((kind) => typeValues.includes(ADMIN_MESSAGE_TYPE_PARAM[kind]));
  const recipient = params.get("destinataire")?.trim() ?? "";
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    search: (params.get("recherche") ?? "").trim().slice(0, 120),
    kinds,
    userId: UUID.test(recipient) ? recipient : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
};

export const writeAdminMessagesQuery = (query: Partial<AdminMessagesQuery>): URLSearchParams => {
  const params = new URLSearchParams();
  if (query.search) params.set("recherche", query.search);
  if (query.kinds?.length) params.set("type", query.kinds.map((kind) => ADMIN_MESSAGE_TYPE_PARAM[kind]).join(","));
  if (query.userId) params.set("destinataire", query.userId);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params;
};

/**
 * PostgREST filters of the history: kinds, recipient, and the search on title and body (`*` and
 * reserved characters of the `or` syntax are removed from the text so it cannot change the filter).
 */
export const adminMessagesFilter = (query: Pick<AdminMessagesQuery, "search" | "kinds" | "userId">): string[] => {
  const filters: string[] = [];
  if (query.kinds.length && query.kinds.length < ADMIN_MESSAGE_KINDS.length) filters.push(`kind=in.(${query.kinds.join(",")})`);
  if (query.userId) filters.push(`user_id=eq.${query.userId}`);
  const text = query.search.replace(/[*,()"\\%]/g, " ").replace(/\s+/g, " ").trim();
  if (text) {
    const pattern = encodeURIComponent(`*${text}*`);
    filters.push(`or=(title.ilike.${pattern},body.ilike.${pattern})`);
  }
  return filters;
};
