import { describe, expect, it } from "vitest";

import { ADMIN_MESSAGE_GREETING, ADMIN_MESSAGE_SIGNATURE } from "./admin-message-template";
import { formatRate, surveyDefaultCopy } from "./AdminSurveysTab";

describe("surveyDefaultCopy", () => {
  it("names the event, stays within the title limit and keeps the admin greeting and signature", () => {
    const copy = surveyDefaultCopy("Topo Athletic Bibracte Ultra-Trail®");
    expect(copy.title).toBe("Ton avis sur le livret coureur Topo Athletic Bibracte Ultra-Trail®");
    expect(copy.body.startsWith(ADMIN_MESSAGE_GREETING)).toBe(true);
    expect(copy.body.endsWith(ADMIN_MESSAGE_SIGNATURE)).toBe(true);
    expect(copy.body).toContain("mets à jour l’application");
    expect(surveyDefaultCopy("x".repeat(300)).title.length).toBeLessThanOrEqual(160);
  });
});

describe("formatRate", () => {
  it("rounds a share and shows a dash without a total", () => {
    expect(formatRate(31, 40)).toBe("78 %");
    expect(formatRate(0, 0)).toBe("—");
  });
});
