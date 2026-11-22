import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  buildSponsorReport,
  buildSponsorReportCampaignWindow,
  buildSponsorReportCsv,
  csvCell,
  sponsorReportFileName,
} from "./organizer-sponsor-report";
import { generateSponsorReportPdf } from "./organizer-sponsor-report-document";
import type { RacebookPartnerSlotRow } from "./racebook-partner-slots";
import type { RacebookSponsorRow } from "./racebook-sponsors";

const editionId = "22222222-2222-4222-8222-222222222222";

const sponsor = (overrides: Partial<RacebookSponsorRow>): RacebookSponsorRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  edition_id: editionId,
  name: "Sponsor",
  logo_url: "https://cdn.example/logo.png",
  website_url: "https://sponsor.example",
  is_active: true,
  show_on_loading: false,
  show_in_banner: true,
  position: 0,
  click_count: 0,
  impression_count: 0,
  partnership_level: "official",
  category: null,
  contextual_placement: "none",
  created_at: "2026-08-30T04:20:01Z",
  ...overrides,
});

const sponsors: RacebookSponsorRow[] = [
  sponsor({ id: "00000000-0000-4000-8000-000000000001", name: "Petit", impression_count: 10, click_count: 1, position: 0 }),
  sponsor({
    id: "00000000-0000-4000-8000-000000000002",
    name: "Grand; \"Principal\"",
    partnership_level: "principal",
    show_on_loading: true,
    contextual_placement: "aid_stations",
    impression_count: 100,
    click_count: 4,
    position: 1,
  }),
  sponsor({ id: "00000000-0000-4000-8000-000000000003", name: "=HYPERLINK(1)", is_active: false, position: 2 }),
];

const slots: RacebookPartnerSlotRow[] = [
  { edition_id: editionId, slot_key: "lodging", mode: "partner", sponsor_id: "00000000-0000-4000-8000-000000000001", headline: null, impression_count: 40, click_count: 6 },
  { edition_id: editionId, slot_key: "equipment", mode: "hidden", sponsor_id: null, headline: null, impression_count: 0, click_count: 0 },
];

const buildFixture = () => buildSponsorReport({
  eventName: "Trail TST",
  editionYear: 2026,
  editionStartDate: "2026-09-12",
  editionEndDate: "2026-09-13",
  formatCount: 3,
  campaign: { from: "2026-08-27", to: "2026-10-13" },
  readers: { status: "available", uniqueReaders: 120, totalOpens: 300, averageActiveSeconds: 95, engagementRate: 0.42 },
  sponsors,
  partnerSlots: slots,
  generatedAt: new Date("2026-11-22T10:00:00Z"),
});

describe("buildSponsorReportCampaignWindow", () => {
  it("starts at the first publication and ends 30 days after the edition when past", () => {
    expect(buildSponsorReportCampaignWindow({
      firstPublishedAt: "2026-08-27T09:40:34Z",
      firstSponsorCreatedAt: "2026-08-30T04:20:01Z",
      editionStartDate: "2026-09-12",
      editionEndDate: "2026-09-13",
      now: new Date("2026-11-22T10:00:00Z"),
    })).toEqual({ from: "2026-08-27", to: "2026-10-13" });
  });

  it("caps the end at today and falls back to sponsor creation then edition start", () => {
    expect(buildSponsorReportCampaignWindow({
      firstPublishedAt: null,
      firstSponsorCreatedAt: "2026-11-01T08:00:00Z",
      editionStartDate: "2027-03-01",
      editionEndDate: "2027-03-01",
      now: new Date("2026-11-22T10:00:00Z"),
    })).toEqual({ from: "2026-11-01", to: "2026-11-22" });
    expect(buildSponsorReportCampaignWindow({
      firstPublishedAt: null,
      firstSponsorCreatedAt: null,
      editionStartDate: "2027-03-01",
      editionEndDate: "2027-03-01",
      now: new Date("2026-11-22T10:00:00Z"),
    })).toEqual({ from: "2026-11-22", to: "2026-11-22" });
  });
});

describe("buildSponsorReport", () => {
  it("aggregates sponsor and partner-slot counters without personal data", () => {
    const report = buildFixture();
    expect(report.title).toBe("Rapport partenaires — Trail TST 2026");
    expect(report.totals).toEqual({
      sponsorCount: 3,
      activeSponsorCount: 2,
      impressions: 150,
      clicks: 11,
      clickThroughRate: 11 / 150,
    });
    expect(report.sponsors.map((entry) => entry.name)).toEqual(["Grand; \"Principal\"", "Petit", "=HYPERLINK(1)"]);
    expect(report.sponsors[0]).toMatchObject({
      tierLabel: "Principal",
      placements: ["Écran de chargement", "Bloc Partenaires officiels", "Section Ravitos"],
      clickThroughRate: 0.04,
    });
    expect(report.sponsors[2].clickThroughRate).toBeNull();
    expect(report.partnerSlots).toEqual([
      { slot: "lodging", label: "Emplacement Hébergement", sponsorName: "Petit", impressions: 40, clicks: 6, clickThroughRate: 0.15 },
    ]);
    expect(report.topPlacements.map((entry) => [entry.sponsorName, entry.clicks])).toEqual([
      ["Petit", 6],
      ["Grand; \"Principal\"", 4],
      ["Petit", 1],
    ]);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("sponsor.example");
    expect(serialized).not.toContain("logo.png");
  });
});

describe("buildSponsorReportCsv", () => {
  it("writes a semicolon CSV with BOM, CRLF, quoting and formula neutralization", () => {
    const csv = buildSponsorReportCsv(buildFixture());
    expect(csv.startsWith("﻿Rapport partenaires — Trail TST 2026\r\n")).toBe(true);
    expect(csv).not.toMatch(/[^\r]\n/);
    expect(csv).toContain("Lecteurs uniques estimés;120\r\n");
    expect(csv).toContain("Impressions partenaires;150\r\n");
    expect(csv).toContain("Taux de clic;7,3 %\r\n");
    expect(csv).toContain("Partenaire;Niveau;Catégorie;Statut;Placements;Impressions;Clics;Taux de clic\r\n");
    expect(csv).toContain("\"Grand; \"\"Principal\"\"\";Principal;;Actif;Écran de chargement | Bloc Partenaires officiels | Section Ravitos;100;4;4,0 %\r\n");
    expect(csv).toContain("'=HYPERLINK(1);Officiel;;Inactif;Bloc Partenaires officiels;0;0;—\r\n");
    expect(csv).toContain("Emplacement Hébergement;Petit;40;6;15,0 %\r\n");
  });

  it("states missing reader figures explicitly", () => {
    const csv = buildSponsorReportCsv({ ...buildFixture(), readers: { status: "not_included" } });
    expect(csv).toContain("Lecteurs du Livret coureur;Non inclus\r\n");
  });

  it("escapes individual cells", () => {
    expect(csvCell("+33")).toBe("'+33");
    expect(csvCell(-4)).toBe("-4");
    expect(csvCell("a\nb")).toBe("\"a\nb\"");
    expect(csvCell(null)).toBe("");
  });
});

describe("sponsor report documents", () => {
  it("builds ASCII file names", () => {
    expect(sponsorReportFileName({ eventName: "Trail de l’Écrin", editionYear: 2026 }, "pdf")).toBe("rapport-partenaires-trail-de-l-ecrin-2026.pdf");
  });

  it("renders a titled PDF even with characters Helvetica cannot encode", async () => {
    const report = buildFixture();
    report.sponsors[0] = { ...report.sponsors[0], name: "Café 🏃 Ōtaki" };
    const bytes = await generateSponsorReportPdf(report);
    const document = await PDFDocument.load(bytes);
    expect(document.getTitle()).toBe("Rapport partenaires — Trail TST 2026");
    expect(document.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
