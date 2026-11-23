import { z } from "zod";

import { addDays, REEL_SPACING_DAYS } from "./reel-planner";

/**
 * « À traiter » of the admin console (pure, shared by `GET /api/admin/inbox`, the dashboard card and
 * the `/admin/inbox` queue): every pending item of the human queues (bugs, feedback, race and demo
 * requests, organizer requests) and of the systems (failed flyovers, posts and renders, drafts to
 * review, missing race data, and since lot 3 the systems that are down: a scheduled task failed or late,
 * e-mails or Stripe webhook in error, see `lib/admin-system-health.ts`), mapped to one row with its type, title, context, age and the console
 * URL where it is handled. The queue only points the way: each item is processed in its own screen.
 *
 * Counted types (`counted: true`) make the « À traiter » total of the sidebar and the bell
 * (`/api/admin/inbox-counts` + `inboxTotals`). « Données de course » is listed but not counted: it is
 * preventive work and its computation reads the whole catalog, too heavy for the 30 s badge.
 */

export const INBOX_TYPES = [
  "bug",
  "feedback",
  "race_request",
  "demo",
  "organizer_claim",
  "publication_request",
  "edition_request",
  "flyover_failed",
  "post_failed",
  "post_draft",
  "render_failed",
  "system",
  "race_data",
] as const;
export type InboxType = (typeof INBOX_TYPES)[number];

export type InboxTone = "red" | "orange" | "blue" | "green" | "lime";

type InboxTypeConfig = {
  /** Short label of the chip and of the row. */
  label: string;
  /** `?filtre=` value of the queue. */
  slug: string;
  /** Verb of the row button. */
  action: string;
  tone: InboxTone;
  /** Age (hours) after which the item is late (red). Race data uses its deadline instead. */
  lateAfterHours: number;
  /** Part of the « À traiter » total (sidebar, bell). */
  counted: boolean;
  /** System failures are « hot » chips like the organizer requests. */
  group: "messages" | "organizers" | "system" | "data";
};

export const INBOX_TYPE_CONFIG: Record<InboxType, InboxTypeConfig> = {
  bug: { label: "Bugs", slug: "bugs", action: "Répondre", tone: "red", lateAfterHours: 24, counted: true, group: "messages" },
  feedback: { label: "Feedback", slug: "feedback", action: "Répondre", tone: "blue", lateAfterHours: 72, counted: true, group: "messages" },
  race_request: { label: "Demandes de course", slug: "demandes", action: "Traiter", tone: "green", lateAfterHours: 72, counted: true, group: "messages" },
  demo: { label: "Démos organisateurs", slug: "demos", action: "Traiter", tone: "orange", lateAfterHours: 24, counted: true, group: "messages" },
  organizer_claim: { label: "Demandes d’accès", slug: "acces", action: "Examiner", tone: "blue", lateAfterHours: 48, counted: true, group: "organizers" },
  publication_request: { label: "Demandes de publication", slug: "publication", action: "Examiner", tone: "orange", lateAfterHours: 48, counted: true, group: "organizers" },
  edition_request: { label: "Nouvelles éditions", slug: "editions", action: "Examiner", tone: "orange", lateAfterHours: 48, counted: true, group: "organizers" },
  flyover_failed: { label: "Survols en échec", slug: "survols", action: "Relancer", tone: "red", lateAfterHours: 4, counted: true, group: "system" },
  post_failed: { label: "Publications en échec", slug: "publications", action: "Corriger", tone: "red", lateAfterHours: 12, counted: true, group: "system" },
  post_draft: { label: "Brouillons à relire", slug: "brouillons", action: "Relire", tone: "lime", lateAfterHours: 48, counted: true, group: "system" },
  render_failed: { label: "Rendus échoués (24 h)", slug: "rendus", action: "Voir", tone: "red", lateAfterHours: 12, counted: true, group: "system" },
  system: { label: "Système", slug: "systeme", action: "Voir", tone: "red", lateAfterHours: 2, counted: true, group: "system" },
  race_data: { label: "Données de course", slug: "donnees", action: "Corriger", tone: "lime", lateAfterHours: 0, counted: false, group: "data" },
};

/** A race data gap is late when its reel deadline is this close (days). */
export const RACE_DATA_LATE_DAYS = 3;

export const inboxItemSchema = z.object({
  /** `<type>:<source id>`, unique in the queue. */
  id: z.string(),
  type: z.enum(INBOX_TYPES),
  title: z.string(),
  context: z.string(),
  /** When the item started waiting (ISO); null for race data, which waits for a deadline. */
  since: z.string().nullable(),
  /** Race data: last day the data can arrive for the reel (YYYY-MM-DD). */
  dueDate: z.string().nullable().default(null),
  href: z.string(),
});
export type InboxItem = z.infer<typeof inboxItemSchema>;

export const inboxSourceStateSchema = z.object({
  key: z.string(),
  label: z.string(),
  ok: z.boolean(),
  message: z.string().nullable(),
});
export type InboxSourceState = z.infer<typeof inboxSourceStateSchema>;

export const inboxResponseSchema = z.object({
  generatedAt: z.string(),
  today: z.string(),
  items: z.array(inboxItemSchema),
  /** One entry per source read; a source that failed leaves its items out and says why. */
  sources: z.array(inboxSourceStateSchema),
});
export type InboxResponse = z.infer<typeof inboxResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Console URLs (where each item is handled)

const withParams = (path: string, params: Record<string, string>) => `${path}?${new URLSearchParams(params).toString()}`;

/** Same URLs as `publicationTargetHref` (Publications) and `raceEditHref` (catalog). */
export const inboxHref = {
  messaging: (view: "bugs" | "feedback" | "demandes" | "demos") => withParams("/admin/inbox", { vue: view }),
  organizerAccess: () => "/admin/organizers?vue=acces",
  organizerPublication: () => "/admin/organizers",
  flyovers: () => "/admin/content/flyovers",
  post: (postId: string, mediaType: "reel" | "carousel") =>
    withParams("/admin/content/posts", mediaType === "carousel" ? { onglet: "carousels", post: postId } : { post: postId }),
  renders: (renderId?: string) => (renderId ? `/admin/content/renders?rendu=${encodeURIComponent(renderId)}` : "/admin/content/renders"),
  race: (raceId: string) => withParams("/admin/catalog/races", { course: raceId }),
};

// ---------------------------------------------------------------------------------------------
// Source rows → items

const trimmed = (value: string | null | undefined) => value?.trim() || null;
const join = (...parts: Array<string | null | undefined>) => parts.map(trimmed).filter(Boolean).join(" · ");
const quoted = (value: string) => `« ${value} »`;

export type FeedbackSourceRow = { id: number; created_at: string; kind: "bug" | "feedback"; subject: string; source: string | null; screen: string | null };
export const feedbackToItem = (row: FeedbackSourceRow): InboxItem => ({
  id: `${row.kind}:${row.id}`,
  type: row.kind,
  title: quoted(row.subject.replace(/^\[(bug|feedback)\]\s*/i, "") || "Sans objet"),
  context: join(row.kind === "bug" ? "Bug" : "Feedback", row.source, row.screen),
  since: row.created_at,
  dueDate: null,
  href: inboxHref.messaging(row.kind === "bug" ? "bugs" : "feedback"),
});

export type RaceRequestSourceRow = { id: number; created_at: string; race_name: string; location: string | null; requested_date: string | null };
export const raceRequestToItem = (row: RaceRequestSourceRow): InboxItem => ({
  id: `race_request:${row.id}`,
  type: "race_request",
  title: `Demande de course · ${row.race_name}`,
  context: join("Coureur", row.location, row.requested_date),
  since: row.created_at,
  dueDate: null,
  href: inboxHref.messaging("demandes"),
});

export type DemoSourceRow = { id: string; created_at: string; email: string; race_url: string };
export const demoToItem = (row: DemoSourceRow): InboxItem => ({
  id: `demo:${row.id}`,
  type: "demo",
  title: `Démo demandée · ${row.email}`,
  context: join("Organisateur", row.race_url),
  since: row.created_at,
  dueDate: null,
  href: inboxHref.messaging("demos"),
});

type EventRef = { name: string } | null | undefined;

export type ClaimSourceRow = { id: string; created_at: string; organization_name: string; contact_email: string; race_events?: EventRef };
export const claimToItem = (row: ClaimSourceRow): InboxItem => ({
  id: `organizer_claim:${row.id}`,
  type: "organizer_claim",
  title: `Demande d’accès · ${row.race_events?.name ?? row.organization_name}`,
  context: join("Organisateur", row.organization_name, row.contact_email),
  since: row.created_at,
  dueDate: null,
  href: inboxHref.organizerAccess(),
});

export type PublicationRequestSourceRow = { id: string; created_at: string; race_events?: EventRef; requested_race?: EventRef };
export const publicationRequestToItem = (row: PublicationRequestSourceRow): InboxItem => ({
  id: `publication_request:${row.id}`,
  type: "publication_request",
  title: `Demande de publication · ${row.race_events?.name ?? "Événement"}`,
  context: join("Organisateur", row.requested_race?.name ? `format ${row.requested_race.name}` : "livret de l’édition"),
  since: row.created_at,
  dueDate: null,
  href: inboxHref.organizerPublication(),
});

export type EditionRequestSourceRow = { id: string; created_at: string; source_year: number; requested_start_date: string; race_events?: EventRef };
export const editionRequestToItem = (row: EditionRequestSourceRow): InboxItem => ({
  id: `edition_request:${row.id}`,
  type: "edition_request",
  title: `Nouvelle édition · ${row.race_events?.name ?? "Événement"}`,
  context: join("Organisateur", `à partir de ${row.source_year}`, `départ le ${row.requested_start_date}`),
  since: row.created_at,
  dueDate: null,
  href: inboxHref.organizerPublication(),
});

export type FailedFlyoverSourceRow = { id: string; race_name: string; offer: string; error: string | null; updated_at: string };
export const failedFlyoverToItem = (row: FailedFlyoverSourceRow): InboxItem => ({
  id: `flyover_failed:${row.id}`,
  type: "flyover_failed",
  title: `Survol ${quoted(row.race_name)} en échec`,
  context: join("Vidéo de survol", row.offer === "collab" ? "publication en collaboration" : "MP4 à télécharger", row.error),
  since: row.updated_at,
  dueDate: null,
  href: inboxHref.flyovers(),
});

export const CAROUSEL_SERIES_LABELS = { plan: "Le plan chiffré", brief: "Le brief", week: "La semaine qui vient" } as const;

export type PostSourceRow = {
  id: string;
  status: "failed" | "draft";
  media_type: "reel" | "carousel";
  carousel_series: keyof typeof CAROUSEL_SERIES_LABELS | null;
  error: string | null;
  auto_generated: boolean;
  dry_run: boolean;
  created_at: string;
  updated_at: string;
  races?: EventRef;
};
const postName = (row: Pick<PostSourceRow, "media_type" | "carousel_series" | "races">) =>
  row.media_type === "carousel"
    ? join(`Carrousel ${row.carousel_series ? CAROUSEL_SERIES_LABELS[row.carousel_series] : ""}`.trim(), row.races?.name)
    : join("Reel", row.races?.name);
export const postToItem = (row: PostSourceRow): InboxItem =>
  row.status === "failed"
    ? {
      id: `post_failed:${row.id}`,
      type: "post_failed",
      title: `Publication en échec · ${postName(row)}`,
      context: join("Instagram", row.dry_run ? "simulation" : null, row.error ?? "raison inconnue"),
      since: row.updated_at,
      dueDate: null,
      href: inboxHref.post(row.id, row.media_type),
    }
    : {
      id: `post_draft:${row.id}`,
      type: "post_draft",
      title: `Brouillon à relire · ${postName(row)}`,
      context: join("Instagram", row.auto_generated ? "brouillon automatique" : "brouillon"),
      since: row.created_at,
      dueDate: null,
      href: inboxHref.post(row.id, row.media_type),
    };

export type FailedRenderSource = { id: string; kind: "reel" | "carousel"; title: string; stage: string; createdAt: string; finishedAt: string | null };
export const failedRenderToItem = (render: FailedRenderSource): InboxItem => ({
  id: `render_failed:${render.kind}:${render.id}`,
  type: "render_failed",
  title: `Rendu échoué · ${render.title}`,
  context: join(render.kind === "carousel" ? "Rendu de carrousel" : "Rendu de reel", render.stage.replace(/^Échec : /, "")),
  since: render.finishedAt ?? render.createdAt,
  dueDate: null,
  href: inboxHref.renders(render.id),
});

/** Same window as the Rendus page and « À surveiller » (failures of the last 24 h). */
export const isRecentRenderFailure = (render: { status: string; createdAt: string; finishedAt: string | null }, nowMs: number, windowMs: number) =>
  render.status === "failed" && nowMs - Date.parse(render.finishedAt ?? render.createdAt) <= windowMs;

const MISSING_LABELS = { gpx: "GPX", aid_stations: "ravitaillements", elevation_gain: "D+" } as const;
export type RaceDataGapSource = {
  raceId: string;
  date: string;
  eventName: string | null;
  name: string;
  distanceKm: number;
  missing: Array<keyof typeof MISSING_LABELS>;
  unlocks: Array<"reel" | "plan" | "brief">;
  reelDeadline: string | null;
  reelTooLate: boolean;
};

/** Only the gaps that still keep a reel from being made (a reel needs a GPX); the others stay in « Qualité des données ». */
export const raceDataGapToItem = (gap: RaceDataGapSource): InboxItem | null => {
  if (!gap.unlocks.includes("reel") || !gap.reelDeadline || gap.reelTooLate) return null;
  const missing = gap.missing.map((key) => MISSING_LABELS[key]).join(", ");
  const name = gap.eventName && !gap.name.includes(gap.eventName) ? `${gap.eventName} · ${gap.name}` : gap.name;
  return {
    id: `race_data:${gap.raceId}`,
    type: "race_data",
    title: `${missing.charAt(0).toUpperCase()}${missing.slice(1)} manquant${gap.missing.length > 1 ? "s" : ""} · ${name}`,
    context: join("Données de course", `reel possible le ${formatShortDay(addDays(gap.date, -REEL_SPACING_DAYS))}`, `course le ${formatShortDay(gap.date)}`),
    since: null,
    dueDate: gap.reelDeadline,
    href: inboxHref.race(gap.raceId),
  };
};

// ---------------------------------------------------------------------------------------------
// Age, sort, filters, counts

const shortDayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
/** « 4 déc. » for a YYYY-MM-DD day. */
export const formatShortDay = (day: string) => shortDayFormat.format(new Date(`${day}T12:00:00Z`));

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** « depuis 3 j », « depuis 2 h », « depuis 12 min », « à l’instant ». */
export const formatWaitingSince = (sinceIso: string, nowMs: number) => {
  const minutes = Math.max(0, Math.floor((nowMs - Date.parse(sinceIso)) / 60_000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `depuis ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `depuis ${hours} h`;
  return `depuis ${Math.floor(hours / 24)} j`;
};

export type InboxAge = { label: string; late: boolean; title: string };

/** Age shown on a row, and whether it is late for its type (red). */
export const inboxItemAge = (item: Pick<InboxItem, "type" | "since" | "dueDate">, nowMs: number, today: string): InboxAge => {
  if (item.since) {
    const hours = (nowMs - Date.parse(item.since)) / 3_600_000;
    return {
      label: formatWaitingSince(item.since, nowMs),
      late: hours >= INBOX_TYPE_CONFIG[item.type].lateAfterHours,
      title: new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(item.since)),
    };
  }
  if (item.dueDate) {
    return {
      label: `avant le ${formatShortDay(item.dueDate)}`,
      late: dayDiff(today, item.dueDate) <= RACE_DATA_LATE_DAYS,
      title: `Données attendues avant le ${formatShortDay(item.dueDate)} pour que le reel soit généré`,
    };
  }
  return { label: "", late: false, title: "" };
};

/** Oldest first; items waiting for a deadline (race data) after them, soonest deadline first. */
export const sortInboxItems = (items: InboxItem[]) =>
  [...items].sort((left, right) => {
    if (left.since && right.since) return left.since.localeCompare(right.since) || left.id.localeCompare(right.id);
    if (left.since) return -1;
    if (right.since) return 1;
    return (left.dueDate ?? "").localeCompare(right.dueDate ?? "") || left.id.localeCompare(right.id);
  });

export type InboxCountsByType = Record<InboxType, number>;

export const countInboxByType = (items: InboxItem[]): InboxCountsByType => {
  const counts = Object.fromEntries(INBOX_TYPES.map((type) => [type, 0])) as InboxCountsByType;
  items.forEach((item) => {
    counts[item.type] += 1;
  });
  return counts;
};

/** Total of the counted types (the badge of the sidebar and the bell). */
export const countedInboxTotal = (counts: Partial<InboxCountsByType>) =>
  INBOX_TYPES.reduce((total, type) => total + (INBOX_TYPE_CONFIG[type].counted ? counts[type] ?? 0 : 0), 0);

/** `?filtre=bugs,survols` → types (unknown slugs ignored); empty means every type. */
export const readInboxFilter = (value: string | null | undefined): InboxType[] => {
  const slugs = new Set((value ?? "").split(",").map((slug) => slug.trim()).filter(Boolean));
  return INBOX_TYPES.filter((type) => slugs.has(INBOX_TYPE_CONFIG[type].slug));
};

export const writeInboxFilter = (types: InboxType[]) => INBOX_TYPES.filter((type) => types.includes(type)).map((type) => INBOX_TYPE_CONFIG[type].slug).join(",");

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Items of the selected types whose title, context or type label contain every word of the search. */
export const filterInboxItems = (items: InboxItem[], { types, search }: { types: InboxType[]; search: string }) => {
  const words = fold(search).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (types.length && !types.includes(item.type)) return false;
    if (!words.length) return true;
    const haystack = fold(`${item.title} ${item.context} ${INBOX_TYPE_CONFIG[item.type].label}`);
    return words.every((word) => haystack.includes(word));
  });
};
