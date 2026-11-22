import { describe, expect, it } from "vitest";

import {
  billingPeriodRange,
  billingSourcesToLoad,
  buildBillingCsv,
  buildBillingRegister,
  csvCell,
  normalizeFlyoverOrder,
  normalizeOrganizerInvoice,
  normalizeOrganizerPayment,
  normalizeRunnerSubscription,
  normalizeRunnerSupport,
  normalizeRunnerUnlock,
  raceIdOfPlanKey,
  readBillingQuery,
  stripeDashboardUrl,
  summarizeBilling,
  writeBillingQuery,
  type IndexedBillingEntry,
  type OrganizerInvoiceRow,
  type OrganizerPaymentRow,
} from "./admin-billing";

const EDITION = "11111111-1111-4111-8111-111111111111";
const edition = { edition_year: 2026, race_events: { name: "Trail TST" } };

const payment = (overrides: Partial<OrganizerPaymentRow> = {}): OrganizerPaymentRow => ({
  id: "pay-1",
  edition_id: EDITION,
  created_at: "2026-11-02T09:00:00.000Z",
  purchase_kind: "essential_direct",
  from_tier: "visibility",
  to_tier: "essential",
  status: "paid",
  payment_channel: "stripe",
  stripe_checkout_session_id: "cs_test_1",
  stripe_payment_intent_id: "pi_123",
  stripe_invoice_id: null,
  amount_subtotal: 19900,
  amount_tax: 3980,
  amount_total: 23880,
  currency: "eur",
  paid_at: "2026-11-02T09:05:00.000Z",
  invalidated_at: null,
  invoice_number: null,
  invoice_source: null,
  invoice_storage_path: null,
  race_event_editions: edition,
  ...overrides,
});

const invoice = (overrides: Partial<OrganizerInvoiceRow> = {}): OrganizerInvoiceRow => ({
  id: "inv-1",
  edition_id: EDITION,
  invoice_number: "PY-2026-000012",
  invoice_issued_at: "2026-11-10T10:00:00.000Z",
  invoice_type: "standard",
  document_status: "active",
  tier: "complete",
  service_date: "2026-11-10",
  due_date: "2026-12-10",
  original_subtotal: 34900,
  discount_total: 4900,
  net_total: 30000,
  currency: "EUR",
  legal_snapshot: {
    customer: { legalName: "Association TST", billingAddress: "1 rue du Col, 38000 Grenoble", siren: null },
    lines: [{ description: "Pack", offered: false }, { featureKey: "relay", description: "Relais", offered: true }],
  },
  invoice_storage_path: "editions/x/inv-1.pdf",
  paid_at: null,
  payment_reference: null,
  race_event_editions: edition,
  ...overrides,
});

describe("normalizeOrganizerPayment", () => {
  it("keeps the stored HT / TVA / TTC of a Stripe pack and links the Stripe payment", () => {
    const { entry } = normalizeOrganizerPayment(payment())!;
    expect(entry).toMatchObject({
      source: "organizer_pack",
      client: "Trail TST · édition 2026",
      object: "Pack Essentiel",
      amounts: { ht: 19900, tva: 3980, ttc: 23880 },
      currency: "EUR",
      status: "paid",
      method: "stripe",
      stripeUrl: "https://dashboard.stripe.com/payments/pi_123",
      pageHref: `/admin/organizers?edition=${EDITION}`,
      actions: ["download_invoice"],
    });
  });

  it("drops abandoned Stripe attempts and labels upgrades", () => {
    expect(normalizeOrganizerPayment(payment({ status: "expired" }))).toBeNull();
    expect(normalizeOrganizerPayment(payment({ purchase_kind: "essential_to_complete", from_tier: "essential", to_tier: "complete" }))!.entry.object).toBe("Passage Essentiel → Complet");
  });

  it("treats a payment without Checkout session as a bank transfer and offers its invoice actions", () => {
    const transfer = { payment_channel: "bank_transfer", stripe_checkout_session_id: null, stripe_payment_intent_id: null, amount_tax: 0, amount_total: 19900 };
    const withoutInvoice = normalizeOrganizerPayment(payment(transfer))!.entry;
    expect(withoutInvoice).toMatchObject({ method: "bank_transfer", stripeUrl: null, actions: ["issue_payment_invoice"], payment: { tier: "essential", amountSubtotal: 19900 } });
    const generatedWithoutPdf = normalizeOrganizerPayment(payment({ ...transfer, invoice_source: "generated", invoice_number: "PY-2026-000003" }))!.entry;
    expect(generatedWithoutPdf.actions).toEqual(["regenerate_invoice"]);
    expect(generatedWithoutPdf.reference).toBe("PY-2026-000003");
    const uploaded = normalizeOrganizerPayment(payment({ ...transfer, invoice_source: "uploaded", invoice_storage_path: "a.pdf" }))!.entry;
    expect(uploaded.actions).toEqual(["download_invoice", "upload_payment_invoice"]);
    const legacyChannel = normalizeOrganizerPayment(payment({ payment_channel: null, stripe_checkout_session_id: null }))!.entry;
    expect(legacyChannel.method).toBe("bank_transfer");
    const waiting = normalizeOrganizerPayment(payment({ ...transfer, status: "pending", paid_at: null }))!.entry;
    expect(waiting).toMatchObject({ status: "pending", statusNote: "Virement non reçu", date: "2026-11-02T09:00:00.000Z", actions: [] });
  });

  it("maps refunds and disputes", () => {
    expect(normalizeOrganizerPayment(payment({ status: "refunded", invalidated_at: "2026-11-05T10:00:00.000Z" }))!.entry).toMatchObject({ status: "refunded", statusNote: "Droits recalculés le 05/11/2026" });
    expect(normalizeOrganizerPayment(payment({ status: "disputed" }))!.entry.status).toBe("disputed");
  });
});

describe("normalizeOrganizerInvoice", () => {
  const today = "2026-11-20";
  it("is VAT-exempt, due until settled, and offers settle and correct", () => {
    const { entry, searchText } = normalizeOrganizerInvoice(invoice(), { today });
    expect(entry).toMatchObject({
      source: "organizer_invoice",
      reference: "PY-2026-000012",
      clientDetail: "Association TST",
      amounts: { ht: 30000, tva: 0, ttc: 30000 },
      status: "due",
      statusNote: "Échéance le 10/12/2026",
      method: "bank_transfer",
      methodDetail: "Remise 49,00 € HT",
      actions: ["download_invoice", "settle_invoice", "correct_invoice"],
      manualInvoice: { tier: "complete", netTotal: 30000, featureKeys: ["relay"], customer: { legalName: "Association TST" } },
    });
    expect(searchText).toContain("association tst");
  });

  it("marks overdue, settled, zero-net and replaced invoices", () => {
    expect(normalizeOrganizerInvoice(invoice({ due_date: "2026-11-15" }), { today }).entry.statusNote).toBe("En retard depuis le 15/11/2026");
    expect(normalizeOrganizerInvoice(invoice({ paid_at: "2026-11-12T08:00:00.000Z", payment_reference: "VIR-42" }), { today }).entry).toMatchObject({ status: "settled", statusNote: "Réglée le 12/11/2026 · réf. VIR-42", actions: ["download_invoice"] });
    expect(normalizeOrganizerInvoice(invoice({ net_total: 0, discount_total: 34900 }), { today }).entry).toMatchObject({ status: "offered", method: "offered", actions: ["download_invoice", "correct_invoice"] });
    expect(normalizeOrganizerInvoice(invoice({ document_status: "replaced", invoice_storage_path: null }), { today }).entry).toMatchObject({ status: "replaced", actions: ["regenerate_invoice"] });
    expect(normalizeOrganizerInvoice(invoice({ invoice_type: "corrective" }), { today }).entry.object).toBe("Facture Complet (rectificative)");
  });
});

describe("normalizeFlyoverOrder", () => {
  const order = { id: "fly-1", offer: "download" as const, amount_cents: 5999, currency: "eur", status: "ready", race_name: "Ultra du Vercors", contact_email: "faustin@example.org", stripe_payment_intent_id: "pi_fly", paid_at: "2026-11-03T12:00:00.000Z", created_at: "2026-11-03T11:58:00.000Z" };
  it("lists paid orders with their TTC amount only and a masked e-mail", () => {
    const { entry, searchText } = normalizeFlyoverOrder(order)!;
    expect(entry).toMatchObject({ object: "Survol MP4", clientDetail: "fa***@example.org", amounts: { ht: null, tva: null, ttc: 5999 }, status: "paid", statusNote: "Livrée", stripeUrl: "https://dashboard.stripe.com/payments/pi_fly", pageHref: "/admin/content/flyovers" });
    expect(searchText).toContain("faustin@example.org");
  });
  it("skips unpaid orders and maps cancellations and refunds", () => {
    expect(normalizeFlyoverOrder({ ...order, paid_at: null, status: "pending_payment" })).toBeNull();
    expect(normalizeFlyoverOrder({ ...order, status: "expired" })).toBeNull();
    expect(normalizeFlyoverOrder({ ...order, status: "cancelled", offer: "collab" })!.entry).toMatchObject({ status: "paid", object: "Survol collab Instagram", statusNote: "Commande annulée : remboursement éventuel dans Stripe" });
    expect(normalizeFlyoverOrder({ ...order, status: "refunded" })!.entry.status).toBe("refunded");
  });
});

describe("runner purchases", () => {
  const lookups = { emailByUserId: new Map([["user-1", "camille.runner@gmail.com"]]), raceNameById: new Map([["race-9", "La Sainté-Lyon"]]) };
  it("never invents an amount", () => {
    const unlock = normalizeRunnerUnlock({ id: "u1", user_id: "user-1", plan_key: "race:race-9:edition:ed-1", provider: "apple", provider_transaction_id: "200000", status: "active", purchased_at: "2026-11-04T08:00:00.000Z" }, lookups).entry;
    expect(unlock).toMatchObject({ amounts: null, client: "ca***@gmail.com", object: "Plan · La Sainté-Lyon", status: "paid", method: "store", methodDetail: "App Store", stripeUrl: null });
    expect(normalizeRunnerUnlock({ id: "u2", user_id: "user-2", plan_key: "race:x", provider: "admin", status: "active", purchased_at: "2026-11-04T08:00:00.000Z" }).entry).toMatchObject({ status: "offered", method: "offered", client: "Compte coureur", object: "Plan (achat à la course)" });
    expect(normalizeRunnerUnlock({ id: "u3", user_id: "user-1", plan_key: "race:race-9", provider: "stripe", provider_transaction_id: "pi_run", status: "refunded", purchased_at: "2026-11-04T08:00:00.000Z" }, lookups).entry).toMatchObject({ status: "refunded", method: "stripe", stripeUrl: "https://dashboard.stripe.com/payments/pi_run" });
  });
  it("maps subscription and support statuses", () => {
    const base = { id: "s1", user_id: "user-1", provider: "stripe" as const, provider_subscription_id: "sub_1", current_period_end: "2027-11-01T00:00:00.000Z", created_at: "2026-11-01T00:00:00.000Z" };
    expect(normalizeRunnerSubscription({ ...base, status: "active" }, lookups).entry).toMatchObject({ status: "paid", object: "Abonnement annuel", amounts: null, stripeUrl: "https://dashboard.stripe.com/subscriptions/sub_1", statusNote: "Période jusqu’au 01/11/2027" });
    expect(normalizeRunnerSubscription({ ...base, status: "trialing" }, lookups).entry.status).toBe("offered");
    expect(normalizeRunnerSubscription({ ...base, status: "past_due" }, lookups).entry.status).toBe("pending");
    expect(normalizeRunnerSubscription({ ...base, status: "weird", current_period_end: null }, lookups).entry).toMatchObject({ status: "pending", statusNote: "Statut fournisseur : weird" });
    expect(normalizeRunnerSupport({ id: "t1", user_id: "user-1", provider: "google", status: "refunded", purchased_at: "2026-11-04T08:00:00.000Z" }, lookups).entry).toMatchObject({ status: "refunded", methodDetail: "Google Play", object: "Soutien volontaire" });
  });
  it("reads the race id of a plan key", () => {
    expect(raceIdOfPlanKey("race:abc:edition:def")).toBe("abc");
    expect(raceIdOfPlanKey("race:abc")).toBe("abc");
    expect(raceIdOfPlanKey("plan:abc")).toBeNull();
  });
});

describe("stripeDashboardUrl", () => {
  it("links only ids that have a dashboard page", () => {
    expect(stripeDashboardUrl("in_1")).toBe("https://dashboard.stripe.com/invoices/in_1");
    expect(stripeDashboardUrl("cs_test_1")).toBeNull();
    expect(stripeDashboardUrl("pi_1/../x")).toBeNull();
    expect(stripeDashboardUrl(null)).toBeNull();
  });
});

describe("query", () => {
  const today = "2026-03-15";
  it("defaults to the current year and reads presets", () => {
    expect(readBillingQuery(new URLSearchParams(""), today)).toMatchObject({ period: "annee", from: "2026-01-01", to: today, sources: [], statuses: [], page: 1 });
    expect(billingPeriodRange("mois-precedent", today)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(billingPeriodRange("mois", "2026-01-05")).toEqual({ from: "2026-01-01", to: "2026-01-05" });
    expect(billingPeriodRange("mois-precedent", "2026-01-05")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(billingPeriodRange("30j", today)).toEqual({ from: "2026-02-14", to: today });
    expect(billingPeriodRange("tout", today)).toEqual({ from: null, to: null });
  });
  it("reads custom bounds, lists and the edition, and writes them back", () => {
    const query = readBillingQuery(new URLSearchParams(`du=2026-02-10&au=2026-01-01&source=survols,packs,inconnu&statut=a-regler,paye&recherche=%20TST%20&edition=${EDITION.toUpperCase()}&page=3`), today);
    expect(query).toMatchObject({ period: "personnalise", from: "2026-01-01", to: "2026-02-10", sources: ["organizer_pack", "flyover"], statuses: ["paid", "due"], search: "TST", editionId: EDITION, page: 3 });
    expect(writeBillingQuery(query).toString()).toBe(`du=2026-01-01&au=2026-02-10&source=packs%2Csurvols&statut=paye%2Ca-regler&recherche=TST&edition=${EDITION}&page=3`);
    expect(writeBillingQuery({ period: "annee" }).toString()).toBe("");
    expect(readBillingQuery(new URLSearchParams("edition=nope&periode=bidon"), today)).toMatchObject({ editionId: null, period: "annee" });
  });
  it("keeps the organizer sources only for an edition", () => {
    expect(billingSourcesToLoad({ sources: [], editionId: EDITION })).toEqual(["organizer_pack", "organizer_invoice"]);
    expect(billingSourcesToLoad({ sources: ["flyover", "organizer_invoice"], editionId: null })).toEqual(["flyover", "organizer_invoice"]);
  });
});

describe("register", () => {
  const items: IndexedBillingEntry[] = [
    normalizeOrganizerPayment(payment())!,
    normalizeOrganizerPayment(payment({ id: "pay-2", status: "refunded", paid_at: "2026-11-06T09:00:00.000Z" }))!,
    normalizeOrganizerPayment(payment({ id: "pay-3", payment_channel: "bank_transfer", stripe_checkout_session_id: null, status: "pending", paid_at: null, created_at: "2026-11-07T09:00:00.000Z", amount_tax: 0, amount_total: 19900 }))!,
    normalizeOrganizerInvoice(invoice(), { today: "2026-11-20" }),
    normalizeOrganizerInvoice(invoice({ id: "inv-2", paid_at: "2026-11-12T08:00:00.000Z", invoice_issued_at: "2026-11-11T08:00:00.000Z" }), { today: "2026-11-20" }),
    normalizeFlyoverOrder({ id: "fly-1", offer: "collab", amount_cents: 2999, currency: "eur", status: "paid", race_name: "Ultra", contact_email: null, paid_at: "2025-12-20T10:00:00.000Z", created_at: "2025-12-20T10:00:00.000Z" })!,
    normalizeRunnerSupport({ id: "t1", user_id: "user-1", provider: "apple", status: "active", purchased_at: "2026-11-08T08:00:00.000Z" }),
  ];
  const query = readBillingQuery(new URLSearchParams("periode=annee"), "2026-11-20");

  it("sums the collected, refunded and to-collect amounts and never the untracked ones", () => {
    const summary = summarizeBilling(items.map(({ entry }) => entry));
    expect(summary).toMatchObject({ collectedMinor: 23880 + 30000 + 2999, collectedCount: 3, refundedMinor: 23880, refundedCount: 1, toCollectMinor: 19900 + 30000, toCollectCount: 2, transactionCount: 7, untrackedCount: 1 });
  });

  it("filters by period, status, source, edition and search, newest first, KPI without the status filter", () => {
    const register = buildBillingRegister(items, query);
    expect(register.total).toBe(6);
    expect(register.entries.map((entry) => entry.rowId)).toEqual(["inv-2", "inv-1", "t1", "pay-3", "pay-2", "pay-1"]);
    const due = buildBillingRegister(items, { ...query, statuses: ["due"] });
    expect(due.entries.map((entry) => entry.rowId)).toEqual(["inv-1"]);
    expect(due.summary.transactionCount).toBe(6);
    expect(buildBillingRegister(items, { ...query, editionId: EDITION }).total).toBe(5);
    expect(buildBillingRegister(items, { ...query, sources: ["runner"] }).entries.map((entry) => entry.rowId)).toEqual(["t1"]);
    expect(buildBillingRegister(items, { ...query, search: "association" }).total).toBe(2);
    expect(buildBillingRegister(items, { ...query, period: "tout", from: null, to: null }).total).toBe(7);
  });

  it("pages and clamps the page", () => {
    const many = Array.from({ length: 120 }, (_, index) => normalizeRunnerSupport({ id: `t${String(index).padStart(3, "0")}`, user_id: "u", provider: "apple", status: "active", purchased_at: "2026-05-01T08:00:00.000Z" }));
    const page3 = buildBillingRegister(many, { ...query, page: 9 });
    expect(page3).toMatchObject({ page: 3, pageCount: 3, total: 120 });
    expect(page3.entries).toHaveLength(20);
    expect(buildBillingRegister(many, query, { exportAll: true }).entries).toHaveLength(120);
  });
});

describe("CSV", () => {
  it("uses ; with French headers, decimal commas and « montant non suivi »", () => {
    const csv = buildBillingCsv([
      normalizeOrganizerPayment(payment())!.entry,
      normalizeRunnerSupport({ id: "t1", user_id: "user-1", provider: "apple", status: "active", purchased_at: "2026-11-08T08:00:00.000Z" }).entry,
    ]);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe("Date;Source;Client;Détail client;Objet;Référence;Montant HT;TVA;Montant TTC;Devise;Statut;Précision;Moyen");
    expect(lines[1]).toBe("02/11/2026 10:05;Pack organisateur;Trail TST · édition 2026;;Pack Essentiel;;199,00;39,80;238,80;EUR;Payé;;Stripe");
    expect(lines[2]).toBe("08/11/2026 09:00;Achat coureur;Compte coureur;;Soutien volontaire;;;;;;Payé;montant non suivi;Store · App Store");
  });
  it("quotes and neutralises dangerous cells", () => {
    expect(csvCell("a;b")).toBe("\"a;b\"");
    expect(csvCell("say \"hi\"\n")).toBe("\"say \"\"hi\"\"\n\"");
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
});
