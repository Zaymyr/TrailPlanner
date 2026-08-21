import { describe, expect, it } from "vitest";

import {
  extractOrganizerDocument,
  extractOrganizerDocumentFindings,
  attachDocumentFindingsToFormats,
  reconcileOrganizerDocumentFindings,
  ORGANIZER_DOCUMENT_MAX_BYTES,
  validateOrganizerDocument,
} from "./organizer-document-import";

describe("organizer document import", () => {
  it("accepts supported documents within the size limit", () => {
    expect(validateOrganizerDocument(new File(["image"], "roadbook.png", { type: "image/png" }))).toBeNull();
    expect(validateOrganizerDocument(new File(["pdf"], "roadbook.pdf", { type: "application/pdf" }))).toBeNull();
  });

  it("rejects unsupported media types and oversized files", () => {
    expect(validateOrganizerDocument(new File(["text"], "roadbook.txt", { type: "text/plain" }))).toBe("Type de document non pris en charge.");
    const oversized = new File([new Uint8Array(ORGANIZER_DOCUMENT_MAX_BYTES + 1)], "large.pdf", { type: "application/pdf" });
    expect(validateOrganizerDocument(oversized)).toBe("Le document dépasse la limite de 25 Mo.");
  });

  it("keeps images pending until an OCR provider is configured", async () => {
    const result = await extractOrganizerDocument(new File(["image"], "roadbook.png", { type: "image/png" }), "document-1");

    expect(result).toMatchObject({
      sourceId: "document-1",
      extractionMethod: "ocr-pending",
      status: "ocr-pending",
      text: null,
    });
  });

  it("reports invalid PDFs without inventing extracted content", async () => {
    const result = await extractOrganizerDocument(new File(["not a pdf"], "roadbook.pdf", { type: "application/pdf" }), "document-2");

    expect(result).toMatchObject({
      sourceId: "document-2",
      extractionMethod: "ocr-pending",
      status: "rejected",
      text: null,
    });
  });

  it("turns recognizable roadbook lines into review findings", async () => {
    const findings = extractOrganizerDocumentFindings("Départ 81 km à 4h00\nRavitaillement km 17\nPC Course 06 12 34 56 78");

    expect(findings.map((finding) => finding.field)).toEqual(["distanceKm", "startTime", "aidStations", "emergencyContact"]);
    expect(findings.every((finding) => finding.scope === "format-unknown")).toBe(true);
  });

  it("attaches findings to a known format only with a matching name or distance", () => {
    const findings = extractOrganizerDocumentFindings("81 km : départ à 4h00\nPC Course 06 12 34 56 78");
    const attached = attachDocumentFindingsToFormats(findings, ["X-Trail 81 km", "Trail 56 km"]);

    expect(attached[0]).toMatchObject({ scope: "format", formatHint: "X-Trail 81 km" });
    expect(attached[1]).toMatchObject({ scope: "format", formatHint: "X-Trail 81 km" });
  });

  it("marks document metrics as concordant or conflicting with known format data", () => {
    const findings = extractOrganizerDocumentFindings("81 km\nD+ 3600 m - X-Trail 81 km");
    const attached = attachDocumentFindingsToFormats(findings, ["X-Trail 81 km"]);
    const reconciled = reconcileOrganizerDocumentFindings(attached, [
      { name: "X-Trail 81 km", distanceKm: 80.86, elevationGainM: 2500, elevationLossM: null },
    ]);

    expect(reconciled[0]?.comparison.status).toBe("concordant");
    expect(reconciled[1]?.comparison.status).toBe("conflict");
    expect(reconciled[1]?.comparison.comparedValue).toBe("2500 m");
  });

  it("distinguishes missing, same and different existing text values", () => {
    const findings = attachDocumentFindingsToFormats(
      extractOrganizerDocumentFindings("X-Trail 81 km - départ à 4h00\nX-Trail 81 km - dossards vendredi 16h"),
      ["X-Trail 81 km"]
    );
    const reconciled = reconcileOrganizerDocumentFindings(findings, [
      { name: "X-Trail 81 km", distanceKm: 81, elevationGainM: 3000, elevationLossM: null, startTime: null, bibPickup: "vendredi 16h", cutoff: null },
    ]);

    expect(reconciled.find((finding) => finding.field === "startTime")?.comparison.status).toBe("fill-missing");
    expect(reconciled.find((finding) => finding.field === "bibPickup")?.comparison.status).toBe("same");
  });

  it("can compare a document with a format detected by the website in the same import", () => {
    const findings = attachDocumentFindingsToFormats(extractOrganizerDocumentFindings("Trail 56 km\nTrail 56 km - D+ 2550 m"), ["Trail 56 km"]);
    const reconciled = reconcileOrganizerDocumentFindings(findings, [
      { name: "Trail 56 km", distanceKm: 56, elevationGainM: 2552, elevationLossM: null },
    ]);

    expect(reconciled.find((finding) => finding.field === "distanceKm")?.comparison.status).toBe("concordant");
    expect(reconciled.find((finding) => finding.field === "elevationGainM")?.comparison.status).toBe("concordant");
  });
});
