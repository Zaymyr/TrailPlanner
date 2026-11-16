import { createHash } from "node:crypto";

import { z } from "zod";

import {
  adminUserNotificationRowSchema,
  deliverAdminUserNotification,
  type AdminUserNotificationRow,
} from "./admin-user-notifications";
import { serviceHeaders } from "./organizer";
import { getPostHogOrganizerAnalyticsConfig } from "./posthog-organizer-analytics";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Supabase Auth ids are UUID v4. PostHog anonymous distinct ids are UUID v7, so this keeps only
 * identified (signed-in) runners out of a person's distinct ids.
 */
const SUPABASE_USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSTHOG_SUPABASE_ID_REGEX = "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
const MAX_AUDIENCE_SIZE = 5000;
const RESOLVE_CHUNK_SIZE = 500;
const INSERT_CHUNK_SIZE = 200;
// Supabase's Data API caps every read at 1000 rows by default.
const PENDING_PAGE_SIZE = 500;
const RESPONSES_LIMIT = 1000;
const DELIVERY_CONCURRENCY = 8;

export const surveyEventIdSchema = z.string().trim().min(1).max(80);

/**
 * Without `userId`: every identified reader of `eventId`'s livret coureur. With `userId`: only that
 * account (a test send, admins allowed); `eventId` is then optional and only labels the campaign.
 */
export const surveySendSchema = z
  .object({
    campaignId: z.string().uuid(),
    eventId: surveyEventIdSchema.optional().nullable(),
    eventLabel: z.string().trim().max(200).optional().nullable(),
    userId: z.string().uuid().transform((value) => value.toLowerCase()).optional().nullable(),
    userLabel: z.string().trim().max(200).optional().nullable(),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(4000),
    sendEmail: z.boolean().optional().default(false),
    sendPush: z.boolean().optional().default(true),
  })
  .refine((input) => Boolean(input.userId || input.eventId), { message: "An event or a user is required." });

export type SurveySendInput = z.infer<typeof surveySendSchema>;

export class FeedbackSurveyAudienceError extends Error {
  constructor(message: string, readonly reason: "configuration" | "upstream" | "response") {
    super(message);
    this.name = "FeedbackSurveyAudienceError";
  }
}

export function isSupabaseUserId(value: unknown): value is string {
  return typeof value === "string" && SUPABASE_USER_ID_PATTERN.test(value);
}

/** Stable notification id per (campaign, runner): retrying a send never creates a second message. */
export function surveyNotificationId(campaignId: string, userId: string) {
  const hash = createHash("sha256").update(`feedback-survey:${campaignId}:${userId}`).digest("hex");
  const variant = ((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${variant}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

// ---------------------------------------------------------------------------------------------
// PostHog audience (racebook readers)
// ---------------------------------------------------------------------------------------------

const EXCLUDE_INTERNAL_PERSONS = `coalesce(toString(person.properties.$internal_or_test_user), '') != 'true'
    AND coalesce(toString(person.properties.role), '') != 'admin'`;

export const RACEBOOK_AUDIENCES_HOGQL = `SELECT
  toString(properties.event_id) AS event_id,
  argMax(toString(properties.event_name), timestamp) AS event_name,
  uniq(person_id) AS readers,
  max(timestamp) AS last_opened_at
FROM events
WHERE event = 'racebook opened'
  AND timestamp >= now() - INTERVAL 365 DAY
  AND toString(properties.event_id) != ''
  AND ${EXCLUDE_INTERNAL_PERSONS}
GROUP BY event_id
ORDER BY last_opened_at DESC
LIMIT 200`;

export const RACEBOOK_READER_IDS_HOGQL = `SELECT DISTINCT pdi.distinct_id AS distinct_id
FROM person_distinct_ids pdi
WHERE pdi.person_id IN (
  SELECT person_id
  FROM events
  WHERE event = 'racebook opened'
    AND toString(properties.event_id) = {event_id}
    AND ${EXCLUDE_INTERNAL_PERSONS}
)
  AND match(pdi.distinct_id, '${POSTHOG_SUPABASE_ID_REGEX}')
LIMIT ${MAX_AUDIENCE_SIZE}`;

const hogqlResponseSchema = z.object({
  columns: z.array(z.string()).optional(),
  results: z.array(z.array(z.unknown())),
});

async function runHogQL(query: string, values: Record<string, string> = {}) {
  let config: ReturnType<typeof getPostHogOrganizerAnalyticsConfig>;
  try {
    config = getPostHogOrganizerAnalyticsConfig();
  } catch {
    throw new FeedbackSurveyAudienceError("PostHog API configuration is missing.", "configuration");
  }
  const url = new URL(`/api/environments/${config.projectId}/query/`, config.apiHost);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query, values } }),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new FeedbackSurveyAudienceError(
      `PostHog query failed: ${error instanceof Error ? error.message : "network error"}`,
      "upstream"
    );
  });
  if (!response.ok) {
    throw new FeedbackSurveyAudienceError(`PostHog query returned HTTP ${response.status}.`, "upstream");
  }
  const parsed = hogqlResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new FeedbackSurveyAudienceError("PostHog returned an invalid response.", "response");
  const columns = parsed.data.columns ?? [];
  return parsed.data.results.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

export type RacebookAudience = {
  eventId: string;
  eventName: string;
  readers: number;
  lastOpenedAt: string | null;
};

export function parseRacebookAudiences(rows: Array<Record<string, unknown>>): RacebookAudience[] {
  return rows
    .map((row) => ({
      eventId: String(row.event_id ?? "").trim(),
      eventName: String(row.event_name ?? "").trim(),
      readers: Number(row.readers ?? 0),
      lastOpenedAt: row.last_opened_at ? String(row.last_opened_at) : null,
    }))
    .filter((audience) => audience.eventId && Number.isFinite(audience.readers))
    .map((audience) => ({ ...audience, eventName: audience.eventName || audience.eventId }));
}

export async function loadRacebookAudiences() {
  return parseRacebookAudiences(await runHogQL(RACEBOOK_AUDIENCES_HOGQL));
}

export function extractSupabaseUserIds(rows: Array<Record<string, unknown>>) {
  return [...new Set(rows.map((row) => row.distinct_id).filter(isSupabaseUserId).map((id) => id.toLowerCase()))];
}

export async function loadRacebookReaderUserIds(eventId: string) {
  return extractSupabaseUserIds(await runHogQL(RACEBOOK_READER_IDS_HOGQL, { event_id: eventId }));
}

// ---------------------------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------------------------

const recipientRowSchema = z.object({
  user_id: z.string().uuid(),
  has_email: z.boolean(),
  has_push: z.boolean(),
});

export type SurveyRecipient = { userId: string; hasEmail: boolean; hasPush: boolean };

export async function resolveSurveyRecipients(
  serviceConfig: SupabaseServiceConfig,
  candidateIds: string[]
): Promise<SurveyRecipient[]> {
  const recipients: SurveyRecipient[] = [];
  for (let index = 0; index < candidateIds.length; index += RESOLVE_CHUNK_SIZE) {
    const chunk = candidateIds.slice(index, index + RESOLVE_CHUNK_SIZE);
    const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/resolve_feedback_survey_recipients`, {
      method: "POST",
      headers: serviceHeaders(serviceConfig),
      body: JSON.stringify({ p_user_ids: chunk }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Unable to resolve survey recipients: ${await response.text()}`);
    const rows = z.array(recipientRowSchema).parse(await response.json());
    recipients.push(...rows.map((row) => ({ userId: row.user_id, hasEmail: row.has_email, hasPush: row.has_push })));
  }
  return recipients;
}

export function summarizeRecipients(candidateCount: number, recipients: SurveyRecipient[]) {
  return {
    identifiedReaders: candidateCount,
    recipients: recipients.length,
    withPush: recipients.filter((recipient) => recipient.hasPush).length,
    withEmail: recipients.filter((recipient) => recipient.hasEmail).length,
  };
}

export async function resolveSingleSurveyRecipient(
  serviceConfig: SupabaseServiceConfig,
  userId: string
): Promise<SurveyRecipient[]> {
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/resolve_feedback_survey_single_recipient`, {
    method: "POST",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify({ p_user_id: userId }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to resolve survey recipient: ${await response.text()}`);
  const rows = z.array(recipientRowSchema).parse(await response.json());
  return rows.map((row) => ({ userId: row.user_id, hasEmail: row.has_email, hasPush: row.has_push }));
}

export async function previewSingleUserAudience(serviceConfig: SupabaseServiceConfig, userId: string) {
  return summarizeRecipients(1, await resolveSingleSurveyRecipient(serviceConfig, userId));
}

export async function previewRacebookAudience(serviceConfig: SupabaseServiceConfig, eventId: string) {
  const candidates = await loadRacebookReaderUserIds(eventId);
  const recipients = await resolveSurveyRecipients(serviceConfig, candidates);
  return summarizeRecipients(candidates.length, recipients);
}

// ---------------------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------------------

export function campaignAudienceLabel(input: Pick<SurveySendInput, "eventLabel" | "userId" | "userLabel">) {
  const eventLabel = input.eventLabel?.trim() || null;
  if (!input.userId) return eventLabel;
  const target = input.userLabel?.trim() || input.userId;
  return `Test · ${target}${eventLabel ? ` · ${eventLabel}` : ""}`.slice(0, 200);
}

async function upsertCampaign(
  serviceConfig: SupabaseServiceConfig,
  input: SurveySendInput & { adminId: string; recipientCount: number }
) {
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/feedback_survey_campaigns?on_conflict=id`, {
    method: "POST",
    headers: { ...serviceHeaders(serviceConfig), Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      id: input.campaignId,
      created_by: input.adminId,
      title: input.title,
      body: input.body,
      audience_kind: input.userId ? "single_user" : "racebook_readers",
      audience_event_id: input.eventId ?? null,
      audience_user_id: input.userId ?? null,
      audience_label: campaignAudienceLabel(input),
      email_requested: input.sendEmail,
      push_requested: input.sendPush,
      recipient_count: input.recipientCount,
    }),
  });
  if (!response.ok) throw new Error(`Unable to create survey campaign: ${await response.text()}`);

  const existing = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/feedback_survey_campaigns?id=eq.${encodeURIComponent(input.campaignId)}&select=id,title,body,audience_event_id,audience_user_id,email_requested,push_requested&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );
  if (!existing.ok) throw new Error("Unable to load survey campaign.");
  const [campaign] = (await existing.json()) as Array<{
    title: string;
    body: string;
    audience_event_id: string | null;
    audience_user_id: string | null;
    email_requested: boolean;
    push_requested: boolean;
  }>;
  if (
    !campaign
    || campaign.title !== input.title
    || campaign.body !== input.body
    || campaign.audience_event_id !== (input.eventId ?? null)
    || campaign.audience_user_id !== (input.userId ?? null)
    || campaign.email_requested !== input.sendEmail
    || campaign.push_requested !== input.sendPush
  ) {
    throw new Error("Campaign id is already used by a different survey.");
  }
}

async function insertSurveyNotifications(
  serviceConfig: SupabaseServiceConfig,
  input: SurveySendInput & { adminId: string },
  recipients: SurveyRecipient[]
) {
  for (let index = 0; index < recipients.length; index += INSERT_CHUNK_SIZE) {
    const rows = recipients.slice(index, index + INSERT_CHUNK_SIZE).map((recipient) => ({
      id: surveyNotificationId(input.campaignId, recipient.userId),
      user_id: recipient.userId,
      created_by: input.adminId,
      survey_campaign_id: input.campaignId,
      kind: "feedback_survey",
      title: input.title,
      body: input.body,
      email_requested: input.sendEmail,
      email_status: input.sendEmail ? "pending" : "not_requested",
      push_requested: input.sendPush,
      push_status: input.sendPush ? "pending" : "not_requested",
    }));
    const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/user_notifications?on_conflict=id`, {
      method: "POST",
      headers: { ...serviceHeaders(serviceConfig), Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!response.ok) throw new Error(`Unable to create survey notifications: ${await response.text()}`);
  }
}

async function loadPendingSurveyNotifications(serviceConfig: SupabaseServiceConfig, campaignId: string) {
  const params = new URLSearchParams({
    select: "*",
    survey_campaign_id: `eq.${campaignId}`,
    or: "(push_status.eq.pending,email_status.eq.pending)",
    order: "id.asc",
    limit: String(PENDING_PAGE_SIZE),
  });
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/user_notifications?${params.toString()}`, {
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load pending survey notifications.");
  return z.array(adminUserNotificationRowSchema).parse(await response.json());
}

async function deliverWithConcurrency(
  serviceConfig: SupabaseServiceConfig,
  notifications: AdminUserNotificationRow[]
) {
  const summary = emptyDeliverySummary();
  let cursor = 0;
  const worker = async () => {
    while (cursor < notifications.length) {
      const notification = notifications[cursor++];
      try {
        const patch = await deliverAdminUserNotification(serviceConfig, notification);
        summary.delivered += 1;
        if (patch.push_status === "sent") summary.pushSent += 1;
        if (patch.push_status === "unavailable") summary.pushUnavailable += 1;
        if (patch.push_status === "failed" || patch.email_status === "failed") summary.failed += 1;
      } catch (error) {
        console.error("Unable to deliver survey notification", notification.id, error);
        summary.failed += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(DELIVERY_CONCURRENCY, notifications.length) }, worker));
  return summary;
}

export async function sendRacebookSurvey(
  serviceConfig: SupabaseServiceConfig,
  input: SurveySendInput & { adminId: string }
) {
  const candidates = input.userId
    ? [input.userId]
    : await loadRacebookReaderUserIds(input.eventId ?? "");
  const recipients = input.userId
    ? await resolveSingleSurveyRecipient(serviceConfig, input.userId)
    : await resolveSurveyRecipients(serviceConfig, candidates);
  if (input.userId && recipients.length === 0) throw new Error("This user account cannot receive surveys.");
  await upsertCampaign(serviceConfig, { ...input, recipientCount: recipients.length });
  await insertSurveyNotifications(serviceConfig, input, recipients);

  // Delivery moves each row out of `pending` (sent, failed or unavailable), so re-reading the first
  // page walks the whole campaign. The pass cap stops a row whose status write keeps failing.
  const delivery = emptyDeliverySummary();
  const seen = new Set<string>();
  const maxPasses = Math.ceil(recipients.length / PENDING_PAGE_SIZE) + 1;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const pending = (await loadPendingSurveyNotifications(serviceConfig, input.campaignId))
      .filter((notification) => !seen.has(notification.id));
    if (pending.length === 0) break;
    pending.forEach((notification) => seen.add(notification.id));
    const batch = await deliverWithConcurrency(serviceConfig, pending);
    delivery.delivered += batch.delivered;
    delivery.pushSent += batch.pushSent;
    delivery.pushUnavailable += batch.pushUnavailable;
    delivery.failed += batch.failed;
  }
  return { audience: summarizeRecipients(candidates.length, recipients), delivery };
}

function emptyDeliverySummary() {
  return { delivered: 0, pushSent: 0, pushUnavailable: 0, failed: 0 };
}

// ---------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------

const campaignRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  audience_kind: z.string(),
  audience_event_id: z.string().nullable(),
  audience_label: z.string().nullable(),
  email_requested: z.boolean(),
  push_requested: z.boolean(),
  recipient_count: z.coerce.number().int().nonnegative(),
  created_at: z.string(),
});

const statsRowSchema = z.object({
  campaign_id: z.string().uuid(),
  recipients: z.coerce.number().int().nonnegative(),
  read_count: z.coerce.number().int().nonnegative(),
  push_sent: z.coerce.number().int().nonnegative(),
  responses: z.coerce.number().int().nonnegative(),
  useful: z.coerce.number().int().nonnegative(),
});

const responseRowSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  found_useful: z.boolean(),
  useful_text: z.string().nullable(),
  missing_text: z.string().nullable(),
  app_version: z.string().nullable(),
  platform: z.string().nullable(),
  created_at: z.string(),
});

export type SurveyResponseRow = z.infer<typeof responseRowSchema>;

export type SurveyCampaignStats = {
  recipients: number;
  read: number;
  pushSent: number;
  responses: number;
  useful: number;
  notUseful: number;
};

export function buildCampaignStats(
  recipientCount: number,
  row: z.infer<typeof statsRowSchema> | undefined
): SurveyCampaignStats {
  const responses = row?.responses ?? 0;
  const useful = row?.useful ?? 0;
  return {
    recipients: Math.max(recipientCount, row?.recipients ?? 0),
    read: row?.read_count ?? 0,
    pushSent: row?.push_sent ?? 0,
    responses,
    useful,
    notUseful: Math.max(0, responses - useful),
  };
}

async function fetchRows<T>(serviceConfig: SupabaseServiceConfig, table: string, params: URLSearchParams, schema: z.ZodType<T>) {
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/${table}?${params.toString()}`, {
    headers: serviceHeaders(serviceConfig, ""),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load ${table}: ${await response.text()}`);
  return z.array(schema).parse(await response.json());
}

async function loadCampaignStats(serviceConfig: SupabaseServiceConfig, campaignIds: string[]) {
  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/rpc/feedback_survey_campaign_stats`, {
    method: "POST",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify({ p_campaign_ids: campaignIds }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load survey stats: ${await response.text()}`);
  return z.array(statsRowSchema).parse(await response.json());
}

export async function loadSurveyCampaigns(serviceConfig: SupabaseServiceConfig) {
  const campaigns = await fetchRows(
    serviceConfig,
    "feedback_survey_campaigns",
    new URLSearchParams({
      select: "id,title,body,audience_kind,audience_event_id,audience_label,email_requested,push_requested,recipient_count,created_at",
      order: "created_at.desc",
      limit: "50",
    }),
    campaignRowSchema
  );
  if (campaigns.length === 0) return [];
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const [stats, responses] = await Promise.all([
    loadCampaignStats(serviceConfig, campaignIds),
    fetchRows(
      serviceConfig,
      "feedback_survey_responses",
      new URLSearchParams({
        select: "id,campaign_id,user_id,found_useful,useful_text,missing_text,app_version,platform,created_at",
        campaign_id: `in.(${campaignIds.join(",")})`,
        order: "created_at.desc",
        limit: String(RESPONSES_LIMIT),
      }),
      responseRowSchema
    ),
  ]);
  const statsById = new Map(stats.map((row) => [row.campaign_id, row]));
  return campaigns.map((campaign) => ({
    id: campaign.id,
    title: campaign.title,
    body: campaign.body,
    audienceKind: campaign.audience_kind,
    audienceEventId: campaign.audience_event_id,
    audienceLabel: campaign.audience_label,
    emailRequested: campaign.email_requested,
    pushRequested: campaign.push_requested,
    createdAt: campaign.created_at,
    stats: buildCampaignStats(campaign.recipient_count, statsById.get(campaign.id)),
    responses: responses.filter((response) => response.campaign_id === campaign.id),
  }));
}
