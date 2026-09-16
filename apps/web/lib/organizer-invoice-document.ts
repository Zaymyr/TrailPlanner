import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { z } from "zod";

import { supportEmail } from "../app/support/copy";

export const organizerInvoiceCustomerSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  billingAddress: z.string().trim().min(5).max(500),
  siren: z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value;
    return value.trim().replace(/\s/g, "") || null;
  }, z.string().regex(/^\d{9}$/).nullable()),
  vatNumber: z.string().trim().max(32).nullable().optional().transform((value) => value || null),
  purchaseOrderNumber: z.string().trim().max(80).nullable().optional().transform((value) => value || null),
});

export type OrganizerInvoiceCustomer = z.infer<typeof organizerInvoiceCustomerSchema>;

export const organizerInvoiceSnapshotSchema = z.object({
  seller: z.object({
    legalName: z.string(),
    tradingName: z.string(),
    legalForm: z.string(),
    address: z.string(),
    siren: z.string(),
    siret: z.string(),
    registration: z.string(),
    email: z.string().email(),
    vatStatement: z.string(),
  }),
  customer: organizerInvoiceCustomerSchema,
  service: z.object({
    description: z.string().min(2).max(300),
    category: z.literal("Prestations de services"),
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  amounts: z.object({
    subtotalCents: z.number().int().nonnegative(),
    taxCents: z.literal(0),
    totalCents: z.number().int().nonnegative(),
    currency: z.literal("EUR"),
  }),
  payment: z.object({
    channel: z.literal("Virement bancaire"),
    paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

export type OrganizerInvoiceSnapshot = z.infer<typeof organizerInvoiceSnapshotSchema>;

export const ORGANIZER_INVOICE_SELLER = {
  legalName: "Faustin Bertrand",
  tradingName: "Pace Yourself",
  legalForm: "Entrepreneur individuel - micro-entreprise",
  address: "10 avenue Félix Faure\n69580 Sathonay-Camp, France",
  siren: "109 903 757",
  siret: "109 903 757 00010",
  registration: "RCS Lyon n° 109 903 757",
  email: supportEmail,
  vatStatement: "TVA non applicable, art. 293 B du CGI",
} as const;

export function buildOrganizerInvoiceSnapshot(input: {
  customer: OrganizerInvoiceCustomer;
  eventName: string;
  editionYear: number;
  tierLabel: string;
  paidDate: string;
  subtotalCents: number;
}): OrganizerInvoiceSnapshot {
  return organizerInvoiceSnapshotSchema.parse({
    seller: ORGANIZER_INVOICE_SELLER,
    customer: input.customer,
    service: {
      description: `Pack ${input.tierLabel} Pace Yourself - ${input.eventName}, édition ${input.editionYear}`,
      category: "Prestations de services",
      serviceDate: input.paidDate,
    },
    amounts: {
      subtotalCents: input.subtotalCents,
      taxCents: 0,
      totalCents: input.subtotalCents,
      currency: "EUR",
    },
    payment: { channel: "Virement bancaire", paidDate: input.paidDate },
  });
}

const money = (cents: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
}).format(cents / 100).replace(/\u202f/g, " ");

const date = (value: string | Date) => new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "long",
  day: "numeric",
}).format(typeof value === "string" ? new Date(`${value}T12:00:00+02:00`) : value);

const splitLongWord = (word: string, font: PDFFont, size: number, maxWidth: number) => {
  const parts: string[] = [];
  let current = "";
  for (const character of word) {
    if (current && font.widthOfTextAtSize(current + character, size) > maxWidth) {
      parts.push(current);
      current = character;
    } else current += character;
  }
  if (current) parts.push(current);
  return parts;
};

const wrap = (text: string, font: PDFFont, size: number, maxWidth: number) => text.split("\n").flatMap((paragraph) => {
  const lines: string[] = [];
  let current = "";
  paragraph.split(/\s+/).filter(Boolean).flatMap((word) => splitLongWord(word, font, size, maxWidth)).forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else current = next;
  });
  lines.push(current || " ");
  return lines;
});

const drawLines = (page: PDFPage, lines: string[], options: {
  x: number; y: number; font: PDFFont; size?: number; lineHeight?: number; color?: ReturnType<typeof rgb>;
}) => {
  const size = options.size ?? 9;
  const lineHeight = options.lineHeight ?? size * 1.35;
  lines.forEach((line, index) => page.drawText(line, {
    x: options.x,
    y: options.y - index * lineHeight,
    font: options.font,
    size,
    color: options.color ?? rgb(0.12, 0.16, 0.2),
  }));
  return options.y - lines.length * lineHeight;
};

export async function generateOrganizerInvoicePdf(input: {
  snapshot: OrganizerInvoiceSnapshot;
  invoiceNumber: string | null;
  issuedAt: Date;
}) {
  const snapshot = organizerInvoiceSnapshotSchema.parse(input.snapshot);
  const document = await PDFDocument.create();
  document.setTitle(input.invoiceNumber ? `Facture ${input.invoiceNumber}` : "Projet de facture Pace Yourself");
  document.setAuthor(snapshot.seller.tradingName);
  document.setCreator("Pace Yourself");
  document.setCreationDate(input.issuedAt);
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.03, 0.45, 0.32);
  const muted = rgb(0.38, 0.43, 0.47);
  const pale = rgb(0.94, 0.98, 0.96);
  const left = 48;
  const right = 547;

  page.drawText("PACE YOURSELF", { x: left, y: 780, font: bold, size: 17, color: green });
  page.drawText(input.invoiceNumber ? "FACTURE" : "PROJET DE FACTURE", { x: 390, y: 780, font: bold, size: 17 });
  page.drawText(input.invoiceNumber ?? "Numéro attribué à l'émission", { x: 390, y: 759, font: regular, size: 9, color: muted });

  page.drawRectangle({ x: left, y: 616, width: 499, height: 112, color: pale, borderColor: rgb(0.82, 0.9, 0.86), borderWidth: 0.8 });
  page.drawText("ÉMETTEUR", { x: 62, y: 707, font: bold, size: 8, color: green });
  drawLines(page, [snapshot.seller.legalName, snapshot.seller.legalForm, snapshot.seller.tradingName, ...snapshot.seller.address.split("\n"), `SIREN ${snapshot.seller.siren} - SIRET ${snapshot.seller.siret}`, snapshot.seller.registration, snapshot.seller.email], { x: 62, y: 692, font: regular, size: 8.3, lineHeight: 12 });
  page.drawText("CLIENT", { x: 316, y: 707, font: bold, size: 8, color: green });
  const customerLines = [snapshot.customer.legalName, ...snapshot.customer.billingAddress.split("\n")];
  if (snapshot.customer.siren) customerLines.push(`SIREN ${snapshot.customer.siren}`);
  if (snapshot.customer.vatNumber) customerLines.push(`TVA intracommunautaire ${snapshot.customer.vatNumber}`);
  drawLines(page, customerLines.flatMap((line) => wrap(line, regular, 8.3, 214)), { x: 316, y: 692, font: regular, size: 8.3, lineHeight: 12 });

  const metaY = 580;
  page.drawText(`Date d'émission : ${date(input.issuedAt)}`, { x: left, y: metaY, font: regular, size: 9 });
  page.drawText(`Date de la prestation : ${date(snapshot.service.serviceDate)}`, { x: 300, y: metaY, font: regular, size: 9 });
  page.drawText(`Catégorie : ${snapshot.service.category}`, { x: left, y: metaY - 18, font: regular, size: 9 });
  if (snapshot.customer.purchaseOrderNumber) page.drawText(`Bon de commande : ${snapshot.customer.purchaseOrderNumber}`, { x: 300, y: metaY - 18, font: regular, size: 9 });

  page.drawRectangle({ x: left, y: 514, width: 499, height: 25, color: green });
  page.drawText("Désignation", { x: 58, y: 523, font: bold, size: 8.5, color: rgb(1, 1, 1) });
  page.drawText("Qté", { x: 374, y: 523, font: bold, size: 8.5, color: rgb(1, 1, 1) });
  page.drawText("Prix unitaire HT", { x: 408, y: 523, font: bold, size: 8.5, color: rgb(1, 1, 1) });
  const description = wrap(snapshot.service.description, regular, 9, 295);
  drawLines(page, description, { x: 58, y: 492, font: regular, size: 9, lineHeight: 13 });
  page.drawText("1", { x: 380, y: 492, font: regular, size: 9 });
  page.drawText(money(snapshot.amounts.subtotalCents), { x: 454, y: 492, font: regular, size: 9 });
  page.drawLine({ start: { x: left, y: 460 }, end: { x: right, y: 460 }, color: rgb(0.82, 0.85, 0.87), thickness: 0.8 });

  const totals = [
    ["Total HT", money(snapshot.amounts.subtotalCents)],
    ["TVA", money(snapshot.amounts.taxCents)],
    ["Total TTC", money(snapshot.amounts.totalCents)],
  ];
  totals.forEach(([label, value], index) => {
    const y = 431 - index * 22;
    page.drawText(label, { x: 386, y, font: index === 2 ? bold : regular, size: index === 2 ? 11 : 9 });
    page.drawText(value, { x: 486, y, font: index === 2 ? bold : regular, size: index === 2 ? 11 : 9 });
  });
  page.drawText(snapshot.seller.vatStatement, { x: left, y: 420, font: regular, size: 8.5, color: muted });

  page.drawRectangle({ x: left, y: 292, width: 499, height: 74, color: rgb(0.97, 0.98, 0.98) });
  drawLines(page, [
    `Facture acquittée par virement bancaire le ${date(snapshot.payment.paidDate)}.`,
    "Date d'échéance : paiement déjà reçu. Escompte pour paiement anticipé : néant.",
    "En cas de retard : pénalités au taux de trois fois le taux d'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement.",
  ].flatMap((line) => wrap(line, regular, 8.2, 475)), { x: 60, y: 347, font: regular, size: 8.2, lineHeight: 12 });

  page.drawLine({ start: { x: left, y: 92 }, end: { x: right, y: 92 }, color: rgb(0.82, 0.85, 0.87), thickness: 0.8 });
  page.drawText("Pace Yourself - Facture libellée en euros", { x: left, y: 72, font: regular, size: 8, color: muted });
  page.drawText(`Page 1 / 1`, { x: 500, y: 72, font: regular, size: 8, color: muted });

  return document.save();
}
