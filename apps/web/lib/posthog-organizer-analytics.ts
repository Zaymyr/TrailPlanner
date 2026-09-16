import { z } from "zod";

export const organizerAnalyticsRangeSchema = z.enum(["7d", "30d", "90d"]);
export type OrganizerAnalyticsRange = z.infer<typeof organizerAnalyticsRangeSchema>;

export const ORGANIZER_ANALYTICS_CACHE_TTL_SECONDS = 15 * 60;
export const DEFAULT_ORGANIZER_ANALYTICS_ENDPOINT = "organizer-racebook-analytics";

// Copy the string contents into a PostHog SQL Endpoint. Keep the Endpoint variables typed as String.
export const ORGANIZER_RACEBOOK_ANALYTICS_HOGQL = `WITH
  toString({variables.event_id}) AS requested_event_id,
  toString({variables.edition_id}) AS requested_edition_id,
  toString({variables.edition_start_date}) AS edition_start_date,
  toString({variables.edition_end_date}) AS edition_end_date,
  splitByChar(',', toString({variables.race_ids_csv})) AS allowed_race_ids,
  toString({variables.race_id}) AS selected_race_id,
  toDateTime(concat(toString({variables.date_from}), ' 00:00:00'), 'UTC') AS range_start,
  toDateTime(concat(toString({variables.date_to}), ' 00:00:00'), 'UTC') + INTERVAL 1 DAY AS range_end_exclusive
SELECT
  'summary' AS kind,
  '' AS date,
  uniqIf(person_id, event = 'racebook opened') AS unique_readers,
  countIf(event = 'racebook opened') AS total_opens,
  if(
    countIf(event = 'racebook closed') = 0,
    null,
    avgIf(toFloat(properties.active_duration_seconds), event = 'racebook closed')
  ) AS average_active_seconds,
  if(
    countIf(event = 'racebook closed') = 0,
    null,
    countIf(event = 'racebook closed' AND properties.engaged = true)
      / countIf(event = 'racebook closed')
  ) AS engagement_rate
FROM events
WHERE timestamp >= range_start
  AND timestamp < range_end_exclusive
  AND event IN ('racebook opened', 'racebook closed')
  AND properties.event_id = requested_event_id
  AND has(allowed_race_ids, toString(properties.race_id))
  AND (selected_race_id = '' OR properties.race_id = selected_race_id)
  AND requested_edition_id != ''
  AND toDate(properties.race_date) >= toDate(edition_start_date)
  AND toDate(properties.race_date) <= toDate(edition_end_date)
  AND person_id NOT IN (
    SELECT id FROM persons WHERE properties.$internal_or_test_user = true
  )
UNION ALL
SELECT
  'daily' AS kind,
  toString(toDate(toTimeZone(timestamp, 'UTC'))) AS date,
  uniq(person_id) AS unique_readers,
  count() AS total_opens,
  null AS average_active_seconds,
  null AS engagement_rate
FROM events
WHERE timestamp >= range_start
  AND timestamp < range_end_exclusive
  AND event = 'racebook opened'
  AND properties.event_id = requested_event_id
  AND has(allowed_race_ids, toString(properties.race_id))
  AND (selected_race_id = '' OR properties.race_id = selected_race_id)
  AND requested_edition_id != ''
  AND toDate(properties.race_date) >= toDate(edition_start_date)
  AND toDate(properties.race_date) <= toDate(edition_end_date)
  AND person_id NOT IN (
    SELECT id FROM persons WHERE properties.$internal_or_test_user = true
  )
GROUP BY date
ORDER BY kind DESC, date
LIMIT 100`;

export type OrganizerAnalyticsAccess = {
  allowed: boolean;
  source: "tier" | "complimentary" | null;
};

export type OrganizerAnalyticsSummary = {
  uniqueReaders: number;
  totalOpens: number;
  averageActiveSeconds: number | null;
  engagementRate: number | null;
};

export type OrganizerAnalyticsDay = {
  date: string;
  uniqueReaders: number;
  totalOpens: number;
};

export type OrganizerAnalyticsPayload = {
  access: OrganizerAnalyticsAccess & { allowed: true };
  range: OrganizerAnalyticsRange;
  raceId: string | null;
  timing: {
    from: string;
    to: string;
    generatedAt: string;
    cacheTtlSeconds: number;
  };
  summary: OrganizerAnalyticsSummary;
  daily: OrganizerAnalyticsDay[];
};

type PostHogOrganizerAnalyticsInput = {
  eventId: string;
  editionId: string;
  editionStartDate: string;
  editionEndDate: string;
  raceIds: string[];
  selectedRaceId: string | null;
  dateFrom: string;
  dateTo: string;
};

const endpointResponseSchema = z.object({
  results: z.array(z.record(z.unknown())),
  columns: z.array(z.string()).optional(),
  hasMore: z.boolean().optional(),
});

const endpointRowSchema = z.object({
  kind: z.enum(["summary", "daily"]),
  date: z.string().nullable().optional(),
  unique_readers: z.coerce.number().int().nonnegative(),
  total_opens: z.coerce.number().int().nonnegative(),
  average_active_seconds: z.union([z.null(), z.coerce.number().nonnegative()]).optional().default(null),
  engagement_rate: z.union([z.null(), z.coerce.number().min(0).max(1)]).optional().default(null),
});

const postHogConfigSchema = z.object({
  apiKey: z.string().min(1),
  projectId: z.string().regex(/^\d+$/),
  apiHost: z.string().url().refine((value) => value.startsWith("https://"), "PostHog API host must use HTTPS."),
  endpointName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/),
});

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export class PostHogOrganizerAnalyticsError extends Error {
  constructor(message: string, readonly reason: "configuration" | "upstream" | "response") {
    super(message);
    this.name = "PostHogOrganizerAnalyticsError";
  }
}

export function getPostHogOrganizerAnalyticsConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = postHogConfigSchema.safeParse({
    apiKey: env.POSTHOG_API_KEY,
    projectId: env.POSTHOG_PROJECT_ID,
    apiHost: env.POSTHOG_API_HOST,
    endpointName: env.POSTHOG_ORGANIZER_ANALYTICS_ENDPOINT ?? DEFAULT_ORGANIZER_ANALYTICS_ENDPOINT,
  });

  if (!parsed.success) {
    throw new PostHogOrganizerAnalyticsError("PostHog organizer analytics configuration is missing or invalid.", "configuration");
  }

  const url = new URL(parsed.data.apiHost);
  if (url.username || url.password || (url.pathname !== "/" && url.pathname !== "")) {
    throw new PostHogOrganizerAnalyticsError("PostHog API host must be an origin without credentials or a path.", "configuration");
  }

  return { ...parsed.data, apiHost: url.origin };
}

export function buildOrganizerAnalyticsWindow(range: OrganizerAnalyticsRange, now = new Date()) {
  const days = Number.parseInt(range, 10);
  const dateTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dateFrom = new Date(dateTo);
  dateFrom.setUTCDate(dateFrom.getUTCDate() - days + 1);
  return {
    from: dateFrom.toISOString().slice(0, 10),
    to: dateTo.toISOString().slice(0, 10),
  };
}

const emptySummary = (): OrganizerAnalyticsSummary => ({
  uniqueReaders: 0,
  totalOpens: 0,
  averageActiveSeconds: null,
  engagementRate: null,
});

export async function loadPostHogOrganizerAnalytics(
  input: PostHogOrganizerAnalyticsInput,
  config = getPostHogOrganizerAnalyticsConfig(),
): Promise<{ summary: OrganizerAnalyticsSummary; daily: OrganizerAnalyticsDay[] }> {
  dateOnlySchema.parse(input.dateFrom);
  dateOnlySchema.parse(input.dateTo);

  if (input.raceIds.length === 0) return { summary: emptySummary(), daily: [] };

  const endpointUrl = new URL(
    `/api/environments/${config.projectId}/endpoints/${encodeURIComponent(config.endpointName)}/run`,
    config.apiHost,
  );
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh: "cache",
      variables: {
        event_id: input.eventId,
        edition_id: input.editionId,
        edition_start_date: input.editionStartDate,
        edition_end_date: input.editionEndDate,
        race_ids_csv: input.raceIds.join(","),
        race_id: input.selectedRaceId ?? "",
        date_from: input.dateFrom,
        date_to: input.dateTo,
      },
    }),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new PostHogOrganizerAnalyticsError(
      `PostHog organizer analytics request failed: ${error instanceof Error ? error.message : "network error"}`,
      "upstream",
    );
  });

  if (!response.ok) {
    throw new PostHogOrganizerAnalyticsError(`PostHog organizer analytics returned HTTP ${response.status}.`, "upstream");
  }

  const endpointResponse = endpointResponseSchema.safeParse(await response.json().catch(() => null));
  if (!endpointResponse.success) {
    throw new PostHogOrganizerAnalyticsError("PostHog organizer analytics returned an invalid response.", "response");
  }

  const rows = z.array(endpointRowSchema).safeParse(endpointResponse.data.results);
  if (!rows.success) {
    throw new PostHogOrganizerAnalyticsError("PostHog organizer analytics rows do not match the endpoint contract.", "response");
  }

  const summaryRow = rows.data.find((row) => row.kind === "summary");
  if (!summaryRow) {
    throw new PostHogOrganizerAnalyticsError("PostHog organizer analytics response has no summary row.", "response");
  }

  const daily = rows.data
    .filter((row) => row.kind === "daily" && row.date)
    .map((row) => ({
      date: dateOnlySchema.parse(row.date),
      uniqueReaders: row.unique_readers,
      totalOpens: row.total_opens,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  return {
    summary: {
      uniqueReaders: summaryRow.unique_readers,
      totalOpens: summaryRow.total_opens,
      averageActiveSeconds: summaryRow.average_active_seconds,
      engagementRate: summaryRow.engagement_rate,
    },
    daily,
  };
}
