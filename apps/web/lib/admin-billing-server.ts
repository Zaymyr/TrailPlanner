import { z } from "zod";

import {
  billingSourcesToLoad,
  buildBillingRegister,
  flyoverOrderRowSchema,
  normalizeFlyoverOrder,
  normalizeOrganizerInvoice,
  normalizeOrganizerPayment,
  normalizeRunnerSubscription,
  normalizeRunnerSupport,
  normalizeRunnerUnlock,
  organizerInvoiceRowSchema,
  organizerPaymentRowSchema,
  raceIdOfPlanKey,
  runnerSubscriptionRowSchema,
  runnerSupportRowSchema,
  runnerUnlockRowSchema,
  billingEditionSchema,
  type BillingEdition,
  type BillingQuery,
  type BillingResponse,
  type IndexedBillingEntry,
} from "./admin-billing";
import { loadPaymentActivity } from "./admin-system-health-server";
import { summarizePaymentHealth } from "./admin-system-health";
import { getServiceJson, serviceRestHeaders, settleSource } from "./admin-service-rest";
import { parisLocalToUtc } from "./social-posts";
import { addDays, parisToday } from "./reel-planner";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Loader of `GET /api/admin/billing` (service role, read-only): reads every billing source of the
 * period, resolves the runner e-mails (Auth admin API, masked before leaving the server) and the race
 * names of plan keys, then normalises, filters and pages with `lib/admin-billing.ts`. Each source is
 * settled on its own: a failing source is reported in `sources` and the others still load. No Stripe
 * API call; the Stripe webhook health comes from the lot 3 journal reader (`loadPaymentActivity`).
 */

const ROW_LIMIT = 5000;
const EMAIL_LOOKUP_LIMIT = 300;
const EMAIL_LOOKUP_CONCURRENCY = 10;

const parisMidnightIso = (day: string) => (parisLocalToUtc(`${day}T00:00`) ?? new Date(`${day}T00:00:00Z`)).toISOString();

/** PostgREST filters of a date column for the query period (`[from 00:00, to + 1 day 00:00)` Paris). */
export const billingDateFilter = (column: string, query: Pick<BillingQuery, "from" | "to">) => [
  query.from ? `${column}=gte.${encodeURIComponent(parisMidnightIso(query.from))}` : null,
  query.to ? `${column}=lt.${encodeURIComponent(parisMidnightIso(addDays(query.to, 1)))}` : null,
].filter(Boolean).join("&");

const withFilters = (path: string, ...filters: Array<string | null | undefined>) =>
  [path, ...filters.filter((filter): filter is string => Boolean(filter))].join("&");

const EDITION_EMBED = "race_event_editions(edition_year,race_events(name))";
const PAYMENT_COLUMNS = `id,edition_id,created_at,purchase_kind,from_tier,to_tier,status,payment_channel,stripe_checkout_session_id,stripe_payment_intent_id,stripe_invoice_id,amount_subtotal,amount_tax,amount_total,currency,paid_at,invalidated_at,invoice_number,invoice_source,invoice_storage_path,invoice_legal_snapshot,${EDITION_EMBED}`;
const INVOICE_COLUMNS = `id,edition_id,invoice_number,invoice_issued_at,invoice_type,document_status,tier,service_date,due_date,original_subtotal,discount_total,net_total,currency,legal_snapshot,invoice_storage_path,paid_at,payment_reference,${EDITION_EMBED}`;

const loadOrganizerPayments = async (supabase: SupabaseServiceConfig, query: BillingQuery) => {
  // A row belongs to the period by `paid_at`, or `created_at` when unpaid: read both, filter exactly in memory.
  const lower = query.from ? encodeURIComponent(parisMidnightIso(query.from)) : null;
  const path = withFilters(
    `organizer_edition_payments?select=${PAYMENT_COLUMNS}&status=neq.expired&order=created_at.desc&limit=${ROW_LIMIT}`,
    lower ? `or=(paid_at.gte.${lower},created_at.gte.${lower})` : null,
    query.editionId ? `edition_id=eq.${query.editionId}` : null,
  );
  return z.array(organizerPaymentRowSchema).parse(await getServiceJson(supabase, path));
};

const loadOrganizerInvoices = async (supabase: SupabaseServiceConfig, query: BillingQuery) => z.array(organizerInvoiceRowSchema).parse(await getServiceJson(
  supabase,
  withFilters(
    `organizer_invoices?select=${INVOICE_COLUMNS}&order=invoice_issued_at.desc&limit=${ROW_LIMIT}`,
    billingDateFilter("invoice_issued_at", query),
    query.editionId ? `edition_id=eq.${query.editionId}` : null,
  ),
));

const loadFlyoverOrders = async (supabase: SupabaseServiceConfig, query: BillingQuery) => z.array(flyoverOrderRowSchema).parse(await getServiceJson(
  supabase,
  withFilters(
    `flyover_video_orders?select=id,offer,amount_cents,currency,status,race_name,contact_email,stripe_payment_intent_id,paid_at,created_at&paid_at=not.is.null&order=paid_at.desc&limit=${ROW_LIMIT}`,
    billingDateFilter("paid_at", query),
  ),
));

const loadRunnerLedgers = async (supabase: SupabaseServiceConfig, query: BillingQuery) => {
  const [unlocks, subscriptions, support] = await Promise.all([
    getServiceJson(supabase, withFilters(`runner_plan_unlocks?select=id,user_id,plan_key,provider,provider_transaction_id,status,purchased_at&order=purchased_at.desc&limit=${ROW_LIMIT}`, billingDateFilter("purchased_at", query))),
    getServiceJson(supabase, withFilters(`runner_subscription_accounts?select=id,user_id,provider,provider_subscription_id,status,current_period_end,created_at&order=created_at.desc&limit=${ROW_LIMIT}`, billingDateFilter("created_at", query))),
    getServiceJson(supabase, withFilters(`runner_support_purchases?select=id,user_id,provider,status,purchased_at&order=purchased_at.desc&limit=${ROW_LIMIT}`, billingDateFilter("purchased_at", query))),
  ]);
  return {
    unlocks: z.array(runnerUnlockRowSchema).parse(unlocks),
    subscriptions: z.array(runnerSubscriptionRowSchema).parse(subscriptions),
    support: z.array(runnerSupportRowSchema).parse(support),
  };
};

const authUserSchema = z.object({ id: z.string(), email: z.string().nullable().optional() });

/** Full e-mails of runner accounts (searched on the server, masked in every entry). */
const loadRunnerEmails = async (supabase: SupabaseServiceConfig, userIds: string[]) => {
  const emails = new Map<string, string>();
  const ids = userIds.slice(0, EMAIL_LOOKUP_LIMIT);
  for (let index = 0; index < ids.length; index += EMAIL_LOOKUP_CONCURRENCY) {
    await Promise.all(ids.slice(index, index + EMAIL_LOOKUP_CONCURRENCY).map(async (userId) => {
      try {
        const response = await fetch(`${supabase.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: serviceRestHeaders(supabase), cache: "no-store" });
        if (!response.ok) return;
        const user = authUserSchema.safeParse(await response.json());
        if (user.success && user.data.email) emails.set(userId, user.data.email);
      } catch {
        // An unreadable account keeps the « Compte coureur » label.
      }
    }));
  }
  return emails;
};

const loadRaceNames = async (supabase: SupabaseServiceConfig, raceIds: string[]) => {
  const ids = raceIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500);
  if (!ids.length) return new Map<string, string>();
  const rows = z.array(z.object({ id: z.string(), name: z.string() })).parse(await getServiceJson(supabase, `races?id=in.(${ids.join(",")})&select=id,name`));
  return new Map(rows.map((row) => [row.id, row.name]));
};

const loadEditionLabel = async (supabase: SupabaseServiceConfig, editionId: string) => {
  const rows = z.array(z.object({ id: z.string(), edition_year: z.number().int().nullable().optional(), race_events: z.object({ name: z.string() }).nullable().optional() }))
    .parse(await getServiceJson(supabase, `race_event_editions?id=eq.${editionId}&select=id,edition_year,race_events(name)&limit=1`));
  const row = rows[0];
  return row ? { id: row.id, label: [row.race_events?.name ?? "Édition", row.edition_year ? `édition ${row.edition_year}` : null].filter(Boolean).join(" · ") } : null;
};

const SOURCE_LABELS = {
  organizer_pack: "packs organisateurs",
  organizer_invoice: "factures manuelles",
  flyover: "commandes de survol",
  runner: "achats coureurs",
} as const;

export const loadBillingRegister = async (
  supabase: SupabaseServiceConfig,
  query: BillingQuery,
  { exportAll = false, now = new Date() }: { exportAll?: boolean; now?: Date } = {},
): Promise<BillingResponse> => {
  const wanted = new Set(billingSourcesToLoad(query));
  const settle = <T>(promise: Promise<T>) => settleSource(promise, "Admin billing source");
  const skip = Promise.resolve(null);
  const [payments, invoices, flyovers, runners, paymentActivity, edition] = await Promise.all([
    wanted.has("organizer_pack") ? settle(loadOrganizerPayments(supabase, query)) : skip,
    wanted.has("organizer_invoice") ? settle(loadOrganizerInvoices(supabase, query)) : skip,
    wanted.has("flyover") ? settle(loadFlyoverOrders(supabase, query)) : skip,
    wanted.has("runner") ? settle(loadRunnerLedgers(supabase, query)) : skip,
    exportAll ? skip : settle(loadPaymentActivity(supabase, now)),
    query.editionId ? settle(loadEditionLabel(supabase, query.editionId)) : skip,
  ]);

  let emailByUserId = new Map<string, string>();
  let raceNameById = new Map<string, string>();
  if (runners) {
    const userIds = Array.from(new Set([...runners.unlocks, ...runners.subscriptions, ...runners.support].map((row) => row.user_id)));
    const raceIds = Array.from(new Set(runners.unlocks.map((row) => raceIdOfPlanKey(row.plan_key)).filter((id): id is string => Boolean(id))));
    const [emails, races] = await Promise.all([
      settle(loadRunnerEmails(supabase, userIds)),
      settle(loadRaceNames(supabase, raceIds)),
    ]);
    emailByUserId = emails ?? emailByUserId;
    raceNameById = races ?? raceNameById;
  }

  const today = parisToday(now);
  const lookups = { emailByUserId, raceNameById, today };
  const items: IndexedBillingEntry[] = [
    ...(payments ?? []).map(normalizeOrganizerPayment),
    ...(invoices ?? []).map((row) => normalizeOrganizerInvoice(row, lookups)),
    ...(flyovers ?? []).map(normalizeFlyoverOrder),
    ...(runners?.unlocks ?? []).map((row) => normalizeRunnerUnlock(row, lookups)),
    ...(runners?.subscriptions ?? []).map((row) => normalizeRunnerSubscription(row, lookups)),
    ...(runners?.support ?? []).map((row) => normalizeRunnerSupport(row, lookups)),
  ].filter((item): item is IndexedBillingEntry => item !== null);

  const register = buildBillingRegister(items, query, { exportAll });
  const loaded = { organizer_pack: payments, organizer_invoice: invoices, flyover: flyovers, runner: runners } as const;
  const health = paymentActivity ? summarizePaymentHealth(paymentActivity) : null;
  return {
    generatedAt: now.toISOString(),
    query: { period: query.period, from: query.from, to: query.to, sources: query.sources, statuses: query.statuses, search: query.search, editionId: query.editionId, page: register.page },
    ...register,
    sources: Array.from(wanted).map((key) => ({ key, label: SOURCE_LABELS[key], ok: loaded[key] !== null })),
    paymentsHealth: health ? { status: health.status, detail: health.detail, href: "/admin/system/integrations" } : null,
    edition: edition ?? null,
  };
};

export const loadBillingEditions = async (supabase: SupabaseServiceConfig): Promise<BillingEdition[]> => {
  const [editions, entitlements] = await Promise.all([
    getServiceJson(supabase, "race_event_editions?select=id,edition_year,is_current,race_events(name)&order=edition_year.desc.nullslast&limit=5000"),
    getServiceJson(supabase, "organizer_edition_entitlements?status=eq.active&select=edition_id,tier&limit=5000"),
  ]);
  const tiers = new Map(z.array(z.object({ edition_id: z.string(), tier: z.string() })).parse(entitlements).map((row) => [row.edition_id, row.tier]));
  return z.array(z.object({
    id: z.string(),
    edition_year: z.number().int().nullable().optional(),
    is_current: z.boolean().nullable().optional(),
    race_events: z.object({ name: z.string() }).nullable().optional(),
  })).parse(editions)
    .filter((row) => row.race_events?.name)
    .map((row) => {
      const tier = tiers.get(row.id);
      return billingEditionSchema.parse({
        editionId: row.id,
        eventName: row.race_events?.name ?? "",
        editionYear: row.edition_year ?? null,
        isCurrent: Boolean(row.is_current),
        tier: tier === "visibility" || tier === "essential" || tier === "complete" || tier === "signature" ? tier : null,
      });
    })
    .sort((left, right) => left.eventName.localeCompare(right.eventName, "fr") || (right.editionYear ?? 0) - (left.editionYear ?? 0));
};
