import { z } from "zod";

import { csvCell } from "./admin-billing";

/**
 * Admin action journal (`public.admin_audit_log`), pure and tested: action catalogue (French labels,
 * families, importance), sanitisation of the `before` / `after` documents (no secret, no full e-mail,
 * no message content), read filters, target links, before/after diff, CSV. Written by
 * `lib/admin-audit-log.ts`, read by `GET /api/admin/audit` and the `/admin/system/audit` page.
 */

export const AUDIT_STATUSES = ["ok", "error"] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = { ok: "Réussie", error: "Échec" };
/** `?statut=` values (French, as in the URL). */
export const AUDIT_STATUS_PARAM: Record<AuditStatus, string> = { ok: "reussie", error: "echec" };

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_LIMIT = 5_000;
export const AUDIT_RETENTION_DAYS = 365;

// ---------------------------------------------------------------------------------------------
// Families and actions

export type AuditTone = "neutral" | "info" | "success" | "warning" | "danger";

export const AUDIT_FAMILIES = {
  premium: { label: "Premium", tone: "info" },
  user: { label: "Comptes et rôles", tone: "info" },
  message: { label: "Messages", tone: "neutral" },
  support: { label: "Retours et demandes", tone: "neutral" },
  organizer: { label: "Organisateurs", tone: "info" },
  edition: { label: "Éditions et packs", tone: "info" },
  billing: { label: "Facturation", tone: "warning" },
  catalog: { label: "Catalogue", tone: "success" },
  product: { label: "Produits", tone: "success" },
  partner: { label: "Liens partenaires", tone: "neutral" },
  proof: { label: "Preuves sociales", tone: "neutral" },
  content: { label: "Publications", tone: "success" },
  automation: { label: "Automatisations", tone: "warning" },
  render: { label: "Rendus et studio", tone: "neutral" },
  flyover: { label: "Survols", tone: "neutral" },
  survey: { label: "Questionnaires", tone: "neutral" },
  maintenance: { label: "Maintenance", tone: "danger" },
  simulation: { label: "Simulation", tone: "neutral" },
} as const satisfies Record<string, { label: string; tone: AuditTone }>;
export type AuditFamily = keyof typeof AUDIT_FAMILIES;

type ActionDefinition = { label: string; family: AuditFamily; important?: boolean };

/**
 * Every action written by the admin routes: key `domaine.verbe`, French label, family (badge) and
 * whether it shows in the « Activité récente » feed of the overview. A test checks that each action
 * used in a route is listed here.
 */
export const AUDIT_ACTIONS = {
  "premium.grant": { label: "Premium accordé", family: "premium", important: true },
  "premium.update": { label: "Premium modifié", family: "premium", important: true },
  "premium.revoke": { label: "Premium révoqué", family: "premium", important: true },
  "user.role": { label: "Rôles modifiés", family: "user", important: true },
  "message.send": { label: "Message envoyé", family: "message" },
  "feedback.status": { label: "Bug ou retour traité", family: "support" },
  "race-request.status": { label: "Demande de course traitée", family: "support" },
  "organizer.claim": { label: "Accès organisateur modifié", family: "organizer", important: true },
  "organizer.demo": { label: "Démo organisateur traitée", family: "organizer" },
  "organizer.social-proof": { label: "Preuves sociales modifiées", family: "proof" },
  "edition.publication": { label: "Publication du livret traitée", family: "edition", important: true },
  "edition.pack": { label: "Pack ou modules modifiés", family: "edition", important: true },
  "edition.module-catalog": { label: "Catalogue des modules modifié", family: "edition" },
  "billing.invoice-create": { label: "Facture créée", family: "billing", important: true },
  "billing.invoice-pdf": { label: "Facture régénérée", family: "billing" },
  "billing.invoice-settle": { label: "Facture réglée", family: "billing", important: true },
  "billing.payment-create": { label: "Virement enregistré", family: "billing", important: true },
  "billing.payment-invoice": { label: "Facture de virement générée", family: "billing", important: true },
  "catalog.race-create": { label: "Course créée", family: "catalog" },
  "catalog.race-import": { label: "Course importée", family: "catalog" },
  "catalog.race-update": { label: "Course modifiée", family: "catalog" },
  "catalog.race-delete": { label: "Course supprimée", family: "catalog", important: true },
  "catalog.event-import": { label: "Import depuis le site de l’organisateur", family: "catalog" },
  "catalog.event-update": { label: "Événement modifié", family: "catalog" },
  "catalog.gpx": { label: "GPX remplacé", family: "catalog" },
  "catalog.aid-stations": { label: "Ravitaillements remplacés", family: "catalog" },
  "catalog.image": { label: "Image remplacée", family: "catalog" },
  "product.create": { label: "Produit créé", family: "product" },
  "product.import": { label: "Catalogue de produits importé", family: "product", important: true },
  "product.update": { label: "Produit modifié", family: "product" },
  "product.delete": { label: "Produit supprimé", family: "product", important: true },
  "product.image": { label: "Image de produit remplacée", family: "product" },
  "partner.links": { label: "Liens partenaires modifiés", family: "partner" },
  "content.post-create": { label: "Publication créée", family: "content" },
  "content.post-update": { label: "Publication modifiée", family: "content" },
  "content.post-schedule": { label: "Publication programmée", family: "content", important: true },
  "content.post-publish": { label: "Publication publiée", family: "content", important: true },
  "content.post-delete": { label: "Publication supprimée", family: "content", important: true },
  "automation.reel-settings": { label: "Automatisation des reels modifiée", family: "automation", important: true },
  "automation.reel-run": { label: "Reel automatique lancé", family: "automation" },
  "automation.reel-item": { label: "Élément de reel modifié", family: "automation" },
  "automation.carousel-settings": { label: "Automatisation des carrousels modifiée", family: "automation", important: true },
  "automation.carousel-run": { label: "Carrousel automatique lancé", family: "automation" },
  "automation.carousel-item": { label: "Élément de carrousel modifié", family: "automation" },
  "render.create": { label: "Rendu lancé", family: "render" },
  "render.start": { label: "Rendu démarré", family: "render" },
  "render.delete": { label: "Rendu supprimé", family: "render", important: true },
  "render.narration": { label: "Narration enregistrée", family: "render" },
  "render.voice-create": { label: "Voix ajoutée", family: "render" },
  "render.voice-update": { label: "Voix modifiée", family: "render" },
  "render.voice-delete": { label: "Voix supprimée", family: "render" },
  "flyover.order": { label: "Commande de survol modifiée", family: "flyover" },
  "survey.send": { label: "Questionnaire envoyé", family: "survey", important: true },
  "maintenance.resend-sync": { label: "Synchro Resend", family: "maintenance", important: true },
  "maintenance.livret-backfill": { label: "Rattrapage des livrets", family: "maintenance", important: true },
  "maintenance.livret-cleanup": { label: "Nettoyage des livrets", family: "maintenance", important: true },
  "maintenance.cron-run": { label: "Tâche planifiée relancée", family: "maintenance", important: true },
  "simulation.runner-mode": { label: "Mode de simulation des droits", family: "simulation" },
} as const satisfies Record<string, ActionDefinition>;
export type AuditActionKey = keyof typeof AUDIT_ACTIONS;

export const isKnownAuditAction = (action: string): action is AuditActionKey => action in AUDIT_ACTIONS;

export const auditFamilyOf = (action: string): AuditFamily => {
  const known = (AUDIT_ACTIONS as Record<string, ActionDefinition>)[action];
  if (known) return known.family;
  const prefix = action.split(".")[0] as AuditFamily;
  return prefix in AUDIT_FAMILIES ? prefix : "maintenance";
};

export const auditActionLabel = (action: string): string =>
  (AUDIT_ACTIONS as Record<string, ActionDefinition>)[action]?.label ?? `Action « ${action} »`;

export const isImportantAuditAction = (action: string, status: AuditStatus = "ok"): boolean =>
  status === "error" || Boolean((AUDIT_ACTIONS as Record<string, ActionDefinition>)[action]?.important);

/** Actions to ask the database for to get the « important » ones (feed of the overview). */
export const IMPORTANT_AUDIT_ACTIONS: string[] = Object.entries(AUDIT_ACTIONS as Record<string, ActionDefinition>)
  .filter(([, definition]) => definition.important)
  .map(([key]) => key);

// ---------------------------------------------------------------------------------------------
// Targets

export const AUDIT_TARGET_TYPES = {
  user: "Coureur",
  "premium-grant": "Attribution Premium",
  edition: "Édition",
  organizer: "Accès organisateur",
  race: "Course",
  event: "Événement",
  product: "Produit",
  post: "Publication",
  render: "Rendu",
  flyover: "Commande de survol",
  invoice: "Facture",
  payment: "Paiement",
  feedback: "Bug ou retour",
  "race-request": "Demande de course",
  demo: "Démo organisateur",
  voice: "Voix",
  survey: "Questionnaire",
  module: "Module du livret",
  publication: "Demande de publication",
  automation: "Automatisation",
  partner: "Lien partenaire",
  proof: "Preuve sociale",
  system: "Système",
  simulation: "Simulation",
} as const;
export type AuditTargetType = keyof typeof AUDIT_TARGET_TYPES;

export const auditTargetTypeLabel = (type: string) => (AUDIT_TARGET_TYPES as Record<string, string>)[type] ?? type;

const SAFE_ID = /^[A-Za-z0-9._:-]{1,200}$/;

/** Console page of a target (its side sheet when there is one), or null. */
export const auditTargetHref = (type: string, id: string | null | undefined): string | null => {
  const safe = id && SAFE_ID.test(id) ? encodeURIComponent(id) : null;
  switch (type) {
    case "user":
      return safe ? `/admin/runners?coureur=${safe}` : "/admin/runners";
    case "premium-grant":
      return "/admin/runners";
    case "edition":
      return safe ? `/admin/organizers?edition=${safe}` : "/admin/organizers";
    case "organizer":
      return "/admin/organizers?vue=acces";
    case "race":
      return safe ? `/admin/catalog/races?course=${safe}` : "/admin/catalog/races";
    case "event":
      return "/admin/catalog/races";
    case "product":
      return "/admin/catalog/products";
    case "post":
      return safe ? `/admin/content/posts?post=${safe}` : "/admin/content/posts";
    case "render":
      return safe ? `/admin/content/renders?rendu=${safe}` : "/admin/content/renders";
    case "flyover":
      return safe ? `/admin/content/flyovers?commande=${safe}` : "/admin/content/flyovers";
    case "invoice":
    case "payment":
      return safe ? `/admin/billing?ligne=${safe}` : "/admin/billing";
    case "feedback":
      return "/admin/inbox?vue=feedback";
    case "race-request":
      return "/admin/inbox?vue=demandes";
    case "demo":
      return "/admin/inbox?vue=demos";
    case "voice":
      return "/admin/content/studio";
    case "survey":
      return "/admin/messaging/surveys";
    case "module":
    case "publication":
      return "/admin/organizers";
    case "automation":
      return "/admin/system/automation";
    case "partner":
      return "/admin/catalog/partners";
    case "proof":
      return "/admin/organizers/social-proofs";
    case "system":
      return "/admin/system/maintenance";
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------------------------
// Sanitisation of the before / after documents

const EMAIL_IN_TEXT = /[^\s@<>"',;()]+@[^\s@<>"',;()]+\.[^\s@<>"',;()]+/g;

/** « fa***@gmail.com », same masking as the e-mail journal. */
export const maskAuditEmail = (value: string): string => {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return "***";
  const local = email.slice(0, at);
  return `${local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)}***@${email.slice(at + 1)}`.slice(0, 120);
};

/** Keys whose value is never kept (secrets, message content, files, personal contact details). */
const SECRET_KEY = /(pass(word)?|secret|token|api[_-]?key|authorization|cookie|signature|credential|iban|bic\b|swift|card)/i;
const CONTENT_KEY = /^(body|content|message|text|html|description|prompt|script|narration|caption|subject|reply|comment|notes?|reason_text|gpx|geojson|track|points|polyline|image|imagebase64|base64|data|file|pdf|bytes|blob)$/i;
const PERSONAL_KEY = /(first_?name|last_?name|full_?name|contact_?name|phone|telephone|mobile|address|adresse|street|zip|postal|siret|vat_?number|tva_?number)/i;
const EMAIL_KEY = /e-?mail|recipient/i;

export const AUDIT_REDACTED = "[non journalisé]";
const MAX_DEPTH = 3;
const MAX_KEYS = 30;
const MAX_ITEMS = 8;
const MAX_STRING = 200;
const MAX_JSON_LENGTH = 6_000;

const sanitizeString = (value: string): string => {
  if (value.length > 600 && !/\s/.test(value.slice(0, 200))) return "[valeur longue]";
  if (/^data:[a-z/+.-]+;base64,/i.test(value)) return "[fichier]";
  const masked = value.replace(EMAIL_IN_TEXT, (address) => maskAuditEmail(address));
  return masked.length > MAX_STRING ? `${masked.slice(0, MAX_STRING - 1)}…` : masked;
};

const sanitizeNode = (value: unknown, key: string | null, depth: number): unknown => {
  if (key && (SECRET_KEY.test(key) || CONTENT_KEY.test(key) || PERSONAL_KEY.test(key))) return AUDIT_REDACTED;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return key && EMAIL_KEY.test(key) && value.includes("@") ? maskAuditEmail(value) : sanitizeString(value);
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return undefined;
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? `[liste de ${value.length}]` : "[objet]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((item) => sanitizeNode(item, null, depth + 1));
    return value.length > MAX_ITEMS ? [...items, `… +${value.length - MAX_ITEMS}`] : items;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS);
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of entries) {
      const clean = sanitizeNode(childValue, childKey, depth + 1);
      if (clean !== undefined) result[childKey] = clean;
    }
    return result;
  }
  return undefined;
};

/**
 * A document that is safe to store: secrets, message content, files and personal contact details are
 * replaced, e-mail addresses are masked, depth / width / length are bounded. `null` when empty.
 */
export const sanitizeAuditValue = (value: unknown): unknown => {
  const clean = sanitizeNode(value, null, 0);
  if (clean === undefined || clean === null) return null;
  if (typeof clean === "object" && !Array.isArray(clean) && Object.keys(clean).length === 0) return null;
  return JSON.stringify(clean).length > MAX_JSON_LENGTH ? { tronque: true } : clean;
};

/** Keeps only `keys` of an object (then sanitised). */
export const pickAuditFields = (value: unknown, keys: readonly string[]): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of keys) if (key in source && source[key] !== undefined) picked[key] = source[key];
  return Object.keys(picked).length ? (sanitizeAuditValue(picked) as Record<string, unknown> | null) : null;
};

export const truncateAuditText = (value: string | null | undefined, max: number): string | null => {
  const line = (value ?? "").replace(EMAIL_IN_TEXT, (address) => maskAuditEmail(address)).replace(/\s+/g, " ").trim();
  if (!line) return null;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export const shortAuditId = (id: unknown): string => (typeof id === "string" || typeof id === "number" ? String(id).slice(0, 8) : "?");

// ---------------------------------------------------------------------------------------------
// Row written to the database

export type AuditRowInput = {
  actorUserId: string;
  actorLabel?: string | null;
  action: string;
  targetType: string;
  targetId?: string | number | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  requestPath?: string | null;
  status?: AuditStatus;
  error?: string | null;
};

const SLUG = /^[a-z0-9][a-z0-9._-]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Row as stored: null when it could not satisfy the table checks (the write is then skipped). */
export const toAuditRow = (input: AuditRowInput) => {
  if (!UUID.test(input.actorUserId)) return null;
  const action = input.action.trim().toLowerCase();
  const targetType = input.targetType.trim().toLowerCase();
  if (action.length < 3 || action.length > 80 || !SLUG.test(action)) return null;
  if (targetType.length < 1 || targetType.length > 60 || !SLUG.test(targetType)) return null;
  const summary = truncateAuditText(input.summary, 300) ?? auditActionLabel(action);
  const status: AuditStatus = input.status === "error" ? "error" : "ok";
  const targetId = input.targetId === null || input.targetId === undefined ? null : String(input.targetId).slice(0, 200) || null;
  return {
    actor_user_id: input.actorUserId.toLowerCase(),
    actor_label: input.actorLabel ? input.actorLabel.slice(0, 120) : null,
    action,
    target_type: targetType,
    target_id: targetId,
    summary,
    before: sanitizeAuditValue(input.before),
    after: sanitizeAuditValue(input.after),
    request_path: input.requestPath ? input.requestPath.slice(0, 200) : null,
    status,
    error: status === "error" ? truncateAuditText(input.error, 300) ?? "Échec" : null,
  };
};

// ---------------------------------------------------------------------------------------------
// Read: query, entries, response

export const auditEntrySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  actorUserId: z.string(),
  /** Name, else masked e-mail, else « Admin ab12cd34 ». */
  actorName: z.string(),
  action: z.string(),
  actionLabel: z.string(),
  family: z.string(),
  familyLabel: z.string(),
  familyTone: z.enum(["neutral", "info", "success", "warning", "danger"]),
  targetType: z.string(),
  targetTypeLabel: z.string(),
  targetId: z.string().nullable(),
  targetHref: z.string().nullable(),
  summary: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  requestPath: z.string().nullable(),
  status: z.enum(AUDIT_STATUSES),
  error: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditResponseSchema = z.object({
  generatedAt: z.string(),
  /** False while the migration is not applied (the table does not exist). */
  available: z.boolean(),
  entries: z.array(auditEntrySchema),
  actors: z.array(z.object({ id: z.string(), name: z.string() })),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().positive() }),
});
export type AuditResponse = z.infer<typeof auditResponseSchema>;

export const auditRowSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  actor_user_id: z.string(),
  actor_label: z.string().nullable().optional(),
  action: z.string(),
  target_type: z.string(),
  target_id: z.string().nullable().optional(),
  summary: z.string(),
  before: z.unknown().nullable().optional(),
  after: z.unknown().nullable().optional(),
  request_path: z.string().nullable().optional(),
  status: z.enum(AUDIT_STATUSES),
  error: z.string().nullable().optional(),
});
export type AuditRow = z.infer<typeof auditRowSchema>;

export const AUDIT_COLUMNS = "id,created_at,actor_user_id,actor_label,action,target_type,target_id,summary,before,after,request_path,status,error";

export const mapAuditRow = (row: AuditRow, actorName?: string | null): AuditEntry => {
  const family = auditFamilyOf(row.action);
  return {
    id: row.id,
    createdAt: row.created_at,
    actorUserId: row.actor_user_id,
    actorName: actorName?.trim() || row.actor_label?.trim() || `Admin ${row.actor_user_id.slice(0, 8)}`,
    action: row.action,
    actionLabel: auditActionLabel(row.action),
    family,
    familyLabel: AUDIT_FAMILIES[family].label,
    familyTone: AUDIT_FAMILIES[family].tone,
    targetType: row.target_type,
    targetTypeLabel: auditTargetTypeLabel(row.target_type),
    targetId: row.target_id ?? null,
    targetHref: auditTargetHref(row.target_type, row.target_id),
    summary: row.summary,
    before: row.before ?? null,
    after: row.after ?? null,
    requestPath: row.request_path ?? null,
    status: row.status,
    error: row.error ?? null,
  };
};

export type AuditQuery = {
  from: string | null;
  to: string | null;
  actor: string | null;
  actions: string[];
  target: string | null;
  status: AuditStatus | null;
  search: string;
  page: number;
  entryId: string | null;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value: string | null): value is string => Boolean(value && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)));
const ACTION_FILTER = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const TARGET_FILTER = /^[A-Za-z0-9._:-]{1,200}$/;

/** `?du&au&acteur&action&cible&statut&recherche&page&entree` → normalised query (unknown values dropped). */
export const readAuditQuery = (params: URLSearchParams): AuditQuery => {
  const from = params.get("du");
  const to = params.get("au");
  const [low, high] = isDay(from) && isDay(to) && from > to ? [to, from] : [from, to];
  const actor = params.get("acteur");
  const status = AUDIT_STATUSES.find((value) => AUDIT_STATUS_PARAM[value] === params.get("statut")) ?? null;
  const target = params.get("cible")?.trim() ?? "";
  const entry = params.get("entree")?.trim() ?? "";
  return {
    from: isDay(low) ? low : null,
    to: isDay(high) ? high : null,
    actor: actor && UUID.test(actor) ? actor.toLowerCase() : null,
    actions: [...new Set((params.get("action") ?? "").split(",").map((part) => part.trim().toLowerCase()).filter((part) => ACTION_FILTER.test(part)))].slice(0, 12),
    target: TARGET_FILTER.test(target) ? target : null,
    status,
    search: (params.get("recherche") ?? "").trim().slice(0, 120),
    page: Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1)),
    entryId: UUID.test(entry) ? entry.toLowerCase() : null,
  };
};

export const writeAuditQuery = (query: Partial<AuditQuery>): URLSearchParams => {
  const params = new URLSearchParams();
  if (query.from) params.set("du", query.from);
  if (query.to) params.set("au", query.to);
  if (query.actor) params.set("acteur", query.actor);
  if (query.actions?.length) params.set("action", query.actions.join(","));
  if (query.target) params.set("cible", query.target);
  if (query.status) params.set("statut", AUDIT_STATUS_PARAM[query.status]);
  if (query.search?.trim()) params.set("recherche", query.search.trim());
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.entryId) params.set("entree", query.entryId);
  return params;
};

const postgrestSafe = (value: string) => value.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

/**
 * PostgREST filters of a query (the Paris-day bounds are converted by the caller, which owns the
 * time zone helper). `action=premium` is a family prefix, `action=premium.grant` an exact action.
 */
export const auditFilters = (query: AuditQuery, bounds: { fromIso?: string | null; toIso?: string | null }): string[] => {
  const filters: string[] = [];
  if (query.entryId) return [`id=eq.${query.entryId}`];
  if (bounds.fromIso) filters.push(`created_at=gte.${encodeURIComponent(bounds.fromIso)}`);
  if (bounds.toIso) filters.push(`created_at=lt.${encodeURIComponent(bounds.toIso)}`);
  if (query.actor) filters.push(`actor_user_id=eq.${query.actor}`);
  if (query.status) filters.push(`status=eq.${query.status}`);
  if (query.actions.length) {
    const clauses = query.actions.map((action) => (action.includes(".") ? `action.eq.${action}` : `action.like.${action}.*`));
    filters.push(`or=(${clauses.join(",")})`);
  }
  if (query.target) {
    const target = postgrestSafe(query.target);
    if (target) filters.push(`or=(target_id.eq.${encodeURIComponent(target)},target_type.eq.${encodeURIComponent(target)})`);
  }
  const search = postgrestSafe(query.search);
  if (search) {
    const pattern = `*${encodeURIComponent(search)}*`;
    filters.push(`or=(summary.ilike.${pattern},action.ilike.${pattern},target_id.ilike.${pattern},actor_label.ilike.${pattern})`);
  }
  return filters;
};

// ---------------------------------------------------------------------------------------------
// Diff

export type AuditDiffRow = { path: string; before: string | null; after: string | null; kind: "added" | "removed" | "changed" | "same" };

const MAX_DIFF_DEPTH = 4;

const flatten = (value: unknown, prefix: string, out: Map<string, string>, depth = 0) => {
  if (value && typeof value === "object" && !Array.isArray(value) && depth < MAX_DIFF_DEPTH) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) out.set(prefix, "{}");
    for (const [key, child] of entries) flatten(child, prefix ? `${prefix}.${key}` : key, out, depth + 1);
    return;
  }
  out.set(prefix || "(valeur)", typeof value === "string" ? value : JSON.stringify(value));
};

/** Field-by-field comparison of two stored documents; changed lines first, unchanged last. */
export const diffAuditValues = (before: unknown, after: unknown): AuditDiffRow[] => {
  const left = new Map<string, string>();
  const right = new Map<string, string>();
  if (before !== null && before !== undefined) flatten(before, "", left);
  if (after !== null && after !== undefined) flatten(after, "", right);
  const paths = [...new Set([...left.keys(), ...right.keys()])];
  const rows = paths.map<AuditDiffRow>((path) => {
    const previous = left.get(path) ?? null;
    const next = right.get(path) ?? null;
    return { path, before: previous, after: next, kind: previous === null ? "added" : next === null ? "removed" : previous === next ? "same" : "changed" };
  });
  const rank = { changed: 0, added: 1, removed: 2, same: 3 } as const;
  return rows.sort((a, b) => rank[a.kind] - rank[b.kind] || a.path.localeCompare(b.path));
};

// ---------------------------------------------------------------------------------------------
// Display and CSV

const parisDateTime = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const formatAuditDate = (iso: string) => parisDateTime.format(new Date(iso));

/** « il y a 4 min », « il y a 3 h », « il y a 2 j », then the date. */
export const formatAuditRelative = (iso: string, now = new Date()): string => {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "à l’instant";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return `le ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso))}`;
};

const CSV_HEADERS = ["Date", "Admin", "Action", "Famille", "Cible", "Identifiant", "Résumé", "Statut", "Erreur", "Requête"];

/** CSV of the filtered view: `;` separator, French headers, BOM, formula-like cells neutralised. */
export const buildAuditCsv = (entries: AuditEntry[]): string => {
  const lines = entries.map((entry) => [
    formatAuditDate(entry.createdAt),
    entry.actorName,
    entry.actionLabel,
    entry.familyLabel,
    entry.targetTypeLabel,
    entry.targetId ?? "",
    entry.summary,
    AUDIT_STATUS_LABEL[entry.status],
    entry.error ?? "",
    entry.requestPath ?? "",
  ].map(csvCell).join(";"));
  return `﻿${[CSV_HEADERS.join(";"), ...lines].join("\r\n")}\r\n`;
};

export const auditCsvFileName = (query: Pick<AuditQuery, "from" | "to">, today: string) => `journal-admin-${query.from ?? "debut"}_${query.to ?? today}.csv`;
