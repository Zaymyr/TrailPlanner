import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  formatReportDate,
  formatReportDuration,
  formatReportInteger,
  formatReportRate,
  type SponsorReport,
} from "./organizer-sponsor-report";

// Pace Yourself brand tokens (docs/07-design-system/tokens.md).
const FOREST = rgb(0x2d / 255, 0x50 / 255, 0x16 / 255);
const SAND = rgb(0xec / 255, 0xea / 255, 0xe3 / 255);
const ORANGE = rgb(0xf0 / 255, 0x87 / 255, 0x3a / 255);
const LIME = rgb(0xc8 / 255, 0xd4 / 255, 0x4e / 255);
const INK = rgb(0.12, 0.14, 0.12);
const MUTED = rgb(0.4, 0.42, 0.4);
const RULE = rgb(0.82, 0.82, 0.78);
const WHITE = rgb(1, 1, 1);

const PAGE: [number, number] = [595.28, 841.89];
const LEFT = 48;
const RIGHT = 547;
const BOTTOM = 96;

/** Standard Helvetica is WinAnsi-encoded: replace any organizer text it cannot draw. */
const safeText = (font: PDFFont, text: string) => {
  let result = "";
  for (const character of text.replace(/[   ]/g, " ")) {
    try {
      font.encodeText(character);
      result += character;
    } catch {
      result += "?";
    }
  }
  return result;
};

const fit = (font: PDFFont, text: string, size: number, maxWidth: number) => {
  const safe = safeText(font, text);
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let truncated = safe;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) truncated = truncated.slice(0, -1);
  return `${truncated}…`;
};

const wrap = (font: PDFFont, text: string, size: number, maxWidth: number) => {
  const lines: string[] = [];
  let current = "";
  for (const word of safeText(font, text).split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
};

type Column = { label: string; x: number; width: number; align?: "right" };

export async function generateSponsorReportPdf(report: SponsorReport) {
  const document = await PDFDocument.create();
  document.setTitle(report.title);
  document.setAuthor("Pace Yourself");
  document.setCreator("Pace Yourself");
  document.setCreationDate(new Date(report.generatedAt));
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = document.addPage(PAGE);
  let y = 0;

  const text = (value: string, options: { x: number; y: number; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number; align?: "right" }) => {
    const font = options.font ?? regular;
    const size = options.size ?? 9;
    const content = options.maxWidth ? fit(font, value, size, options.maxWidth) : safeText(font, value);
    const x = options.align === "right" && options.maxWidth
      ? options.x + options.maxWidth - font.widthOfTextAtSize(content, size)
      : options.x;
    page.drawText(content, { x, y: options.y, size, font, color: options.color ?? INK });
  };

  const continuationHeader = () => {
    page = document.addPage(PAGE);
    page.drawRectangle({ x: 0, y: 800, width: PAGE[0], height: 42, color: FOREST });
    text("PACE YOURSELF", { x: LEFT, y: 816, font: bold, size: 11, color: WHITE });
    text(report.title, { x: 170, y: 816, size: 9, color: WHITE, maxWidth: RIGHT - 170, align: "right" });
    y = 770;
  };

  const ensureSpace = (height: number) => {
    if (y - height < BOTTOM) continuationHeader();
  };

  // Cover header.
  page.drawRectangle({ x: 0, y: 700, width: PAGE[0], height: 142, color: FOREST });
  page.drawRectangle({ x: LEFT, y: 700, width: 64, height: 4, color: ORANGE });
  text("PACE YOURSELF", { x: LEFT, y: 806, font: bold, size: 12, color: LIME });
  text("Rapport partenaires", { x: LEFT, y: 768, font: bold, size: 26, color: WHITE });
  text(`${report.eventName} — édition ${report.editionYear}`, { x: LEFT, y: 742, size: 13, color: WHITE, maxWidth: RIGHT - LEFT });
  text(
    `Campagne du ${formatReportDate(report.campaign.from)} au ${formatReportDate(report.campaign.to)}`,
    { x: LEFT, y: 720, size: 9.5, color: SAND, maxWidth: RIGHT - LEFT },
  );
  y = 676;
  const editionDates = report.editionStartDate === report.editionEndDate
    ? formatReportDate(report.editionStartDate)
    : `du ${formatReportDate(report.editionStartDate)} au ${formatReportDate(report.editionEndDate)}`;
  text(`Course ${editionDates} · ${report.formatCount} format${report.formatCount > 1 ? "s" : ""}`, { x: LEFT, y, size: 9.5, color: MUTED });
  y -= 22;

  // KPI tiles.
  const readers = report.readers;
  const tiles: Array<[string, string, string]> = [
    ["Lecteurs uniques", readers.status === "available" ? formatReportInteger(readers.uniqueReaders) : "—", readers.status === "available" ? `${formatReportInteger(readers.totalOpens)} ouvertures` : readers.status === "not_included" ? "Statistiques non incluses" : "Indisponible"],
    ["Impressions partenaires", formatReportInteger(report.totals.impressions), "Présentations visibles"],
    ["Clics partenaires", formatReportInteger(report.totals.clicks), "Ouvertures des liens"],
    ["Taux de clic", formatReportRate(report.totals.clickThroughRate), `${report.totals.activeSponsorCount} partenaire${report.totals.activeSponsorCount > 1 ? "s" : ""} actif${report.totals.activeSponsorCount > 1 ? "s" : ""}`],
  ];
  const gap = 10;
  const tileWidth = (RIGHT - LEFT - gap * 3) / 4;
  tiles.forEach(([label, value, helper], index) => {
    const x = LEFT + index * (tileWidth + gap);
    page.drawRectangle({ x, y: y - 70, width: tileWidth, height: 70, color: SAND });
    page.drawRectangle({ x, y: y - 70, width: 3, height: 70, color: index === 0 ? ORANGE : FOREST });
    text(label.toUpperCase(), { x: x + 12, y: y - 18, font: bold, size: 7, color: MUTED, maxWidth: tileWidth - 18 });
    text(value, { x: x + 12, y: y - 42, font: bold, size: 18, color: FOREST, maxWidth: tileWidth - 18 });
    text(helper, { x: x + 12, y: y - 58, size: 7.5, color: MUTED, maxWidth: tileWidth - 18 });
  });
  y -= 92;

  if (readers.status === "available") {
    text(
      `Durée active moyenne : ${formatReportDuration(readers.averageActiveSeconds)} · Taux d'engagement : ${formatReportRate(readers.engagementRate)}`,
      { x: LEFT, y, size: 8.5, color: MUTED, maxWidth: RIGHT - LEFT },
    );
    y -= 24;
  }

  const sectionTitle = (title: string) => {
    ensureSpace(60);
    text(title, { x: LEFT, y, font: bold, size: 12, color: FOREST });
    y -= 10;
  };

  const table = (columns: Column[], rows: string[][]) => {
    const header = () => {
      page.drawRectangle({ x: LEFT, y: y - 20, width: RIGHT - LEFT, height: 20, color: FOREST });
      columns.forEach((column) => text(column.label, { x: column.x, y: y - 14, font: bold, size: 7.8, color: WHITE, maxWidth: column.width, align: column.align }));
      y -= 20;
    };
    header();
    rows.forEach((row, rowIndex) => {
      if (y - 18 < BOTTOM) {
        continuationHeader();
        header();
      }
      if (rowIndex % 2 === 1) page.drawRectangle({ x: LEFT, y: y - 18, width: RIGHT - LEFT, height: 18, color: rgb(0.97, 0.965, 0.95) });
      columns.forEach((column, index) => text(row[index] ?? "", { x: column.x, y: y - 12.5, size: 8, maxWidth: column.width, align: column.align }));
      y -= 18;
    });
    page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, color: RULE, thickness: 0.8 });
    y -= 26;
  };

  sectionTitle("Performance par partenaire");
  if (report.sponsors.length === 0) {
    text("Aucun partenaire configuré pour cette édition.", { x: LEFT, y: y - 12, size: 9, color: MUTED });
    y -= 36;
  } else {
    table(
      [
        { label: "Partenaire", x: LEFT + 8, width: 120 },
        { label: "Niveau", x: 180, width: 50 },
        { label: "Placements", x: 234, width: 150 },
        { label: "Impressions", x: 388, width: 54, align: "right" },
        { label: "Clics", x: 446, width: 40, align: "right" },
        { label: "Taux", x: 490, width: 50, align: "right" },
      ],
      report.sponsors.map((sponsor) => [
        sponsor.isActive ? sponsor.name : `${sponsor.name} (inactif)`,
        sponsor.tierLabel,
        sponsor.placements.join(", ") || "—",
        formatReportInteger(sponsor.impressions),
        formatReportInteger(sponsor.clicks),
        formatReportRate(sponsor.clickThroughRate),
      ]),
    );
  }

  if (report.partnerSlots.length > 0) {
    sectionTitle("Emplacements partenaires");
    table(
      [
        { label: "Emplacement", x: LEFT + 8, width: 150 },
        { label: "Partenaire", x: 210, width: 170 },
        { label: "Impressions", x: 388, width: 54, align: "right" },
        { label: "Clics", x: 446, width: 40, align: "right" },
        { label: "Taux", x: 490, width: 50, align: "right" },
      ],
      report.partnerSlots.map((slot) => [
        slot.label,
        slot.sponsorName ?? "—",
        formatReportInteger(slot.impressions),
        formatReportInteger(slot.clicks),
        formatReportRate(slot.clickThroughRate),
      ]),
    );
  }

  if (report.topPlacements.length > 0) {
    sectionTitle("Meilleurs placements");
    y -= 6;
    report.topPlacements.forEach((entry, index) => {
      ensureSpace(20);
      page.drawCircle({ x: LEFT + 8, y: y - 4, size: 8, color: index === 0 ? ORANGE : FOREST });
      text(String(index + 1), { x: LEFT + 5.5, y: y - 7, font: bold, size: 8, color: WHITE });
      text(`${entry.sponsorName} — ${entry.label}`, { x: LEFT + 24, y: y - 7.5, font: bold, size: 9, maxWidth: 300 });
      text(
        `${formatReportInteger(entry.impressions)} impressions · ${formatReportInteger(entry.clicks)} clics · ${formatReportRate(entry.clickThroughRate)}`,
        { x: 330, y: y - 7.5, size: 8.5, color: MUTED, maxWidth: RIGHT - 330, align: "right" },
      );
      y -= 22;
    });
    y -= 8;
  }

  const methodology = [
    "Données agrégées et anonymes : aucune donnée personnelle de coureur n'est collectée pour ce rapport.",
    "Impressions : présentations visibles d'un partenaire dans le Livret coureur. Clics : ouvertures du lien du partenaire. Ces deux compteurs sont cumulés depuis la mise en ligne de chaque partenaire.",
    "Lecteurs uniques : estimation du nombre de personnes ayant ouvert le Livret coureur pendant la campagne, hors comptes internes et de test.",
  ];
  const methodologyLines = methodology.flatMap((paragraph) => wrap(regular, paragraph, 8, RIGHT - LEFT - 24));
  const boxHeight = methodologyLines.length * 11 + 32;
  ensureSpace(boxHeight + 10);
  page.drawRectangle({ x: LEFT, y: y - boxHeight, width: RIGHT - LEFT, height: boxHeight, color: SAND });
  text("MÉTHODOLOGIE", { x: LEFT + 12, y: y - 16, font: bold, size: 7.5, color: FOREST });
  methodologyLines.forEach((line, index) => text(line, { x: LEFT + 12, y: y - 30 - index * 11, size: 8, color: MUTED }));

  const pages = document.getPages();
  pages.forEach((documentPage, index) => {
    page = documentPage;
    documentPage.drawLine({ start: { x: LEFT, y: 72 }, end: { x: RIGHT, y: 72 }, color: RULE, thickness: 0.8 });
    text(`Pace Yourself · pace-yourself.com · Généré le ${formatReportDate(report.generatedAt)}`, { x: LEFT, y: 56, size: 7.5, color: MUTED });
    text(`Page ${index + 1} / ${pages.length}`, { x: 480, y: 56, size: 7.5, color: MUTED, maxWidth: RIGHT - 480, align: "right" });
  });

  return document.save();
}
