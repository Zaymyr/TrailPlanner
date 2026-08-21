import pdfParse from "pdf-parse";

export const ORGANIZER_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const ORGANIZER_DOCUMENT_MAX_COUNT = 8;

export type OrganizerDocumentSource = {
  sourceId: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  pageCount: number | null;
  extractionMethod: "pdf-text" | "ocr-pending";
  text: string | null;
  status: "extracted" | "ocr-pending" | "rejected";
  message: string | null;
  findings: OrganizerDocumentFinding[];
};

export type OrganizerDocumentFinding = {
  field: "distanceKm" | "elevationGainM" | "elevationLossM" | "startTime" | "bibPickup" | "cutoff" | "aidStations" | "mandatoryEquipment" | "emergencyContact" | "liveTracking";
  value: string;
  scope: "event" | "format" | "format-unknown";
  formatHint: string | null;
  confidence: "medium" | "low";
  evidence: string;
};
export type OrganizerReconciledFinding = OrganizerDocumentFinding & {
  alternatives: OrganizerDocumentFinding[];
  comparison: OrganizerFindingComparison;
};

export type OrganizerFindingComparison = {
  status: "concordant" | "conflict" | "unverified";
  comparedValue: string | null;
  comparedSource: "website" | "gpx" | null;
};

const SUPPORTED_MEDIA_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export const extractOrganizerDocumentFindings = (text: string, scope: OrganizerDocumentFinding["scope"] = "format-unknown") => {
  const findings: OrganizerDocumentFinding[] = [];
  const lines = text.split(/\n+/).map((line) => line.trim().replace(/\s+/g, " ")).filter(Boolean);
  const addMatches = (field: OrganizerDocumentFinding["field"], pattern: RegExp, confidence: OrganizerDocumentFinding["confidence"] = "medium") => {
    lines.filter((line) => pattern.test(line)).slice(0, 8).forEach((line) => {
      findings.push({ field, value: line, scope, formatHint: null, confidence, evidence: line });
    });
  };

  addMatches("distanceKm", /\b\d{1,3}(?:[.,]\d+)?\s*(?:km|kilom[eè]tres?)\b/i);
  addMatches("elevationGainM", /(?:d\+|d[eé]nivel[eé].{0,20}positif).{0,20}\b\d{2,5}\s*m?\b/i);
  addMatches("elevationLossM", /(?:d-|d[eé]nivel[eé].{0,20}n[eé]gatif).{0,20}\b\d{2,5}\s*m?\b/i);
  addMatches("startTime", /(?:départ|depart|course).{0,80}\b\d{1,2}[h:]\d{0,2}\b/i);
  addMatches("bibPickup", /(?:dossard|retrait|retrait des dossards).{0,180}\b\d{1,2}\s*h/i);
  addMatches("cutoff", /(?:barrière|barriere|cut.?off|arrivée|arrivee).{0,120}\b\d{1,2}\s*h/i);
  addMatches("aidStations", /(?:ravit|ravito|ravitaillement).{0,100}\b(?:km\s*)?\d{1,3}(?:[.,]\d+)?/i);
  addMatches("mandatoryEquipment", /(?:matériel|materiel|équipement|equipement).{0,160}(?:obligatoire|requis)/i);
  addMatches("emergencyContact", /(?:secours|urgence|pc course|téléphone.*organisation|telephone.*organisation).{0,120}/i, "low");
  addMatches("liveTracking", /(?:suivi live|live tracking|suivre.*course|résultats|resultats).{0,120}/i, "low");
  return findings;
};

export const attachDocumentFindingsToFormats = (findings: OrganizerDocumentFinding[], formatNames: string[]) =>
  findings.map((finding) => {
    const normalizedEvidence = finding.evidence.toLocaleLowerCase("fr-FR");
    const formatHint = formatNames.find((name) => {
      const normalizedName = name.trim().toLocaleLowerCase("fr-FR");
      return normalizedName.length >= 3 && normalizedEvidence.includes(normalizedName);
    });
    if (formatHint) return { ...finding, scope: "format" as const, formatHint };

    const distanceMatch = finding.evidence.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*(?:km|kilom[eè]tres?)\b/i);
    if (!distanceMatch) return finding;
    const distance = Number(distanceMatch[1].replace(",", "."));
    const matchingName = formatNames.find((name) => {
      const nameDistance = name.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*(?:km|kilom[eè]tres?)\b/i);
      return nameDistance && Math.abs(Number(nameDistance[1].replace(",", ".")) - distance) <= 1;
    });
    return matchingName ? { ...finding, scope: "format" as const, formatHint: matchingName } : finding;
  });
export const reconcileOrganizerDocumentFindings = (
  findings: OrganizerDocumentFinding[],
  formats: Array<{ name: string; distanceKm: number | null; elevationGainM: number | null; elevationLossM: number | null }> = []
): OrganizerReconciledFinding[] => {
  const groups = new Map<string, OrganizerDocumentFinding[]>();
  findings.forEach((finding) => {
    const key = `${finding.field}:${finding.formatHint ?? "event"}`;
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  });

  return [...groups.values()].flatMap((group) => {
    const sorted = [...group].sort((left, right) => (left.confidence === "medium" ? 0 : 1) - (right.confidence === "medium" ? 0 : 1));
    const selected = sorted[0];
    if (!selected) return [];
    return [{ ...selected, alternatives: sorted.slice(1), comparison: compareFindingWithFormats(selected, formats) }];
  });
};

const extractMetricNumber = (field: OrganizerDocumentFinding["field"], value: string) => {
  const pattern = field === "distanceKm" ? /\b(\d{1,3}(?:[.,]\d+)?)\s*(?:km|kilom[eè]tres?)\b/i : /(?:d\+|d-|positif|n[eé]gatif)[^\d]{0,20}(\d{2,5}(?:[.,]\d+)?)/i;
  const match = value.match(pattern) ?? value.match(/\b\d{1,5}(?:[.,]\d+)?\b/);
  return match ? Number((match[1] ?? match[0]).replace(",", ".")) : null;
};

const compareFindingWithFormats = (
  finding: OrganizerDocumentFinding,
  formats: Array<{ name: string; distanceKm: number | null; elevationGainM: number | null; elevationLossM: number | null }>
): OrganizerFindingComparison => {
  const format = formats.find((candidate) => candidate.name === finding.formatHint);
  if (!format) return { status: "unverified", comparedValue: null, comparedSource: null };
  const documentValue = extractMetricNumber(finding.field, finding.value);
  const referenceValue =
    finding.field === "distanceKm" ? format.distanceKm : finding.field === "elevationGainM" ? format.elevationGainM : finding.field === "elevationLossM" ? format.elevationLossM : null;
  if (documentValue === null || referenceValue === null) return { status: "unverified", comparedValue: null, comparedSource: null };
  const tolerance = finding.field === "distanceKm" ? 1 : 25;
  return {
    status: Math.abs(documentValue - referenceValue) <= tolerance ? "concordant" : "conflict",
    comparedValue: `${referenceValue}${finding.field === "distanceKm" ? " km" : " m"}`,
    comparedSource: format.distanceKm === referenceValue && finding.field === "distanceKm" ? "website" : "website",
  };
};

export function validateOrganizerDocument(file: File): string | null {
  if (!SUPPORTED_MEDIA_TYPES.has(file.type)) return "Type de document non pris en charge.";
  if (file.size > ORGANIZER_DOCUMENT_MAX_BYTES) return "Le document dépasse la limite de 15 Mo.";
  return null;
}

export async function extractOrganizerDocument(file: File, sourceId: string): Promise<OrganizerDocumentSource> {
  const base = {
    sourceId,
    fileName: file.name,
    mediaType: file.type,
    sizeBytes: file.size,
  };

  if (file.type !== "application/pdf") {
    return {
      ...base,
      pageCount: null,
      extractionMethod: "ocr-pending",
      text: null,
      status: "ocr-pending",
      message: "Image reçue. OCR à configurer avant extraction.",
      findings: [],
    };
  }

  try {
    const parsed = await pdfParse(Buffer.from(await file.arrayBuffer()), { max: 100 });
    const text = parsed.text.trim();
    return {
      ...base,
      pageCount: parsed.numpages,
      extractionMethod: "pdf-text",
      text: text || null,
      status: text ? "extracted" : "ocr-pending",
      message: text ? null : "PDF sans texte exploitable. OCR nécessaire.",
      findings: text ? extractOrganizerDocumentFindings(text) : [],
    };
  } catch {
    return {
      ...base,
      pageCount: null,
      extractionMethod: "ocr-pending",
      text: null,
      status: "rejected",
      message: "Impossible de lire ce PDF.",
      findings: [],
    };
  }
}
