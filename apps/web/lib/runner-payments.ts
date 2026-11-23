type RevenueCatPurchase = { id?: string; transaction_identifier?: string; purchase_date?: string; store_transaction_id?: string; store?: string };

export function findVerifiedCoursePurchase(
  subscriber: { non_subscriptions?: Record<string, RevenueCatPurchase[]> } | null | undefined,
  productId: string,
  transactionId: string | null,
  intentCreatedAt: string,
  provider?: 'google' | 'apple'
) {
  const purchases = subscriber?.non_subscriptions?.[productId] ?? [];
  const intentTime = Date.parse(intentCreatedAt);
  return purchases.filter((purchase) => {
    const matches = transactionId === null || purchase.transaction_identifier === transactionId || purchase.store_transaction_id === transactionId || purchase.id === transactionId;
    if (!matches) return false;
    const store = purchase.store?.trim().toUpperCase();
    if (provider && (!store || (provider === 'google' && store !== 'PLAY_STORE') || (provider === 'apple' && !['APP_STORE', 'MAC_APP_STORE'].includes(store)))) return false;
    if (!purchase.purchase_date || !Number.isFinite(intentTime)) return false;
    const purchaseTime = Date.parse(purchase.purchase_date);
    return Number.isFinite(purchaseTime) && purchaseTime >= intentTime;
  }).sort((a, b) => Date.parse(a.purchase_date ?? "") - Date.parse(b.purchase_date ?? ""))[0] ?? null;
}

export function getRevenueCatTransactionId(purchase: RevenueCatPurchase | null | undefined) {
  return purchase?.transaction_identifier ?? purchase?.store_transaction_id ?? purchase?.id ?? null;
}

/**
 * Real charge of a runner sale, as recorded in the billing ledgers: what the customer paid, taxes
 * included, in minor units of the purchase currency. Store rates come from RevenueCat and only feed
 * the admin net estimate; they are `null` for Stripe or when the provider did not send them.
 */
export type RunnerSaleCharge = {
  amountMinor: number;
  currency: string;
  takehomeRate: number | null;
  taxRate: number | null;
};

const ZERO_DECIMAL_CURRENCIES = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

/** Minor units per major unit (same table as SQL `runner_currency_minor_factor`). */
export function currencyMinorFactor(currency: string) {
  const code = currency.trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 1000;
  return 100;
}

export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

const toRate = (value: unknown, { allowOne }: { allowOne: boolean }) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && (allowOne ? value <= 1 : value < 1) ? value : null;

/**
 * Charge carried by a store event (major-unit price + currency). Returns `null` unless the provider
 * sent a positive finite price and a valid currency: an amount is never inferred.
 */
export function storeChargeFromMajorUnits(input: { price: unknown; currency: unknown; takehomeRate?: unknown; taxRate?: unknown }): RunnerSaleCharge | null {
  const currency = normalizeCurrencyCode(input.currency);
  if (!currency || typeof input.price !== "number" || !Number.isFinite(input.price) || input.price <= 0) return null;
  return {
    amountMinor: Math.round(input.price * currencyMinorFactor(currency)),
    currency,
    takehomeRate: toRate(input.takehomeRate, { allowOne: true }),
    taxRate: toRate(input.taxRate, { allowOne: false }),
  };
}

/** Charge of a Stripe object that already holds minor units (`amount_total`, `amount_paid`). */
export function stripeCharge(amountMinor: unknown, currency: unknown, { allowZero = false }: { allowZero?: boolean } = {}): RunnerSaleCharge | null {
  const code = normalizeCurrencyCode(currency);
  if (!code || typeof amountMinor !== "number" || !Number.isInteger(amountMinor) || amountMinor < 0 || (!allowZero && amountMinor === 0)) return null;
  return { amountMinor, currency: code, takehomeRate: null, taxRate: null };
}

/** Ledger columns of a charge (`runner_billing_events`, `runner_plan_unlocks`, `runner_support_purchases`). */
export function chargeColumns(charge: RunnerSaleCharge | null) {
  return {
    amount_minor: charge?.amountMinor ?? null,
    currency: charge?.currency ?? null,
    store_takehome_rate: charge?.takehomeRate ?? null,
    store_tax_rate: charge?.taxRate ?? null,
  };
}

/** Latest-period columns of `runner_subscription_accounts`. */
export function subscriptionChargeColumns(charge: RunnerSaleCharge, chargedAt: string) {
  return {
    last_amount_minor: charge.amountMinor,
    last_currency: charge.currency,
    last_charged_at: chargedAt,
    last_store_takehome_rate: charge.takehomeRate,
    last_store_tax_rate: charge.taxRate,
  };
}

/**
 * PostgREST filter that keeps the latest charge only: an older (out-of-order) renewal never
 * replaces a newer one.
 */
export function newerChargeFilter(chargedAt: string) {
  return `or=(last_charged_at.is.null,last_charged_at.lte.${encodeURIComponent(chargedAt)})`;
}

export function canClaimUnlock(existing: { user_id: string; plan_id: string; status: string } | null, userId: string, planId: string) {
  if (!existing) return true;
  return existing.user_id === userId && existing.plan_id === planId && existing.status === 'active';
}
