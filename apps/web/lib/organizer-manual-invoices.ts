import { z } from "zod";

import { ORGANIZER_TIER_LABEL, ORGANIZER_TIER_PRICE_EUR } from "./organizer-modules";
import {
  ORGANIZER_INVOICE_SELLER,
  generateOrganizerInvoicePdf,
  organizerInvoiceCustomerSchema,
  organizerInvoiceSnapshotSchema,
  type OrganizerInvoiceSnapshot,
} from "./organizer-invoice-document";
import { calculateOrganizerInvoiceAmounts, giftableOrganizerFeatures, organizerFeatureKeySchema } from "./organizer-features";
import { buildOrganizerInvoicePath, uploadOrganizerInvoice } from "./organizer-invoices";
import type { SupabaseServiceConfig } from "./supabase";

export const organizerManualInvoiceInputSchema = z.object({
  editionId: z.string().uuid(),
  tier: z.enum(["essential", "complete", "signature"]),
  packNetCents: z.number().int().nonnegative(),
  giftedFeatures: z.array(organizerFeatureKeySchema).max(14).default([]),
  serviceDate: z.string().date(),
  dueDate: z.string().date(),
  customer: organizerInvoiceCustomerSchema,
  replacesInvoiceId: z.string().uuid().nullable().optional(),
});

export const organizerFeatureCatalogRowSchema = z.object({
  feature_key: organizerFeatureKeySchema,
  label: z.string(),
  minimum_tier: z.enum(["complete", "signature"]),
  is_active: z.boolean(),
  sort_order: z.number().int(),
});

export const organizerInvoiceRowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  invoice_number: z.string(),
  invoice_sequence: z.number().int(),
  invoice_issued_at: z.string(),
  invoice_type: z.enum(["standard", "corrective"]),
  replaces_invoice_id: z.string().uuid().nullable(),
  document_status: z.enum(["active", "replaced"]),
  tier: z.enum(["essential", "complete", "signature"]),
  service_date: z.string(),
  due_date: z.string(),
  original_subtotal: z.number().int(),
  discount_total: z.number().int(),
  net_total: z.number().int(),
  currency: z.literal("EUR"),
  legal_snapshot: organizerInvoiceSnapshotSchema,
  invoice_storage_path: z.string().nullable().optional(),
  invoice_original_name: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  payment_reference: z.string().nullable().optional(),
});

const headers = (config: SupabaseServiceConfig, json = false) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

export async function loadOrganizerFeatureCatalog(config: SupabaseServiceConfig) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/organizer_feature_catalog?select=feature_key,label,minimum_tier,is_active,sort_order&order=sort_order.asc`, { headers: headers(config), cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load organizer feature catalog: ${await response.text()}`);
  return z.array(organizerFeatureCatalogRowSchema).parse(await response.json());
}

export async function buildManualOrganizerInvoice(config: SupabaseServiceConfig, input: z.infer<typeof organizerManualInvoiceInputSchema>) {
  const parsed = organizerManualInvoiceInputSchema.parse(input);
  const packCatalogCents = ORGANIZER_TIER_PRICE_EUR[parsed.tier] * 100;
  if (parsed.packNetCents > packCatalogCents) throw new Error("Le montant facturé dépasse le prix catalogue.");
  if (parsed.dueDate < parsed.serviceDate) throw new Error("La date d’échéance doit suivre la date de prestation.");

  const catalog = await loadOrganizerFeatureCatalog(config);
  const allowedKeys = new Set(giftableOrganizerFeatures(parsed.tier).map((feature) => feature.key));
  const selected = Array.from(new Set(parsed.giftedFeatures)).map((key) => {
    const row = catalog.find((item) => item.feature_key === key && item.is_active);
    if (!row || !allowedKeys.has(key)) throw new Error("Une option offerte n’est pas disponible pour ce pack.");
    return row;
  });
  const totals = calculateOrganizerInvoiceAmounts({
    packCatalogCents,
    packNetCents: parsed.packNetCents,
  });
  const lines = [{
    description: `Pack ${ORGANIZER_TIER_LABEL[parsed.tier]} Pace Yourself`,
    unitPriceCents: packCatalogCents,
    discountCents: packCatalogCents - parsed.packNetCents,
    netCents: parsed.packNetCents,
    offered: parsed.packNetCents === 0,
  }, ...selected.map((feature) => ({
    featureKey: feature.feature_key,
    description: feature.label,
    offered: true,
  }))];

  return { parsed, selected, totals, lines };
}

export function buildManualOrganizerInvoiceSnapshot(input: {
  customer: z.infer<typeof organizerInvoiceCustomerSchema>;
  eventName: string;
  editionYear: number;
  tier: "essential" | "complete" | "signature";
  serviceDate: string;
  dueDate: string;
  lines: Array<{ featureKey?: string; description: string; unitPriceCents?: number; discountCents?: number; netCents?: number; offered: boolean }>;
  totals: { originalSubtotal: number; discountTotal: number; netTotal: number };
  correction?: { replacesInvoiceNumber: string; replacesIssuedAt: string };
}): OrganizerInvoiceSnapshot {
  return organizerInvoiceSnapshotSchema.parse({
    seller: ORGANIZER_INVOICE_SELLER,
    customer: input.customer,
    service: {
      description: `Pack ${ORGANIZER_TIER_LABEL[input.tier]} Pace Yourself - ${input.eventName}, édition ${input.editionYear}`,
      category: "Prestations de services",
      serviceDate: input.serviceDate,
      dueDate: input.dueDate,
    },
    amounts: { subtotalCents: input.totals.netTotal, taxCents: 0, totalCents: input.totals.netTotal, currency: "EUR" },
    lines: input.lines,
    commercialTotals: {
      originalSubtotalCents: input.totals.originalSubtotal,
      discountTotalCents: input.totals.discountTotal,
      netTotalCents: input.totals.netTotal,
    },
    correction: input.correction,
  });
}

export async function renderAndStoreManualOrganizerInvoice(config: SupabaseServiceConfig, _adminId: string, invoice: z.infer<typeof organizerInvoiceRowSchema>) {
  const bytes = await generateOrganizerInvoicePdf({ snapshot: invoice.legal_snapshot, invoiceNumber: invoice.invoice_number, issuedAt: new Date(invoice.invoice_issued_at) });
  const path = buildOrganizerInvoicePath(invoice.edition_id, invoice.id);
  await uploadOrganizerInvoice(config, path, Uint8Array.from(bytes).buffer);
  const response = await fetch(`${config.supabaseUrl}/rest/v1/organizer_invoices?id=eq.${invoice.id}`, {
    method: "PATCH",
    headers: { ...headers(config, true), Prefer: "return=representation" },
    body: JSON.stringify({ invoice_storage_path: path, invoice_original_name: `${invoice.invoice_number}.pdf`, pdf_stored_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to attach organizer invoice PDF: ${await response.text()}`);
  return organizerInvoiceRowSchema.parse((await response.json())[0]);
}
