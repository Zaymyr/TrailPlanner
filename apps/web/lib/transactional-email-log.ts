/**
 * Journal of the transactional e-mails (`public.transactional_email_log`, service role only), read by
 * the admin console (Santé des systèmes, Intégrations › Resend). One row per attempt: date, category,
 * sent / skipped / failed, HTTP code, short message and a masked recipient. Never the content, never
 * the full address. The write is best-effort: it never throws and never delays a send by more than
 * `LOG_TIMEOUT_MS`, so a journal outage cannot make an e-mail fail.
 */

export const EMAIL_LOG_STATUSES = ["sent", "skipped", "failed"] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

export const EMAIL_LOG_MESSAGE_MAX = 300;
const CATEGORY_MAX = 80;
const LOG_TIMEOUT_MS = 2_500;

/**
 * « fa***@gmail.com »: the first two characters of the local part (one when it is that short), the
 * domain kept so a delivery problem of one provider stays visible. Null when it is not an address.
 */
export const maskEmailAddress = (value: string | null | undefined): string | null => {
  const email = value?.trim().toLowerCase() ?? "";
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`.slice(0, 120);
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[-/]+$/, "")
    .slice(0, CATEGORY_MAX);

/**
 * Category of an e-mail from its idempotency key, without the ids: `flyover/paid/<order>` →
 * `flyover/paid`, `flyover/ready/<order>/<updated_at>` → `flyover/ready`,
 * `admin-user-notification/<id>` → `admin-user-notification`. A key with no « / » gives `transactional`
 * (it may be an id itself).
 */
export const emailCategoryFromIdempotencyKey = (key: string | null | undefined): string => {
  const segments = (key ?? "").split("/").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length < 2) return "transactional";
  const kept = segments.length >= 3 ? segments.slice(0, 2) : segments.slice(0, 1);
  return slug(kept.join("/")) || "transactional";
};

/** Explicit category first (sanitized), else the one of the idempotency key. */
export const resolveEmailCategory = (category: string | null | undefined, idempotencyKey: string | null | undefined) =>
  (category ? slug(category) : "") || emailCategoryFromIdempotencyKey(idempotencyKey);

/** One line, at most `max` characters, the e-mail addresses it may quote masked. */
export const truncateLogMessage = (value: string | null | undefined, max = EMAIL_LOG_MESSAGE_MAX): string | null => {
  const line = (value ?? "")
    .replace(/[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g, (address) => maskEmailAddress(address) ?? "***")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return null;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export type TransactionalEmailLogEntry = {
  category: string;
  status: EmailLogStatus;
  to: string | null;
  statusCode?: number | null;
  message?: string | null;
  providerMessageId?: string | null;
};

export const toEmailLogRow = (entry: TransactionalEmailLogEntry) => ({
  category: slug(entry.category) || "transactional",
  status: entry.status,
  status_code: typeof entry.statusCode === "number" && entry.statusCode >= 0 && entry.statusCode <= 999 ? Math.round(entry.statusCode) : null,
  message: truncateLogMessage(entry.message),
  recipient_masked: maskEmailAddress(entry.to),
  provider_message_id: entry.providerMessageId ? entry.providerMessageId.slice(0, 100) : null,
});

/** Writes one row; any error (no configuration, network, timeout, refusal) is logged and swallowed. */
export const recordTransactionalEmail = async (entry: TransactionalEmailLogEntry): Promise<void> => {
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE)?.trim();
  if (!supabaseUrl || !serviceKey) return;
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/transactional_email_log`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(toEmailLogRow(entry)),
      cache: "no-store",
      signal: AbortSignal.timeout(LOG_TIMEOUT_MS),
    });
    if (!response.ok) console.warn("Transactional e-mail log write refused", response.status);
  } catch (error) {
    console.warn("Transactional e-mail log write failed", error instanceof Error ? error.message : error);
  }
};
