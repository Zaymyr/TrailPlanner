import pdfParse from "pdf-parse";

import {
  createSourceClaim,
  organizerClaimValuesAreConcordant,
  type OrganizerImportAidStationClaim,
  type OrganizerImportClaimField,
  type OrganizerImportClaimValue,
  type SourceClaim,
} from "./organizer-import-engine";

export const ORGANIZER_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const ORGANIZER_DOCUMENT_MAX_COUNT = 8;

export type OrganizerDocumentSource = {
  sourceId: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  pageCount: number | null;
  extractionMethod: "pdf-text" | "ocr-pending";
  text: string | null;
  pages: Array<{ page: number; text: string }>;
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
  page: number | null;
};
export type OrganizerReconciledFinding = OrganizerDocumentFinding & {
  alternatives: OrganizerDocumentFinding[];
  comparison: OrganizerFindingComparison;
};

export type OrganizerFindingComparison = {
  status: "concordant" | "conflict" | "unverified" | "fill-missing" | "same";
  comparedValue: string | null;
  comparedSource: "current-data" | "website" | "gpx" | null;
};

const SUPPORTED_MEDIA_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export const extractOrganizerDocumentFindings = (
  text: string,
  scope: OrganizerDocumentFinding["scope"] = "format-unknown",
  page: number | null = null
) => {
  const findings: OrganizerDocumentFinding[] = [];
  const lines = text.split(/\n+/).map((line) => line.trim().replace(/\s+/g, " ")).filter(Boolean);
  const addMatches = (
    field: OrganizerDocumentFinding["field"],
    pattern: RegExp,
    confidence: OrganizerDocumentFinding["confidence"] = "medium",
    findingScope: OrganizerDocumentFinding["scope"] = scope
  ) => {
    lines.filter((line) => pattern.test(line)).slice(0, 8).forEach((line) => {
      findings.push({ field, value: line, scope: findingScope, formatHint: null, confidence, evidence: line, page });
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
  addMatches("emergencyContact", /(?:secours|urgence|pc course|téléphone.*organisation|telephone.*organisation).{0,120}/i, "low", "event");
  addMatches("liveTracking", /(?:suivi live|live tracking|suivre.*course|résultats|resultats).{0,120}/i, "low", "event");
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
  formats: Array<{
    name: string;
    distanceKm: number | null;
    elevationGainM: number | null;
    elevationLossM: number | null;
    startTime?: string | null;
    bibPickup?: string | null;
    cutoff?: string | null;
  }> = []
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
  formats: Array<{
    name: string;
    distanceKm: number | null;
    elevationGainM: number | null;
    elevationLossM: number | null;
    startTime?: string | null;
    bibPickup?: string | null;
    cutoff?: string | null;
  }>
): OrganizerFindingComparison => {
  const format = formats.find((candidate) => candidate.name === finding.formatHint);
  if (!format) return { status: "unverified", comparedValue: null, comparedSource: null };
  const documentValue = extractMetricNumber(finding.field, finding.value);
  const referenceValue =
    finding.field === "distanceKm" ? format.distanceKm : finding.field === "elevationGainM" ? format.elevationGainM : finding.field === "elevationLossM" ? format.elevationLossM : null;
  const textReference = finding.field === "startTime" ? format.startTime : finding.field === "bibPickup" ? format.bibPickup : finding.field === "cutoff" ? format.cutoff : null;
  if (textReference !== null && textReference !== undefined) {
    const same = finding.value.toLocaleLowerCase("fr-FR").includes(textReference.toLocaleLowerCase("fr-FR"));
    return { status: same ? "same" : "conflict", comparedValue: textReference, comparedSource: "current-data" };
  }
  if (finding.field === "startTime" || finding.field === "bibPickup" || finding.field === "cutoff") {
    return { status: "fill-missing", comparedValue: null, comparedSource: null };
  }
  if (documentValue === null || referenceValue === null) return { status: "unverified", comparedValue: null, comparedSource: null };
  return {
    status: organizerClaimValuesAreConcordant(
      finding.field as "distanceKm" | "elevationGainM" | "elevationLossM",
      documentValue,
      referenceValue
    ) ? "concordant" : "conflict",
    comparedValue: `${referenceValue}${finding.field === "distanceKm" ? " km" : " m"}`,
    comparedSource: "current-data",
  };
};

const extractTime = (value: string) => {
  const match = value.match(/\b([01]?\d|2[0-3])\s*(?:h|:|\.h)\s*([0-5]\d)?\b/i);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${(match[2] ?? "00").padStart(2, "0")}`;
};

const findingClaimValue = (
  finding: OrganizerDocumentFinding
): { field: OrganizerImportClaimField; value: OrganizerImportClaimValue } | null => {
  if (finding.field === "distanceKm" || finding.field === "elevationGainM" || finding.field === "elevationLossM") {
    const value = extractMetricNumber(finding.field, finding.value);
    return value === null ? null : { field: finding.field, value };
  }
  if (finding.field === "startTime") {
    const value = extractTime(finding.value);
    return value ? { field: "startTime", value } : null;
  }
  if (finding.field === "cutoff") {
    if (!/(?:arrivée|arrivee|finish|fermeture\s+de\s+l['’]arrivée)/i.test(finding.evidence)) return null;
    const value = extractTime(finding.value);
    return value ? { field: "finishCutoffTime", value } : null;
  }
  if (finding.field === "bibPickup") return { field: "bibPickup", value: finding.value };
  if (finding.field === "mandatoryEquipment") return { field: "mandatoryEquipment", value: [finding.value] };
  if (finding.field === "emergencyContact") return { field: "emergencyContact", value: finding.value };
  if (finding.field === "liveTracking") return { field: "liveTracking", value: finding.value };
  if (finding.field === "aidStations") {
    const distance = finding.value.match(/(?:ravitaillement|ravito)[^\d]{0,80}(?:km\s*)?(\d{1,3}(?:[.,]\d+)?)\b/i);
    if (!distance) return null;
    const distanceKm = Number(distance[1].replace(",", "."));
    if (!Number.isFinite(distanceKm)) return null;
    const nameMatch = finding.value.match(/((?:ravitaillement|ravito)[^\d]{0,60})/i);
    const station: OrganizerImportAidStationClaim = {
      name: nameMatch?.[1].trim().replace(/[-:;,]+$/, "") || `Ravitaillement km ${distanceKm}`,
      distanceKm,
      waterRefill: null,
      solidRefill: null,
      assistanceAllowed: null,
    };
    return { field: "aidStations", value: [station] };
  }
  return null;
};

export const buildOrganizerDocumentSourceClaims = (
  document: Pick<OrganizerDocumentSource, "sourceId" | "fileName" | "findings">,
  formatKeyByHint: Record<string, string> = {}
): SourceClaim[] => document.findings.flatMap((finding) => {
  const mapped = findingClaimValue(finding);
  if (!mapped) return [];
  const scope = finding.scope === "event"
    ? { kind: "event" as const, scopeKey: "event" as const }
    : finding.scope === "format" && finding.formatHint
      ? { kind: "format" as const, scopeKey: formatKeyByHint[finding.formatHint] ?? finding.formatHint }
      : null;
  if (!scope) return [];
  return [createSourceClaim({
    scope,
    field: mapped.field,
    value: mapped.value,
    source: {
      sourceId: document.sourceId,
      kind: "official-document",
      label: document.fileName,
      url: null,
      page: finding.page,
      edition: null,
    },
    evidence: finding.evidence,
    confidence: finding.confidence,
    claimRole: "candidate",
  })];
});

const renderPdfPageText = async (pageData: {
  pageNumber?: number;
  getTextContent: (options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }) => Promise<{
    items: Array<{ str?: string; transform?: number[] }>;
  }>;
}) => {
  const content = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
  let lastY: number | undefined;
  let text = "";
  for (const item of content.items) {
    const currentY = item.transform?.[5];
    if (lastY === undefined || currentY === lastY) text += item.str ?? "";
    else text += `\n${item.str ?? ""}`;
    lastY = currentY;
  }
  return text;
};

type OrganizerDocumentFile = Pick<File, "name" | "size" | "type" | "arrayBuffer">;

export function validateOrganizerDocument(file: OrganizerDocumentFile): string | null {
  if (!SUPPORTED_MEDIA_TYPES.has(file.type)) return "Type de document non pris en charge.";
  if (file.size > ORGANIZER_DOCUMENT_MAX_BYTES) return "Le document dépasse la limite de 25 Mo.";
  return null;
}

export async function extractOrganizerDocument(file: OrganizerDocumentFile, sourceId: string): Promise<OrganizerDocumentSource> {
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
      pages: [],
      status: "ocr-pending",
      message: "Image reçue. OCR à configurer avant extraction.",
      findings: [],
    };
  }

  try {
    const pages: Array<{ page: number; text: string }> = [];
    const parsed = await pdfParse(Buffer.from(await file.arrayBuffer()), {
      max: 100,
      pagerender: async (pageData: Parameters<typeof renderPdfPageText>[0]) => {
        const text = await renderPdfPageText(pageData);
        pages.push({ page: pageData.pageNumber ?? pages.length + 1, text });
        return text;
      },
    });
    const text = parsed.text.trim();
    const normalizedPages = pages
      .map((entry) => ({ ...entry, text: entry.text.trim() }))
      .filter((entry) => entry.text.length > 0);
    return {
      ...base,
      pageCount: parsed.numpages,
      extractionMethod: "pdf-text",
      text: text || null,
      pages: normalizedPages,
      status: text ? "extracted" : "ocr-pending",
      message: text ? null : "PDF sans texte exploitable. OCR nécessaire.",
      findings: text
        ? normalizedPages.length > 0
          ? normalizedPages.flatMap((entry) => extractOrganizerDocumentFindings(entry.text, "format-unknown", entry.page))
          : extractOrganizerDocumentFindings(text)
        : [],
    };
  } catch {
    return {
      ...base,
      pageCount: null,
      extractionMethod: "ocr-pending",
      text: null,
      pages: [],
      status: "rejected",
      message: "Impossible de lire ce PDF.",
      findings: [],
    };
  }
}
