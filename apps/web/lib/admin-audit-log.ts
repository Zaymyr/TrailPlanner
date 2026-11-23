import {
  auditActionLabel,
  maskAuditEmail,
  pickAuditFields,
  sanitizeAuditValue,
  shortAuditId,
  toAuditRow,
  truncateAuditText,
  type AuditRowInput,
} from "./admin-audit";

/**
 * Journal of the admin actions (`public.admin_audit_log`, service role only), server side. Two entry
 * points:
 *
 * - `recordAdminAction`: one best-effort write. It never throws and never waits more than
 *   `AUDIT_TIMEOUT_MS`, so a journal outage cannot make an admin request fail.
 * - `withAdminAudit`: wraps a route handler (POST / PUT / PATCH / DELETE). When the request comes from
 *   an admin (trusted `app_metadata` of the access token) and the handler answered, one line is
 *   written: a success (2xx / 3xx) is `ok`, a server failure (5xx) is `error`; a rejected request
 *   (401, 403, 400, 404, 409, 422, 429...) did nothing and is not journaled. Reads are never journaled.
 *
 * The wrapper never changes the response and never consumes the request body (it reads a clone).
 */

const AUDIT_TIMEOUT_MS = 2_000;
const MAX_BODY_BYTES = 262_144;
const MAX_RESPONSE_BYTES = 262_144;

export type AuditTarget = { type: string; id?: string | number | null };

export type RecordAdminActionInput = {
  actorUserId: string;
  actorLabel?: string | null;
  action: string;
  target: AuditTarget;
  summary: string;
  before?: unknown;
  after?: unknown;
  request?: Request | null;
  status?: "ok" | "error";
  error?: string | null;
};

const requestPathOf = (request: Request | null | undefined): string | null => {
  if (!request) return null;
  try {
    return `${request.method} ${new URL(request.url).pathname}`.slice(0, 200);
  } catch {
    return null;
  }
};

/** Writes one line; any error (no configuration, network, timeout, refusal) is logged and swallowed. */
export const recordAdminAction = async (input: RecordAdminActionInput): Promise<void> => {
  if (process.env.ADMIN_AUDIT_LOG_DISABLED === "1") return;
  try {
    const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE)?.trim();
    if (!supabaseUrl || !serviceKey) return;
    const row = toAuditRow({
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
      action: input.action,
      targetType: input.target.type,
      targetId: input.target.id,
      summary: input.summary,
      before: input.before,
      after: input.after,
      requestPath: requestPathOf(input.request),
      status: input.status,
      error: input.error,
    } satisfies AuditRowInput);
    if (!row) {
      console.warn("Admin audit entry skipped (invalid action or actor)", input.action);
      return;
    }
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/admin_audit_log`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      cache: "no-store",
      signal: AbortSignal.timeout(AUDIT_TIMEOUT_MS),
    });
    if (!response.ok) console.warn("Admin audit log write refused", response.status);
  } catch (error) {
    console.warn("Admin audit log write failed", error instanceof Error ? error.message : error);
  }
};

// ---------------------------------------------------------------------------------------------
// Actor of a request

export type AuditActor = { userId: string; label: string | null };

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload: unknown = JSON.parse(json);
    return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/**
 * The admin behind a request, read from the claims of its access token. The route has already
 * verified the token with Supabase (an invalid or non-admin one is answered 401 / 403, which is not
 * journaled), so the claims are only used to name the actor, never to authorise anything. Only the
 * trusted `app_metadata` counts, never `user_metadata`.
 */
export const adminActorFromRequest = (request: Request): AuditActor | null => {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (!token) return null;
  const claims = decodeJwtPayload(token);
  if (!claims || typeof claims.sub !== "string") return null;
  const appMetadata = claims.app_metadata && typeof claims.app_metadata === "object" ? (claims.app_metadata as Record<string, unknown>) : {};
  const roles = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const isAdmin = appMetadata.role === "admin" || roles.includes("admin");
  if (!isAdmin) return null;
  const email = typeof claims.email === "string" && claims.email.includes("@") ? maskAuditEmail(claims.email) : null;
  return { userId: claims.sub, label: email };
};

// ---------------------------------------------------------------------------------------------
// Route wrapper

export type AuditContext = {
  request: Request;
  /** Dynamic route segments (`{ id }`). */
  params: Record<string, string>;
  /** JSON body of the request (null for an upload, an empty or an oversized body). */
  body: unknown;
  /** JSON body of the response (null when it is not JSON or too large). */
  response: unknown;
  status: number;
  /** What the handler declared with `noteAdminAudit`. */
  note: AuditNote;
};

export type AuditNote = { before?: unknown; after?: unknown; targetId?: string | number | null; summary?: string };

type Resolvable<T> = T | ((context: AuditContext) => T);

export type AuditSpec = {
  action: Resolvable<string>;
  targetType: Resolvable<string>;
  /** Defaults to the first identifier found in the note, route params, body, then response. */
  targetId?: (context: AuditContext) => string | number | null | undefined;
  summary: Resolvable<string>;
  /** Defaults to the sanitised request body. Return `null` to store nothing. */
  after?: (context: AuditContext) => unknown;
  before?: (context: AuditContext) => unknown;
  /** Return true to skip the line (e.g. a dry run that changed nothing). */
  skip?: (context: AuditContext) => boolean;
  /** Error message when the action failed although the route answered 2xx (e.g. a cron run reporting `ok: false`). */
  failed?: (context: AuditContext) => string | null | undefined;
};

/** JSON body of the request as a record (empty when there is none), for the spec functions of the routes. */
export const auditBody = (context: Pick<AuditContext, "body">): Record<string, unknown> =>
  context.body && typeof context.body === "object" && !Array.isArray(context.body) ? (context.body as Record<string, unknown>) : {};

/** Same for the JSON body of the response. */
export const auditResponse = (context: Pick<AuditContext, "response">): Record<string, unknown> =>
  context.response && typeof context.response === "object" && !Array.isArray(context.response) ? (context.response as Record<string, unknown>) : {};

const notes = new WeakMap<Request, AuditNote>();

/** Lets a handler give the wrapper what only it knows (state before, created id, precise summary). */
export const noteAdminAudit = (request: Request, note: AuditNote) => {
  notes.set(request, { ...(notes.get(request) ?? {}), ...note });
};

const resolve = <T,>(value: Resolvable<T>, context: AuditContext): T => (typeof value === "function" ? (value as (context: AuditContext) => T)(context) : value);

const ID_KEYS = ["id", "userId", "user_id", "editionId", "eventId", "raceId", "postId", "claimId", "orderId", "invoiceId", "paymentId", "jobId", "productId", "slug"] as const;

const idFrom = (source: unknown): string | null => {
  if (!source || typeof source !== "object") return null;
  for (const key of ID_KEYS) {
    const value = (source as Record<string, unknown>)[key];
    if ((typeof value === "string" && value.trim()) || typeof value === "number") return String(value);
  }
  return null;
};

/** First identifier of the note, the route params, the body or the response. */
export const guessAuditTargetId = (context: Pick<AuditContext, "params" | "body" | "response" | "note">): string | null => {
  if (context.note.targetId !== undefined && context.note.targetId !== null) return String(context.note.targetId);
  const fromParams = Object.values(context.params)[0];
  if (fromParams) return fromParams;
  const fromBody = idFrom(context.body);
  if (fromBody) return fromBody;
  const response = context.response;
  if (response && typeof response === "object") {
    const direct = idFrom(response);
    if (direct) return direct;
    for (const value of Object.values(response as Record<string, unknown>)) {
      const nested = idFrom(value);
      if (nested) return nested;
    }
  }
  return null;
};

const readJson = async (carrier: Request | Response, limit: number): Promise<unknown> => {
  try {
    const type = carrier.headers.get("content-type") ?? "";
    if (!type.includes("json")) return null;
    const length = Number(carrier.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > limit) return null;
    const text = await carrier.clone().text();
    if (text.length > limit) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const responseMessage = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;
  const record = response as Record<string, unknown>;
  const value = record.message ?? record.error;
  return typeof value === "string" ? value : null;
};

const paramsOf = async (args: unknown[]): Promise<Record<string, string>> => {
  const context = args[1];
  if (!context || typeof context !== "object" || !("params" in context)) return {};
  try {
    const raw = await (context as { params: unknown }).params;
    if (!raw || typeof raw !== "object") return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : Array.isArray(value) ? [[key, value.join("/")]] : []),
    );
  } catch {
    return {};
  }
};

/**
 * `export const PATCH = withAdminAudit(handler, { action, targetType, summary })`. Keeps the handler
 * signature (request and Next.js route context) and its response untouched.
 */
export const withAdminAudit = <Args extends [Request, ...unknown[]], Result extends Response | undefined>(
  handler: (...args: Args) => Promise<Result> | Result,
  spec: AuditSpec,
): ((...args: Args) => Promise<Result>) => async (...args: Args) => {
  const request = args[0];
  let bodyClone: Request | null = null;
  try {
    if (process.env.ADMIN_AUDIT_LOG_DISABLED !== "1" && (request.headers.get("content-type") ?? "").includes("json")) bodyClone = request.clone();
  } catch {
    bodyClone = null;
  }

  const response = await handler(...args);

  // A handler that falls through without a response is a bug of that route; Next.js reports it, not the journal.
  if (!response || process.env.ADMIN_AUDIT_LOG_DISABLED === "1") return response;
  try {
    const status = response.status;
    const rejected = status >= 400 && status < 500;
    if (rejected) return response;
    const actor = adminActorFromRequest(request);
    if (!actor) return response;

    const context: AuditContext = {
      request,
      params: await paramsOf(args),
      body: bodyClone ? await readJson(bodyClone, MAX_BODY_BYTES) : null,
      response: await readJson(response, MAX_RESPONSE_BYTES),
      status,
      note: notes.get(request) ?? {},
    };
    if (spec.skip?.(context)) return response;

    const failureMessage = spec.failed?.(context) ?? null;
    const failed = status >= 500 || Boolean(failureMessage);
    const action = resolve(spec.action, context);
    const targetId = spec.targetId ? spec.targetId(context) ?? guessAuditTargetId(context) : guessAuditTargetId(context);
    const summary = context.note.summary ?? resolve(spec.summary, context);
    await recordAdminAction({
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action,
      target: { type: resolve(spec.targetType, context), id: targetId },
      summary: summary || auditActionLabel(action),
      before: spec.before ? spec.before(context) : context.note.before,
      after: spec.after ? spec.after(context) : context.note.after !== undefined ? context.note.after : context.body,
      request,
      status: failed ? "error" : "ok",
      error: failed ? failureMessage ?? responseMessage(context.response) ?? `Réponse ${status}` : null,
    });
  } catch (error) {
    console.warn("Admin audit wrapper failed", error instanceof Error ? error.message : error);
  }
  return response;
};

// Re-exported so routes import everything audit-related from one module.
export { pickAuditFields, sanitizeAuditValue, shortAuditId, truncateAuditText };
