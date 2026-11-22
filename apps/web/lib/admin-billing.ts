import { z } from "zod";

import { parisDayOf } from "./admin-overview";
import { ORGANIZER_TIER_LABEL } from "./organizer-modules";
import { addDays, parisToday } from "./reel-planner";
import { maskEmailAddress } from "./transactional-email-log";

/**
 * « Ventes & facturation » register (`GET /api/admin/billing`, `/admin/billing`): one line per
 * transaction, every source merged and sorted by date. Pure and shared by the route and the page:
 * row schemas of each source, normalisation into one `BillingEntry` (normalised status, means of
 * payment, known amounts, links and available actions), filters, period, summary and CSV export.
 *
 * Sources (read-only, service role on the server):
 * - `organizer_edition_payments` — organizer packs paid by Stripe or by bank transfer (abandoned,
 *   `expired` Stripe attempts are not listed);
 * - `organizer_invoices` — manual invoices, settled or not (they never grant a right);
 * - `flyover_video_orders` — paid, cancelled-after-payment or refunded flyover orders (unpaid
 *   orders are not listed);
 * - runner ledgers `runner_plan_unlocks`, `runner_subscription_accounts`, `runner_support_purchases`
 *   — no amount is stored: the amount is « non suivi », never inferred from a public price.
 *
 * Amounts are minor units (cents). Organizer packs keep their stored HT / TVA / TTC; manual invoices
 * are VAT-exempt (art. 293 B CGI: TVA 0, TTC = net); flyover orders store only their TTC amount.
 */

// ---------------------------------------------------------------------------------------------
// Vocabulary

export const BILLING_SOURCES = ["organizer_pack", "organizer_invoice", "flyover", "runner"] as const;
export type BillingSource = (typeof BILLING_SOURCES)[number];

export const BILLING_SOURCE_CONFIG: Record<BillingSource, { label: string; short: string; param: string }> = {
  organizer_pack: { label: "Pack organisateur", short: "Packs", param: "packs" },
  organizer_invoice: { label: "Facture manuelle", short: "Factures", param: "factures" },
  flyover: { label: "Vidéo de survol", short: "Survols", param: "survols" },
  runner: { label: "Achat coureur", short: "Coureurs", param: "coureurs" },
};

export const BILLING_STATUSES = ["paid", "pending", "failed", "refunded", "disputed", "settled", "due", "offered", "replaced", "revoked"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];
export type BillingStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const BILLING_STATUS_CONFIG: Record<BillingStatus, { label: string; tone: BillingStatusTone; param: string }> = {
  paid: { label: "Payé", tone: "success", param: "paye" },
  pending: { label: "En attente", tone: "info", param: "en-attente" },
  failed: { label: "Échoué", tone: "danger", param: "echoue" },
  refunded: { label: "Remboursé", tone: "warning", param: "rembourse" },
  disputed: { label: "Contesté", tone: "danger", param: "conteste" },
  settled: { label: "Réglée", tone: "success", param: "reglee" },
  due: { label: "À régler", tone: "warning", param: "a-regler" },
  offered: { label: "Offert", tone: "neutral", param: "offert" },
  replaced: { label: "Remplacée", tone: "neutral", param: "remplacee" },
  revoked: { label: "Révoqué", tone: "neutral", param: "revoque" },
};

export const BILLING_METHODS = ["stripe", "bank_transfer", "offered", "store"] as const;
export type BillingMethod = (typeof BILLING_METHODS)[number];
export const BILLING_METHOD_LABEL: Record<BillingMethod, string> = {
  stripe: "Stripe",
  bank_transfer: "Virement",
  offered: "Offert",
  store: "Store",
};

/** Actions of the detail panel; each one calls an existing admin route. */
export const BILLING_ACTIONS = [
  "download_invoice",
  "regenerate_invoice",
  "settle_invoice",
  "correct_invoice",
  "issue_payment_invoice",
  "upload_payment_invoice",
] as const;
export type BillingAction = (typeof BILLING_ACTIONS)[number];

export const UNTRACKED_AMOUNT_LABEL = "montant non suivi";

// ---------------------------------------------------------------------------------------------
// Normalised entry (wire format of the route)

const customerSchema = z.object({
  legalName: z.string(),
  billingAddress: z.string(),
  siren: z.string().nullable().optional(),
  vatNumber: z.string().nullable().optional(),
  purchaseOrderNumber: z.string().nullable().optional(),
});

export const billingEntrySchema = z.object({
  id: z.string(),
  source: z.enum(BILLING_SOURCES),
  rowId: z.string(),
  date: z.string(),
  client: z.string(),
  clientDetail: z.string().nullable(),
  object: z.string(),
  reference: z.string().nullable(),
  /** Minor units; `null` = amount not tracked (runner purchases). Each part may be unknown. */
  amounts: z.object({ ht: z.number().int().nullable(), tva: z.number().int().nullable(), ttc: z.number().int().nullable() }).nullable(),
  currency: z.string(),
  status: z.enum(BILLING_STATUSES),
  statusNote: z.string().nullable(),
  method: z.enum(BILLING_METHODS),
  methodDetail: z.string().nullable(),
  editionId: z.string().nullable(),
  stripeUrl: z.string().nullable(),
  pageHref: z.string().nullable(),
  pageLabel: z.string().nullable(),
  invoice: z.object({
    kind: z.enum(["manual", "payment"]),
    id: z.string(),
    number: z.string().nullable(),
    hasPdf: z.boolean(),
  }).nullable(),
  actions: z.array(z.enum(BILLING_ACTIONS)),
  /** Manual invoice facts, to reopen the invoice dialog in correction mode. */
  manualInvoice: z.object({
    tier: z.enum(["essential", "complete", "signature"]),
    netTotal: z.number().int(),
    serviceDate: z.string(),
    dueDate: z.string(),
    featureKeys: z.array(z.string()),
    customer: customerSchema.nullable(),
  }).nullable(),
  /** Bank-transfer facts, for the historical invoice dialog. */
  payment: z.object({ tier: z.string(), paidAt: z.string().nullable(), amountSubtotal: z.number().int().nullable() }).nullable(),
  eventName: z.string().nullable(),
  editionYear: z.number().int().nullable(),
});
export type BillingEntry = z.infer<typeof billingEntrySchema>;

/** A normalised entry and the text it is searched by (may contain the full e-mail; never sent). */
export type IndexedBillingEntry = { entry: BillingEntry; searchText: string };

// ---------------------------------------------------------------------------------------------
// Helpers

const TIER_LABELS: Record<string, string> = {
  ...ORGANIZER_TIER_LABEL,
  racebook: "RaceBook (historique)",
  pro: "Pro (historique)",
};
export const billingTierLabel = (tier: string | null | undefined) => (tier ? TIER_LABELS[tier] ?? tier : "—");

const normalizeText = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr");

/**
 * Stripe dashboard page of a provider id, chosen by its prefix (no secret, no API call). Ids that
 * have no stable dashboard page (Checkout sessions) give `null`. Test-mode ids open the live
 * dashboard, which shows « introuvable »: acceptable for a convenience link.
 */
export const stripeDashboardUrl = (id: string | null | undefined): string | null => {
  const value = id?.trim();
  if (!value || !/^[A-Za-z0-9_]+$/.test(value)) return null;
  if (value.startsWith("pi_") || value.startsWith("ch_") || value.startsWith("py_")) return `https://dashboard.stripe.com/payments/${value}`;
  if (value.startsWith("in_")) return `https://dashboard.stripe.com/invoices/${value}`;
  if (value.startsWith("sub_")) return `https://dashboard.stripe.com/subscriptions/${value}`;
  if (value.startsWith("cus_")) return `https://dashboard.stripe.com/customers/${value}`;
  return null;
};

const editionHref = (editionId: string) => `/admin/organizers?edition=${encodeURIComponent(editionId)}`;

const eventLabel = (name: string | null | undefined, year: number | null | undefined) =>
  [name?.trim() || "Événement inconnu", year ? `édition ${year}` : null].filter(Boolean).join(" · ");

const customerLegalName = (snapshot: unknown): string | null => {
  const parsed = z.object({ customer: z.object({ legalName: z.string() }) }).safeParse(snapshot);
  return parsed.success ? parsed.data.customer.legalName.trim() || null : null;
};

const formatDayFr = (day: string) => {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
};

// ---------------------------------------------------------------------------------------------
// Source rows (only the columns the register reads)

const editionEmbed = z.object({
  edition_year: z.number().int().nullable().optional(),
  race_events: z.object({ name: z.string() }).nullable().optional(),
}).nullable().optional();

export const organizerPaymentRowSchema = z.object({
  id: z.string(),
  edition_id: z.string(),
  created_at: z.string(),
  purchase_kind: z.string(),
  from_tier: z.string().nullable().optional(),
  to_tier: z.string(),
  status: z.enum(["pending", "paid", "failed", "expired", "refunded", "disputed"]),
  payment_channel: z.string().nullable().optional(),
  stripe_checkout_session_id: z.string().nullable().optional(),
  stripe_payment_intent_id: z.string().nullable().optional(),
  stripe_invoice_id: z.string().nullable().optional(),
  amount_subtotal: z.number().int().nullable().optional(),
  amount_tax: z.number().int().nullable().optional(),
  amount_total: z.number().int().nullable().optional(),
  currency: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  invalidated_at: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  invoice_source: z.enum(["generated", "uploaded"]).nullable().optional(),
  invoice_storage_path: z.string().nullable().optional(),
  invoice_legal_snapshot: z.unknown().optional(),
  race_event_editions: editionEmbed,
});
export type OrganizerPaymentRow = z.infer<typeof organizerPaymentRowSchema>;

export const organizerInvoiceRowSchema = z.object({
  id: z.string(),
  edition_id: z.string(),
  invoice_number: z.string(),
  invoice_issued_at: z.string(),
  invoice_type: z.enum(["standard", "corrective"]),
  document_status: z.enum(["active", "replaced"]),
  tier: z.enum(["essential", "complete", "signature"]),
  service_date: z.string(),
  due_date: z.string(),
  original_subtotal: z.number().int(),
  discount_total: z.number().int(),
  net_total: z.number().int(),
  currency: z.string().nullable().optional(),
  legal_snapshot: z.unknown(),
  invoice_storage_path: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  payment_reference: z.string().nullable().optional(),
  race_event_editions: editionEmbed,
});
export type OrganizerInvoiceRow = z.infer<typeof organizerInvoiceRowSchema>;

export const flyoverOrderRowSchema = z.object({
  id: z.string(),
  offer: z.enum(["collab", "download"]),
  amount_cents: z.number().int(),
  currency: z.string().nullable().optional(),
  status: z.string(),
  race_name: z.string(),
  contact_email: z.string().nullable().optional(),
  stripe_payment_intent_id: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type FlyoverOrderRow = z.infer<typeof flyoverOrderRowSchema>;

export const runnerUnlockRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  plan_key: z.string(),
  provider: z.enum(["stripe", "google", "apple", "admin"]),
  provider_transaction_id: z.string().nullable().optional(),
  status: z.enum(["pending", "active", "refunded", "revoked"]),
  purchased_at: z.string(),
});
export type RunnerUnlockRow = z.infer<typeof runnerUnlockRowSchema>;

export const runnerSubscriptionRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  provider: z.enum(["stripe", "google", "apple"]),
  provider_subscription_id: z.string(),
  status: z.string(),
  current_period_end: z.string().nullable().optional(),
  created_at: z.string(),
});
export type RunnerSubscriptionRow = z.infer<typeof runnerSubscriptionRowSchema>;

export const runnerSupportRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  provider: z.enum(["apple", "google"]),
  status: z.enum(["active", "refunded"]),
  purchased_at: z.string(),
});
export type RunnerSupportRow = z.infer<typeof runnerSupportRowSchema>;

/** Lookups resolved on the server: full e-mail of a runner, catalog race name of a plan key. */
export type BillingLookups = {
  emailByUserId?: ReadonlyMap<string, string>;
  raceNameById?: ReadonlyMap<string, string>;
  today?: string;
};

const baseEntry = (partial: Pick<BillingEntry, "id" | "source" | "rowId" | "date" | "client" | "object" | "status" | "method"> & Partial<BillingEntry>): BillingEntry => ({
  clientDetail: null,
  reference: null,
  amounts: null,
  currency: "EUR",
  statusNote: null,
  methodDetail: null,
  editionId: null,
  stripeUrl: null,
  pageHref: null,
  pageLabel: null,
  invoice: null,
  actions: [],
  manualInvoice: null,
  payment: null,
  eventName: null,
  editionYear: null,
  ...partial,
});

// ---------------------------------------------------------------------------------------------
// Normalisation, one function per source (pure)

/** Organizer pack (Stripe or bank transfer). `expired` Stripe attempts are abandoned checkouts: `null`. */
export const normalizeOrganizerPayment = (row: OrganizerPaymentRow): IndexedBillingEntry | null => {
  const method: BillingMethod = row.payment_channel === "bank_transfer" || (!row.payment_channel && !row.stripe_checkout_session_id) ? "bank_transfer" : "stripe";
  if (row.status === "expired" && method === "stripe") return null;
  const status: BillingStatus = row.status === "expired" ? "failed" : row.status;
  const statusNote = row.status === "expired"
    ? "Tentative expirée"
    : row.status === "pending"
      ? method === "stripe" ? "Paiement Stripe en cours" : "Virement non reçu"
      : row.status === "refunded" || row.status === "disputed"
        ? row.invalidated_at ? `Droits recalculés le ${formatDayFr(parisDayOf(row.invalidated_at))}` : null
        : null;
  const eventName = row.race_event_editions?.race_events?.name ?? null;
  const editionYear = row.race_event_editions?.edition_year ?? null;
  const isUpgrade = Boolean(row.from_tier && row.from_tier !== "visibility") || row.purchase_kind.includes("_to_") || row.purchase_kind === "pro_upgrade";
  const object = isUpgrade && row.from_tier && row.from_tier !== "visibility"
    ? `Passage ${billingTierLabel(row.from_tier)} → ${billingTierLabel(row.to_tier)}`
    : `Pack ${billingTierLabel(row.to_tier)}`;
  const legalName = customerLegalName(row.invoice_legal_snapshot);
  const settled = row.status === "paid" || row.status === "refunded" || row.status === "disputed";
  const hasInvoiceRecord = Boolean(row.invoice_source || row.invoice_storage_path || row.invoice_number);
  const actions: BillingAction[] = [];
  let hasPdf = false;
  if (method === "stripe") {
    // The organizer download route resolves the Stripe invoice lazily from the Checkout Session.
    if (settled) actions.push("download_invoice");
    hasPdf = settled;
  } else if (settled) {
    if (row.invoice_storage_path) {
      actions.push("download_invoice");
      hasPdf = true;
    }
    if (row.invoice_source === "generated" && !row.invoice_storage_path) actions.push("regenerate_invoice");
    if (row.status === "paid" && !row.invoice_source && !row.invoice_storage_path) actions.push("issue_payment_invoice");
    if (row.invoice_source === "uploaded" || (!row.invoice_source && row.invoice_storage_path)) actions.push("upload_payment_invoice");
  }
  const entry = baseEntry({
    id: `organizer_pack:${row.id}`,
    source: "organizer_pack",
    rowId: row.id,
    date: row.paid_at ?? row.created_at,
    client: eventLabel(eventName, editionYear),
    clientDetail: legalName,
    object,
    reference: row.invoice_number ?? null,
    amounts: { ht: row.amount_subtotal ?? null, tva: row.amount_tax ?? null, ttc: row.amount_total ?? null },
    currency: (row.currency ?? "eur").toUpperCase(),
    status,
    statusNote,
    method,
    editionId: row.edition_id,
    stripeUrl: method === "stripe" ? stripeDashboardUrl(row.stripe_payment_intent_id) ?? stripeDashboardUrl(row.stripe_invoice_id) : null,
    pageHref: editionHref(row.edition_id),
    pageLabel: "Fiche de l’édition",
    invoice: method === "stripe"
      ? (settled ? { kind: "payment", id: row.id, number: row.invoice_number ?? null, hasPdf } : null)
      : hasInvoiceRecord || settled ? { kind: "payment", id: row.id, number: row.invoice_number ?? null, hasPdf } : null,
    actions,
    payment: method === "bank_transfer" ? { tier: row.to_tier, paidAt: row.paid_at ?? null, amountSubtotal: row.amount_subtotal ?? null } : null,
    eventName,
    editionYear,
  });
  return { entry, searchText: normalizeText([entry.client, legalName, object, row.invoice_number, row.stripe_payment_intent_id].filter(Boolean).join(" ")) };
};

/** Manual invoice (`organizer_invoices`): réglée, à régler (en retard), offert (net 0) or remplacée. */
export const normalizeOrganizerInvoice = (row: OrganizerInvoiceRow, lookups: BillingLookups = {}): IndexedBillingEntry => {
  const today = lookups.today ?? parisToday();
  const status: BillingStatus = row.document_status === "replaced"
    ? "replaced"
    : row.net_total === 0
      ? "offered"
      : row.paid_at
        ? "settled"
        : "due";
  const statusNote = status === "settled" && row.paid_at
    ? `Réglée le ${formatDayFr(parisDayOf(row.paid_at))}${row.payment_reference ? ` · réf. ${row.payment_reference}` : ""}`
    : status === "due"
      ? row.due_date < today ? `En retard depuis le ${formatDayFr(row.due_date)}` : `Échéance le ${formatDayFr(row.due_date)}`
      : status === "offered"
        ? "Aucun montant à régler"
        : null;
  const eventName = row.race_event_editions?.race_events?.name ?? null;
  const editionYear = row.race_event_editions?.edition_year ?? null;
  const snapshot = z.object({
    customer: customerSchema.partial().optional(),
    lines: z.array(z.object({ featureKey: z.string().optional() }).passthrough()).optional(),
  }).passthrough().safeParse(row.legal_snapshot);
  const customer = snapshot.success && snapshot.data.customer?.legalName && snapshot.data.customer.billingAddress
    ? {
      legalName: snapshot.data.customer.legalName,
      billingAddress: snapshot.data.customer.billingAddress,
      siren: snapshot.data.customer.siren ?? null,
      vatNumber: snapshot.data.customer.vatNumber ?? null,
      purchaseOrderNumber: snapshot.data.customer.purchaseOrderNumber ?? null,
    }
    : null;
  const featureKeys = snapshot.success ? (snapshot.data.lines ?? []).flatMap((line) => (line.featureKey ? [line.featureKey] : [])) : [];
  const hasPdf = Boolean(row.invoice_storage_path);
  const openUnpaid = row.document_status === "active" && !row.paid_at;
  const actions: BillingAction[] = [hasPdf ? "download_invoice" : "regenerate_invoice"];
  if (openUnpaid && row.net_total > 0) actions.push("settle_invoice");
  if (openUnpaid) actions.push("correct_invoice");
  const object = `Facture ${billingTierLabel(row.tier)}${row.invoice_type === "corrective" ? " (rectificative)" : ""}`;
  const entry = baseEntry({
    id: `organizer_invoice:${row.id}`,
    source: "organizer_invoice",
    rowId: row.id,
    date: row.invoice_issued_at,
    client: eventLabel(eventName, editionYear),
    clientDetail: customer?.legalName ?? null,
    object,
    reference: row.invoice_number,
    amounts: { ht: row.net_total, tva: 0, ttc: row.net_total },
    currency: (row.currency ?? "EUR").toUpperCase(),
    status,
    statusNote,
    method: row.net_total === 0 ? "offered" : "bank_transfer",
    methodDetail: row.net_total > 0 && row.discount_total > 0 ? `Remise ${(row.discount_total / 100).toFixed(2).replace(".", ",")} € HT` : null,
    editionId: row.edition_id,
    pageHref: editionHref(row.edition_id),
    pageLabel: "Fiche de l’édition",
    invoice: { kind: "manual", id: row.id, number: row.invoice_number, hasPdf },
    actions,
    manualInvoice: { tier: row.tier, netTotal: row.net_total, serviceDate: row.service_date, dueDate: row.due_date, featureKeys, customer },
    eventName,
    editionYear,
  });
  return { entry, searchText: normalizeText([entry.client, customer?.legalName, object, row.invoice_number, row.payment_reference].filter(Boolean).join(" ")) };
};

const FLYOVER_IN_PRODUCTION = new Set(["paid", "scripted", "rendering", "ready", "failed"]);

/** Flyover order: listed once paid (`paid_at`); unpaid or expired orders are `null`. Amount TTC only. */
export const normalizeFlyoverOrder = (row: FlyoverOrderRow): IndexedBillingEntry | null => {
  if (!row.paid_at) return null;
  let status: BillingStatus;
  let statusNote: string | null = null;
  if (row.status === "refunded") {
    status = "refunded";
  } else if (row.status === "cancelled") {
    status = "paid";
    statusNote = "Commande annulée : remboursement éventuel dans Stripe";
  } else if (FLYOVER_IN_PRODUCTION.has(row.status)) {
    status = "paid";
    statusNote = row.status === "failed" ? "Production en échec" : row.status === "ready" ? "Livrée" : "En production";
  } else {
    return null;
  }
  const email = row.contact_email?.trim() || null;
  const object = `Survol ${row.offer === "collab" ? "collab Instagram" : "MP4"}`;
  const entry = baseEntry({
    id: `flyover:${row.id}`,
    source: "flyover",
    rowId: row.id,
    date: row.paid_at,
    client: row.race_name,
    clientDetail: maskEmailAddress(email),
    object,
    amounts: { ht: null, tva: null, ttc: row.amount_cents },
    currency: (row.currency ?? "eur").toUpperCase(),
    status,
    statusNote,
    method: "stripe",
    stripeUrl: stripeDashboardUrl(row.stripe_payment_intent_id),
    pageHref: "/admin/content/flyovers",
    pageLabel: "Commandes de survol",
  });
  return { entry, searchText: normalizeText([row.race_name, email, object].filter(Boolean).join(" ")) };
};

const STORE_LABEL: Record<string, string> = { apple: "App Store", google: "Google Play" };

/** Catalog race id of a runner plan key `race:<race-id>:edition:<edition-id>`. */
export const raceIdOfPlanKey = (planKey: string) => /^race:([^:]+)(?::|$)/.exec(planKey)?.[1] ?? null;

const runnerClient = (userId: string, lookups: BillingLookups) => {
  const email = lookups.emailByUserId?.get(userId) ?? null;
  return { email, label: maskEmailAddress(email) ?? "Compte coureur" };
};

/** One-course unlock: no stored amount. Admin unlocks are « offert ». */
export const normalizeRunnerUnlock = (row: RunnerUnlockRow, lookups: BillingLookups = {}): IndexedBillingEntry => {
  const status: BillingStatus = row.status === "active" ? (row.provider === "admin" ? "offered" : "paid") : row.status === "pending" ? "pending" : row.status;
  const method: BillingMethod = row.provider === "stripe" ? "stripe" : row.provider === "admin" ? "offered" : "store";
  const raceId = raceIdOfPlanKey(row.plan_key);
  const raceName = raceId ? lookups.raceNameById?.get(raceId) ?? null : null;
  const client = runnerClient(row.user_id, lookups);
  const object = raceName ? `Plan · ${raceName}` : "Plan (achat à la course)";
  const entry = baseEntry({
    id: `runner:unlock:${row.id}`,
    source: "runner",
    rowId: row.id,
    date: row.purchased_at,
    client: client.label,
    object,
    status,
    method,
    methodDetail: STORE_LABEL[row.provider] ?? null,
    stripeUrl: row.provider === "stripe" ? stripeDashboardUrl(row.provider_transaction_id) : null,
  });
  return { entry, searchText: normalizeText([client.email, client.label, object].filter(Boolean).join(" ")) };
};

const SUBSCRIPTION_STATUS: Record<string, { status: BillingStatus; note: string | null }> = {
  active: { status: "paid", note: null },
  trialing: { status: "offered", note: "Période d’essai" },
  expired: { status: "paid", note: "Abonnement expiré" },
  canceled: { status: "paid", note: "Abonnement résilié" },
  past_due: { status: "pending", note: "Paiement en retard" },
  unpaid: { status: "pending", note: "Paiement impayé" },
  incomplete: { status: "pending", note: "Paiement incomplet" },
  incomplete_expired: { status: "failed", note: "Paiement initial non abouti" },
  paused: { status: "pending", note: "Abonnement en pause" },
};

/** Annual subscription account (one row per subscription, not per renewal): no stored amount. */
export const normalizeRunnerSubscription = (row: RunnerSubscriptionRow, lookups: BillingLookups = {}): IndexedBillingEntry => {
  const mapped = SUBSCRIPTION_STATUS[row.status] ?? { status: "pending" as const, note: `Statut fournisseur : ${row.status}` };
  const client = runnerClient(row.user_id, lookups);
  const periodNote = row.current_period_end ? `Période jusqu’au ${formatDayFr(parisDayOf(row.current_period_end))}` : null;
  const entry = baseEntry({
    id: `runner:subscription:${row.id}`,
    source: "runner",
    rowId: row.id,
    date: row.created_at,
    client: client.label,
    object: "Abonnement annuel",
    status: mapped.status,
    statusNote: [mapped.note, periodNote].filter(Boolean).join(" · ") || null,
    method: row.provider === "stripe" ? "stripe" : "store",
    methodDetail: STORE_LABEL[row.provider] ?? null,
    stripeUrl: row.provider === "stripe" ? stripeDashboardUrl(row.provider_subscription_id) : null,
  });
  return { entry, searchText: normalizeText([client.email, client.label, "abonnement annuel"].filter(Boolean).join(" ")) };
};

/** Voluntary support purchase (grants no access): no stored amount. */
export const normalizeRunnerSupport = (row: RunnerSupportRow, lookups: BillingLookups = {}): IndexedBillingEntry => {
  const client = runnerClient(row.user_id, lookups);
  const entry = baseEntry({
    id: `runner:support:${row.id}`,
    source: "runner",
    rowId: row.id,
    date: row.purchased_at,
    client: client.label,
    object: "Soutien volontaire",
    status: row.status === "active" ? "paid" : "refunded",
    method: "store",
    methodDetail: STORE_LABEL[row.provider] ?? null,
  });
  return { entry, searchText: normalizeText([client.email, client.label, "soutien volontaire"].filter(Boolean).join(" ")) };
};

// ---------------------------------------------------------------------------------------------
// Query (URL of the page = query of the route)

export const BILLING_PERIODS = ["mois", "mois-precedent", "30j", "annee", "tout"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number] | "personnalise";
export const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  mois: "Ce mois",
  "mois-precedent": "Mois dernier",
  "30j": "30 jours",
  annee: "Cette année",
  tout: "Tout",
  personnalise: "Personnalisé",
};
export const DEFAULT_BILLING_PERIOD: BillingPeriod = "annee";
export const BILLING_PAGE_SIZE = 50;
export const BILLING_EXPORT_LIMIT = 5000;

export type BillingQuery = {
  period: BillingPeriod;
  /** Paris days, inclusive; `null` = unbounded. */
  from: string | null;
  to: string | null;
  sources: BillingSource[];
  statuses: BillingStatus[];
  search: string;
  editionId: string | null;
  page: number;
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value: string | null | undefined): value is string => Boolean(value && DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Paris-day bounds of a preset period. */
export const billingPeriodRange = (period: Exclude<BillingPeriod, "personnalise">, today: string): { from: string | null; to: string | null } => {
  const [year, month] = today.split("-").map(Number);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  if (period === "mois") return { from: monthStart, to: today };
  if (period === "mois-precedent") {
    const previousMonthEnd = addDays(monthStart, -1);
    return { from: `${previousMonthEnd.slice(0, 7)}-01`, to: previousMonthEnd };
  }
  if (period === "30j") return { from: addDays(today, -29), to: today };
  if (period === "annee") return { from: `${year}-01-01`, to: today };
  return { from: null, to: null };
};

const readList = <T extends string>(value: string | null, values: readonly T[], paramOf: (value: T) => string): T[] => {
  if (!value) return [];
  const wanted = new Set(value.split(",").map((part) => part.trim()).filter(Boolean));
  return values.filter((candidate) => wanted.has(paramOf(candidate)));
};

/** `?du&au&periode&source&statut&recherche&edition&page` → normalised query (unknown values dropped). */
export const readBillingQuery = (params: URLSearchParams, today = parisToday()): BillingQuery => {
  const from = params.get("du");
  const to = params.get("au");
  const sources = readList(params.get("source"), BILLING_SOURCES, (source) => BILLING_SOURCE_CONFIG[source].param);
  const statuses = readList(params.get("statut"), BILLING_STATUSES, (status) => BILLING_STATUS_CONFIG[status].param);
  const search = (params.get("recherche") ?? "").trim().slice(0, 120);
  const edition = params.get("edition");
  const editionId = edition && UUID_PATTERN.test(edition) ? edition.toLowerCase() : null;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  if (isDay(from) || isDay(to)) {
    const bounds = [isDay(from) ? from : null, isDay(to) ? to : null] as const;
    const [low, high] = bounds[0] && bounds[1] && bounds[0] > bounds[1] ? [bounds[1], bounds[0]] : bounds;
    return { period: "personnalise", from: low, to: high, sources, statuses, search, editionId, page };
  }
  const requested = params.get("periode");
  const period = (BILLING_PERIODS as readonly string[]).includes(requested ?? "") ? (requested as Exclude<BillingPeriod, "personnalise">) : DEFAULT_BILLING_PERIOD as Exclude<BillingPeriod, "personnalise">;
  return { period, ...billingPeriodRange(period, today), sources, statuses, search, editionId, page };
};

/** Query → URL parameters (page and route share it; defaults are omitted). */
export const writeBillingQuery = (query: Partial<BillingQuery>): URLSearchParams => {
  const params = new URLSearchParams();
  if (query.period === "personnalise") {
    if (query.from) params.set("du", query.from);
    if (query.to) params.set("au", query.to);
  } else if (query.period && query.period !== DEFAULT_BILLING_PERIOD) {
    params.set("periode", query.period);
  }
  if (query.sources?.length) params.set("source", query.sources.map((source) => BILLING_SOURCE_CONFIG[source].param).join(","));
  if (query.statuses?.length) params.set("statut", query.statuses.map((status) => BILLING_STATUS_CONFIG[status].param).join(","));
  if (query.search?.trim()) params.set("recherche", query.search.trim());
  if (query.editionId) params.set("edition", query.editionId);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params;
};

/** Sources the loader must read for a query (an edition filter keeps the organizer sources only). */
export const billingSourcesToLoad = (query: Pick<BillingQuery, "sources" | "editionId">): BillingSource[] => {
  const selected = query.sources.length ? query.sources : [...BILLING_SOURCES];
  return query.editionId ? selected.filter((source) => source === "organizer_pack" || source === "organizer_invoice") : selected;
};

// ---------------------------------------------------------------------------------------------
// Filters, sort, summary, page

/** Newest first; ties by id so the order is stable across pages. */
export const sortBillingEntries = <T extends { entry: BillingEntry }>(items: T[]): T[] =>
  [...items].sort((left, right) => right.entry.date.localeCompare(left.entry.date) || left.entry.id.localeCompare(right.entry.id));

export const filterBillingEntries = (
  items: IndexedBillingEntry[],
  query: Pick<BillingQuery, "from" | "to" | "sources" | "statuses" | "search" | "editionId">,
  { ignoreStatus = false }: { ignoreStatus?: boolean } = {},
): IndexedBillingEntry[] => {
  const needle = normalizeText(query.search.trim());
  const sources = billingSourcesToLoad(query);
  return items.filter(({ entry, searchText }) => {
    if (!sources.includes(entry.source)) return false;
    if (query.editionId && entry.editionId !== query.editionId) return false;
    const day = parisDayOf(entry.date);
    if (query.from && day < query.from) return false;
    if (query.to && day > query.to) return false;
    if (!ignoreStatus && query.statuses.length && !query.statuses.includes(entry.status)) return false;
    if (needle && !searchText.includes(needle) && !normalizeText([entry.client, entry.object, entry.reference ?? ""].join(" ")).includes(needle)) return false;
    return true;
  });
};

export const billingSummarySchema = z.object({
  currency: z.string(),
  /** Σ TTC of paid packs and orders and settled invoices (refunded or disputed lines excluded). */
  collectedMinor: z.number().int(),
  collectedCount: z.number().int(),
  refundedMinor: z.number().int(),
  refundedCount: z.number().int(),
  disputedMinor: z.number().int(),
  disputedCount: z.number().int(),
  /** Unsettled invoices + bank transfers waiting. */
  toCollectMinor: z.number().int(),
  toCollectCount: z.number().int(),
  overdueCount: z.number().int(),
  transactionCount: z.number().int(),
  /** Lines without a tracked amount (runner purchases), counted but never summed. */
  untrackedCount: z.number().int(),
});
export type BillingSummary = z.infer<typeof billingSummarySchema>;

const ttcOf = (entry: BillingEntry) => entry.amounts?.ttc ?? null;

export const summarizeBilling = (entries: BillingEntry[]): BillingSummary => {
  const summary: BillingSummary = {
    currency: "EUR",
    collectedMinor: 0,
    collectedCount: 0,
    refundedMinor: 0,
    refundedCount: 0,
    disputedMinor: 0,
    disputedCount: 0,
    toCollectMinor: 0,
    toCollectCount: 0,
    overdueCount: 0,
    transactionCount: entries.length,
    untrackedCount: 0,
  };
  entries.forEach((entry) => {
    const ttc = ttcOf(entry);
    if (ttc === null) {
      // Runner purchases: counted as transactions, never summed nor counted as collected.
      summary.untrackedCount += 1;
      return;
    }
    const amount = ttc;
    if (entry.status === "paid" || entry.status === "settled") {
      summary.collectedMinor += amount;
      summary.collectedCount += 1;
    } else if (entry.status === "refunded") {
      summary.refundedMinor += amount;
      summary.refundedCount += 1;
    } else if (entry.status === "disputed") {
      summary.disputedMinor += amount;
      summary.disputedCount += 1;
    } else if (entry.status === "due" || (entry.status === "pending" && entry.method === "bank_transfer")) {
      summary.toCollectMinor += amount;
      summary.toCollectCount += 1;
      if (entry.status === "due" && entry.statusNote?.startsWith("En retard")) summary.overdueCount += 1;
    }
  });
  return summary;
};

export const billingSourceStateSchema = z.object({ key: z.string(), label: z.string(), ok: z.boolean() });

const paymentsHealthSchema = z.object({
  status: z.enum(["ok", "warning", "error", "off", "unknown", "untracked"]),
  detail: z.string(),
  href: z.string(),
}).nullable();

export const billingResponseSchema = z.object({
  generatedAt: z.string(),
  query: z.object({
    period: z.string(),
    from: z.string().nullable(),
    to: z.string().nullable(),
    sources: z.array(z.enum(BILLING_SOURCES)),
    statuses: z.array(z.enum(BILLING_STATUSES)),
    search: z.string(),
    editionId: z.string().nullable(),
    page: z.number().int(),
  }),
  /** Period, sources, edition and search applied; the status filter is not (KPI of the period). */
  summary: billingSummarySchema,
  entries: z.array(billingEntrySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageCount: z.number().int(),
  pageSize: z.number().int(),
  sources: z.array(billingSourceStateSchema),
  /** Stripe webhook health line (lot 3), shown when it is not `ok`. */
  paymentsHealth: paymentsHealthSchema,
  /** The edition of the `edition` filter, for the chip label. */
  edition: z.object({ id: z.string(), label: z.string() }).nullable(),
});
export type BillingResponse = z.infer<typeof billingResponseSchema>;

/** Filters, sorts and pages the merged entries; `exportAll` returns every match (capped). */
export const buildBillingRegister = (items: IndexedBillingEntry[], query: BillingQuery, { exportAll = false }: { exportAll?: boolean } = {}) => {
  const sorted = sortBillingEntries(items);
  const matching = filterBillingEntries(sorted, query);
  const summary = summarizeBilling(filterBillingEntries(sorted, query, { ignoreStatus: true }).map(({ entry }) => entry));
  const pageSize = exportAll ? BILLING_EXPORT_LIMIT : BILLING_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = exportAll ? 1 : Math.min(query.page, pageCount);
  const entries = matching.slice((page - 1) * pageSize, page * pageSize).map(({ entry }) => entry);
  return { summary, entries, total: matching.length, page, pageCount, pageSize };
};

/** Editions offered by the « Nouvelle facture » and « Enregistrer un virement » pickers. */
export const billingEditionSchema = z.object({
  editionId: z.string(),
  eventName: z.string(),
  editionYear: z.number().int().nullable(),
  isCurrent: z.boolean(),
  tier: z.enum(["visibility", "essential", "complete", "signature"]).nullable(),
});
export type BillingEdition = z.infer<typeof billingEditionSchema>;

export const billingEditionsResponseSchema = z.object({ editions: z.array(billingEditionSchema) });

// ---------------------------------------------------------------------------------------------
// Display and CSV

const amountFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatBillingAmount = (minor: number | null | undefined, currency = "EUR") =>
  minor === null || minor === undefined ? "—" : (minor / 100).toLocaleString("fr-FR", { style: "currency", currency });

const parisDateTime = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const formatBillingDate = (iso: string) => parisDateTime.format(new Date(iso));

const CSV_HEADERS = ["Date", "Source", "Client", "Détail client", "Objet", "Référence", "Montant HT", "TVA", "Montant TTC", "Devise", "Statut", "Précision", "Moyen"];

/** One CSV cell: quoted when needed, formula-like values neutralised for spreadsheets. */
export const csvCell = (value: string | null | undefined) => {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
};

const csvAmount = (minor: number | null | undefined) => (minor === null || minor === undefined ? "" : amountFormatter.format(minor / 100).replace(/ | /g, " "));

/** CSV of the filtered view: `;` separator, French headers, decimal comma, BOM for spreadsheets. */
export const buildBillingCsv = (entries: BillingEntry[]): string => {
  const lines = entries.map((entry) => [
    formatBillingDate(entry.date),
    BILLING_SOURCE_CONFIG[entry.source].label,
    entry.client,
    entry.clientDetail,
    entry.object,
    entry.reference,
    entry.amounts ? csvAmount(entry.amounts.ht) : "",
    entry.amounts ? csvAmount(entry.amounts.tva) : "",
    entry.amounts ? csvAmount(entry.amounts.ttc) : "",
    entry.amounts ? entry.currency : "",
    BILLING_STATUS_CONFIG[entry.status].label,
    [entry.amounts ? null : UNTRACKED_AMOUNT_LABEL, entry.statusNote].filter(Boolean).join(" · "),
    [BILLING_METHOD_LABEL[entry.method], entry.methodDetail].filter(Boolean).join(" · "),
  ].map(csvCell).join(";"));
  return `﻿${[CSV_HEADERS.join(";"), ...lines].join("\r\n")}\r\n`;
};

export const billingCsvFileName = (query: Pick<BillingQuery, "from" | "to">, today = parisToday()) =>
  `ventes-${query.from ?? "debut"}_${query.to ?? today}.csv`;
