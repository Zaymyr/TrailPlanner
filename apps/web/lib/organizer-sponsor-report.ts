import {
  RACEBOOK_PARTNER_SLOTS,
  type RacebookPartnerSlotRow,
} from "./racebook-partner-slots";
import type { RacebookSponsorRow } from "./racebook-sponsors";

/**
 * Post-race partner report ("Rapport partenaires") for one edition.
 *
 * Aggregates only: sponsor and partner-slot counters are the existing
 * edition-level totals, and reader figures come from the same PostHog
 * endpoint as the organizer Statistics panel. No runner identity, network
 * identifier, view id or destination URL ever enters the report.
 */

export const SPONSOR_REPORT_CAMPAIGN_TAIL_DAYS = 30;

export type SponsorReportPlacementKey = "loading" | "hero" | "aid_stations" | "equipment" | "access" | "services";

export const SPONSOR_REPORT_PLACEMENT_LABEL: Record<SponsorReportPlacementKey, string> = {
  loading: "Écran de chargement",
  hero: "Bloc Partenaires officiels",
  aid_stations: "Section Ravitos",
  equipment: "Section Matériel",
  access: "Section Accès",
  services: "Section Services",
};

export const SPONSOR_REPORT_TIER_LABEL: Record<RacebookSponsorRow["partnership_level"], string> = {
  principal: "Principal",
  official: "Officiel",
  service: "Service",
};

export type SponsorReportReaders =
  | {
      status: "available";
      uniqueReaders: number;
      totalOpens: number;
      averageActiveSeconds: number | null;
      engagementRate: number | null;
    }
  | { status: "not_included" }
  | { status: "unavailable" };

export type SponsorReportSponsor = {
  id: string;
  name: string;
  tier: RacebookSponsorRow["partnership_level"];
  tierLabel: string;
  category: string | null;
  isActive: boolean;
  placements: string[];
  impressions: number;
  clicks: number;
  clickThroughRate: number | null;
};

export type SponsorReportPartnerSlot = {
  slot: RacebookPartnerSlotRow["slot_key"];
  label: string;
  sponsorName: string | null;
  impressions: number;
  clicks: number;
  clickThroughRate: number | null;
};

export type SponsorReportTopPlacement = {
  label: string;
  sponsorName: string;
  impressions: number;
  clicks: number;
  clickThroughRate: number | null;
};

export type SponsorReport = {
  title: string;
  eventName: string;
  editionYear: number;
  editionStartDate: string;
  editionEndDate: string;
  formatCount: number;
  campaign: { from: string; to: string };
  readers: SponsorReportReaders;
  totals: {
    sponsorCount: number;
    activeSponsorCount: number;
    impressions: number;
    clicks: number;
    clickThroughRate: number | null;
  };
  sponsors: SponsorReportSponsor[];
  partnerSlots: SponsorReportPartnerSlot[];
  topPlacements: SponsorReportTopPlacement[];
  generatedAt: string;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnly = (value: string | Date) => {
  if (typeof value === "string" && DATE_ONLY.test(value)) return value;
  const parsed = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const addDays = (dateOnly: string, days: number) => {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * Campaign window: from the first RaceBook publication of the edition (else
 * the first sponsor creation, else the edition start) to the edition end plus
 * 30 days, capped at today.
 */
export function buildSponsorReportCampaignWindow(input: {
  firstPublishedAt: string | null;
  firstSponsorCreatedAt: string | null;
  editionStartDate: string;
  editionEndDate: string;
  now?: Date;
}) {
  const today = toDateOnly(input.now ?? new Date())!;
  const start = (input.firstPublishedAt && toDateOnly(input.firstPublishedAt))
    || (input.firstSponsorCreatedAt && toDateOnly(input.firstSponsorCreatedAt))
    || toDateOnly(input.editionStartDate)
    || today;
  const tail = addDays(toDateOnly(input.editionEndDate) ?? today, SPONSOR_REPORT_CAMPAIGN_TAIL_DAYS);
  const to = tail < today ? tail : today;
  return { from: start > to ? to : start, to };
}

export const clickThroughRate = (clicks: number, impressions: number) =>
  impressions > 0 ? clicks / impressions : null;

const sponsorPlacements = (sponsor: RacebookSponsorRow) => {
  const keys: SponsorReportPlacementKey[] = [];
  if (sponsor.show_on_loading) keys.push("loading");
  if (sponsor.show_in_banner) keys.push("hero");
  if (sponsor.contextual_placement !== "none") keys.push(sponsor.contextual_placement);
  return keys.map((key) => SPONSOR_REPORT_PLACEMENT_LABEL[key]);
};

const byPerformance = <T extends { clicks: number; impressions: number }>(left: T, right: T) =>
  right.clicks - left.clicks || right.impressions - left.impressions;

export function buildSponsorReport(input: {
  eventName: string;
  editionYear: number;
  editionStartDate: string;
  editionEndDate: string;
  formatCount: number;
  campaign: { from: string; to: string };
  readers: SponsorReportReaders;
  sponsors: readonly RacebookSponsorRow[];
  partnerSlots: readonly RacebookPartnerSlotRow[];
  generatedAt?: Date;
}): SponsorReport {
  const sponsorNames = new Map(input.sponsors.map((sponsor) => [sponsor.id, sponsor.name]));

  const sponsors = input.sponsors
    .map((sponsor, index) => ({
      index,
      row: {
        id: sponsor.id,
        name: sponsor.name,
        tier: sponsor.partnership_level,
        tierLabel: SPONSOR_REPORT_TIER_LABEL[sponsor.partnership_level],
        category: sponsor.category,
        isActive: sponsor.is_active,
        placements: sponsorPlacements(sponsor),
        impressions: sponsor.impression_count,
        clicks: sponsor.click_count,
        clickThroughRate: clickThroughRate(sponsor.click_count, sponsor.impression_count),
      } satisfies SponsorReportSponsor,
    }))
    .sort((left, right) => right.row.impressions - left.row.impressions || right.row.clicks - left.row.clicks || left.index - right.index)
    .map(({ row }) => row);

  // Only partner-mode slots show an organizer partner; affiliate/hidden rows
  // carry no sponsor exposure and are left out of the report.
  const partnerSlots = input.partnerSlots
    .filter((slot) => slot.mode === "partner")
    .map((slot) => ({
      slot: slot.slot_key,
      label: `Emplacement ${RACEBOOK_PARTNER_SLOTS[slot.slot_key].label}`,
      sponsorName: slot.sponsor_id ? sponsorNames.get(slot.sponsor_id) ?? null : null,
      impressions: slot.impression_count,
      clicks: slot.click_count,
      clickThroughRate: clickThroughRate(slot.click_count, slot.impression_count),
    }));

  const topPlacements: SponsorReportTopPlacement[] = [
    ...sponsors.map((sponsor) => ({
      label: sponsor.placements.join(", ") || "Aucun placement actif",
      sponsorName: sponsor.name,
      impressions: sponsor.impressions,
      clicks: sponsor.clicks,
      clickThroughRate: sponsor.clickThroughRate,
    })),
    ...partnerSlots.map((slot) => ({
      label: slot.label,
      sponsorName: slot.sponsorName ?? "Partenaire supprimé",
      impressions: slot.impressions,
      clicks: slot.clicks,
      clickThroughRate: slot.clickThroughRate,
    })),
  ]
    .filter((entry) => entry.impressions > 0 || entry.clicks > 0)
    .sort(byPerformance)
    .slice(0, 5);

  const impressions = sponsors.reduce((sum, sponsor) => sum + sponsor.impressions, 0)
    + partnerSlots.reduce((sum, slot) => sum + slot.impressions, 0);
  const clicks = sponsors.reduce((sum, sponsor) => sum + sponsor.clicks, 0)
    + partnerSlots.reduce((sum, slot) => sum + slot.clicks, 0);

  return {
    title: `Rapport partenaires — ${input.eventName} ${input.editionYear}`,
    eventName: input.eventName,
    editionYear: input.editionYear,
    editionStartDate: input.editionStartDate,
    editionEndDate: input.editionEndDate,
    formatCount: input.formatCount,
    campaign: input.campaign,
    readers: input.readers,
    totals: {
      sponsorCount: sponsors.length,
      activeSponsorCount: sponsors.filter((sponsor) => sponsor.isActive).length,
      impressions,
      clicks,
      clickThroughRate: clickThroughRate(clicks, impressions),
    },
    sponsors,
    partnerSlots,
    topPlacements,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
  };
}

export const formatReportDate = (value: string) => new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
}).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));

export const formatReportInteger = (value: number) =>
  new Intl.NumberFormat("fr-FR").format(value).replace(/[  ]/g, " ");

export const formatReportRate = (value: number | null) => {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value * 100)} %`;
};

export const formatReportDuration = (seconds: number | null) => {
  if (seconds === null) return "—";
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return minutes > 0 ? `${minutes} min ${remainder.toString().padStart(2, "0")} s` : `${remainder} s`;
};

export const sponsorReportFileName = (report: Pick<SponsorReport, "eventName" | "editionYear">, extension: "csv" | "pdf") => {
  const slug = report.eventName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
  return `rapport-partenaires-${slug || "evenement"}-${report.editionYear}.${extension}`;
};

/** Neutralizes spreadsheet formula injection and quotes when needed. */
export const csvCell = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvRow = (cells: Array<string | number | null | undefined>) => cells.map(csvCell).join(";");

const readerRows = (readers: SponsorReportReaders): Array<Array<string | number>> => {
  if (readers.status === "available") {
    return [
      ["Lecteurs uniques estimés", readers.uniqueReaders],
      ["Ouvertures du Livret coureur", readers.totalOpens],
      ["Durée active moyenne", formatReportDuration(readers.averageActiveSeconds)],
      ["Taux d'engagement", formatReportRate(readers.engagementRate)],
    ];
  }
  return [["Lecteurs du Livret coureur", readers.status === "not_included" ? "Non inclus" : "Indisponible"]];
};

/**
 * Semicolon-separated, UTF-8 with BOM and CRLF line endings so French
 * spreadsheet software opens it directly.
 */
export function buildSponsorReportCsv(report: SponsorReport) {
  const rows: string[] = [
    csvRow([report.title]),
    csvRow(["Campagne", `${report.campaign.from} au ${report.campaign.to}`]),
    csvRow(["Dates de l'édition", `${report.editionStartDate} au ${report.editionEndDate}`]),
    csvRow(["Formats", report.formatCount]),
    ...readerRows(report.readers).map(csvRow),
    csvRow(["Impressions partenaires", report.totals.impressions]),
    csvRow(["Clics partenaires", report.totals.clicks]),
    csvRow(["Taux de clic", formatReportRate(report.totals.clickThroughRate)]),
    "",
    csvRow(["Partenaire", "Niveau", "Catégorie", "Statut", "Placements", "Impressions", "Clics", "Taux de clic"]),
    ...report.sponsors.map((sponsor) => csvRow([
      sponsor.name,
      sponsor.tierLabel,
      sponsor.category ?? "",
      sponsor.isActive ? "Actif" : "Inactif",
      sponsor.placements.join(" | "),
      sponsor.impressions,
      sponsor.clicks,
      formatReportRate(sponsor.clickThroughRate),
    ])),
  ];
  if (report.partnerSlots.length > 0) {
    rows.push(
      "",
      csvRow(["Emplacement", "Partenaire", "Impressions", "Clics", "Taux de clic"]),
      ...report.partnerSlots.map((slot) => csvRow([
        slot.label,
        slot.sponsorName ?? "",
        slot.impressions,
        slot.clicks,
        formatReportRate(slot.clickThroughRate),
      ])),
    );
  }
  rows.push(
    "",
    csvRow(["Données agrégées et anonymes. Impressions et clics : cumul depuis la mise en ligne des partenaires. Lecteurs : estimation sur la période de campagne."]),
    csvRow(["Généré le", report.generatedAt.slice(0, 10)]),
  );
  return `﻿${rows.join("\r\n")}\r\n`;
}
