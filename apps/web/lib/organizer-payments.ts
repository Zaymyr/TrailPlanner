import { z } from "zod";

import type { OrganizerTier } from "./organizer-entitlements";
import type { SupabaseServiceConfig } from "./supabase";

export const organizerPaymentStatusSchema = z.enum(["pending", "paid", "failed", "expired", "refunded", "disputed"]);
export const organizerPaymentChannelSchema = z.enum(["stripe", "bank_transfer"]);

export const organizerPaymentRowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  purchase_kind: z.string(),
  to_tier: z.string(),
  status: organizerPaymentStatusSchema,
  payment_channel: organizerPaymentChannelSchema.default("stripe"),
  amount_subtotal: z.number().int().nonnegative().nullable().optional(),
  amount_tax: z.number().int().nonnegative().nullable().optional(),
  amount_total: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  created_at: z.string(),
  stripe_checkout_session_id: z.string().nullable().optional(),
  stripe_invoice_id: z.string().nullable().optional(),
  invoice_storage_path: z.string().nullable().optional(),
  invoice_original_name: z.string().nullable().optional(),
});

export type OrganizerPaymentRow = z.infer<typeof organizerPaymentRowSchema>;

const normalizePaidTier = (tier: string): Exclude<OrganizerTier, "visibility"> | null => {
  if (tier === "essential" || tier === "complete" || tier === "signature") return tier;
  if (tier === "racebook") return "complete";
  if (tier === "pro") return "signature";
  return null;
};

export type OrganizerPurchaseSummary = {
  id: string;
  tier: Exclude<OrganizerTier, "visibility">;
  status: z.infer<typeof organizerPaymentStatusSchema>;
  paymentChannel: z.infer<typeof organizerPaymentChannelSchema>;
  amountSubtotal: number | null;
  amountTax: number | null;
  amountTotal: number | null;
  currency: string | null;
  paidAt: string | null;
  hasInvoice: boolean;
  invoiceFileName: string | null;
};

export const selectEffectiveOrganizerPurchase = (
  payments: OrganizerPurchaseSummary[] | undefined,
  effectiveTier: OrganizerTier | null | undefined
) => {
  if (!payments || !effectiveTier || effectiveTier === "visibility") return null;
  return payments.find((payment) => payment.status === "paid" && payment.tier === effectiveTier) ?? null;
};

export const toOrganizerPurchaseSummary = (row: OrganizerPaymentRow): OrganizerPurchaseSummary | null => {
  const tier = normalizePaidTier(row.to_tier);
  if (!tier) return null;
  return {
    id: row.id,
    tier,
    status: row.status,
    paymentChannel: row.payment_channel,
    amountSubtotal: row.amount_subtotal ?? null,
    amountTax: row.amount_tax ?? null,
    amountTotal: row.amount_total ?? null,
    currency: row.currency ?? null,
    paidAt: row.paid_at ?? null,
    hasInvoice: row.payment_channel === "stripe"
      ? Boolean(row.stripe_invoice_id || row.stripe_checkout_session_id)
      : Boolean(row.invoice_storage_path),
    invoiceFileName: row.invoice_original_name ?? null,
  };
};

const serviceHeaders = (config: SupabaseServiceConfig) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
});

export async function loadOrganizerEditionPayments(
  config: SupabaseServiceConfig,
  editionIds: string[]
): Promise<Record<string, OrganizerPurchaseSummary[]>> {
  const uniqueIds = Array.from(new Set(editionIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/organizer_edition_payments?edition_id=in.(${uniqueIds.join(",")})&select=id,edition_id,purchase_kind,to_tier,status,payment_channel,amount_subtotal,amount_tax,amount_total,currency,paid_at,created_at,stripe_checkout_session_id,stripe_invoice_id,invoice_storage_path,invoice_original_name&status=in.(paid,refunded,disputed)&order=paid_at.desc.nullslast,created_at.desc`,
    { headers: serviceHeaders(config), cache: "no-store" }
  );
  if (!response.ok) throw new Error(`Unable to load organizer edition payments: ${await response.text()}`);
  return z.array(organizerPaymentRowSchema).parse(await response.json()).reduce<Record<string, OrganizerPurchaseSummary[]>>(
    (result, row) => {
      const summary = toOrganizerPurchaseSummary(row);
      if (summary) (result[row.edition_id] ??= []).push(summary);
      return result;
    },
    {}
  );
}
