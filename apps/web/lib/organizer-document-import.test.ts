import { describe, expect, it } from "vitest";

import {
  extractOrganizerDocument,
  extractOrganizerDocumentFindings,
  attachDocumentFindingsToFormats,
  buildOrganizerDocumentSourceClaims,
  reconcileOrganizerDocumentFindings,
  ORGANIZER_DOCUMENT_EVIDENCE_MAX_CHARS,
  ORGANIZER_DOCUMENT_MAX_CLAIMS_PER_SCOPE_FIELD,
  ORGANIZER_DOCUMENT_MAX_BYTES,
  ORGANIZER_DOCUMENT_VALUE_MAX_CHARS,
  validateOrganizerDocument,
} from "./organizer-document-import";
import { sourceClaimSchema } from "./organizer-import-engine";

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
    expect(findings.filter((finding) => finding.field !== "emergencyContact").every((finding) => finding.scope === "format-unknown")).toBe(true);
    expect(findings.find((finding) => finding.field === "emergencyContact")?.scope).toBe("event");
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

  it("preserves page evidence and exposes only typed, scoped document claims", () => {
    const findings = attachDocumentFindingsToFormats(
      extractOrganizerDocumentFindings(
        "Trail 56 km - départ à 04h30\nTrail 56 km - ravitaillement km 17\nTrail 56 km - Arrivée fermée à 18h30\nPC Course 06 12 34 56 78\nSuivi live sur live.example.org",
        "format-unknown",
        7
      ),
      ["Trail 56 km"]
    );
    const claims = buildOrganizerDocumentSourceClaims(
      { sourceId: "document-roadbook", fileName: "roadbook-2026.pdf", findings },
      { "Trail 56 km": "format-56" }
    );

    expect(claims.find((claim) => claim.field === "startTime")).toMatchObject({
      scope: { kind: "format", scopeKey: "format-56" },
      value: "04:30",
      source: { kind: "official-document", page: 7 },
      evidence: "Trail 56 km - départ à 04h30",
    });
    expect(claims.find((claim) => claim.field === "aidStations")?.value).toEqual([{
      name: "ravitaillement km",
      distanceKm: 17,
      waterRefill: null,
      solidRefill: null,
      assistanceAllowed: null,
    }]);
    expect(claims.find((claim) => claim.field === "finishCutoffTime")?.value).toBe("18:30");
    expect(claims.find((claim) => claim.field === "emergencyContact")?.scope).toEqual({ kind: "event", scopeKey: "event" });
    expect(claims.find((claim) => claim.field === "liveTracking")?.scope).toEqual({ kind: "event", scopeKey: "event" });
  });

  it("keeps late matches from very long PDF lines in bounded, schema-valid claims", () => {
    const longPdfLine = `${"Informations generales sans donnee de course. ".repeat(90)}Trail 56 km - depart a 04h30 - materiel obligatoire : veste impermeable`;
    expect(longPdfLine.length).toBeGreaterThan(ORGANIZER_DOCUMENT_EVIDENCE_MAX_CHARS);

    const findings = attachDocumentFindingsToFormats(extractOrganizerDocumentFindings(longPdfLine), ["Trail 56 km"]);
    const claims = buildOrganizerDocumentSourceClaims(
      { sourceId: "document-long-line", fileName: "roadbook-long-line.pdf", findings },
      { "Trail 56 km": "format-56" }
    );

    expect(findings.every((finding) => finding.evidence.length <= ORGANIZER_DOCUMENT_EVIDENCE_MAX_CHARS)).toBe(true);
    expect(findings.every((finding) => finding.value.length <= ORGANIZER_DOCUMENT_VALUE_MAX_CHARS)).toBe(true);
    expect(claims.find((claim) => claim.field === "startTime")?.evidence).toContain("04h30");
    expect(claims.find((claim) => claim.field === "mandatoryEquipment")?.evidence).toContain("materiel obligatoire");
    expect(() => claims.forEach((claim) => sourceClaimSchema.parse(claim))).not.toThrow();
  });

  it("deduplicates and caps verbose multi-page document claims by scope and field", () => {
    const findings = Array.from({ length: 120 }, (_, index) => attachDocumentFindingsToFormats(
      extractOrganizerDocumentFindings(
        `Trail 56 km - retrait des dossards guichet ${index % 12} a 16h`,
        "format-unknown",
        index + 1
      ),
      ["Trail 56 km"]
    )).flat();
    expect(findings.length).toBeGreaterThan(100);

    const claims = buildOrganizerDocumentSourceClaims(
      { sourceId: "document-verbose", fileName: "roadbook-120-pages.pdf", findings },
      { "Trail 56 km": "format-56" }
    );
    const bibPickupClaims = claims.filter((claim) => claim.field === "bibPickup");

    expect(bibPickupClaims).toHaveLength(ORGANIZER_DOCUMENT_MAX_CLAIMS_PER_SCOPE_FIELD);
    expect(new Set(bibPickupClaims.map((claim) => JSON.stringify(claim.value))).size).toBe(bibPickupClaims.length);
    expect(() => claims.forEach((claim) => sourceClaimSchema.parse(claim))).not.toThrow();
  });
});
