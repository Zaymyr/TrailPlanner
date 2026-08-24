export const organizerImportEventFields = [
  "name",
  "location",
  "officialWebsiteUrl",
  "mandatoryEquipment",
  "startAddress",
  "shuttles",
  "officialParkings",
] as const;

export const organizerImportRaceFields = [
  "name",
  "seriesName",
  "raceDate",
  "locationText",
  "distanceKm",
  "elevationGainM",
  "elevationLossM",
  "externalSiteUrl",
  "thumbnailUrl",
  "gpx",
  "aidStations",
  "startTime",
  "finishCutoffTime",
  "bibPickup",
  "mandatoryEquipment",
] as const;

export type OrganizerImportEventField = (typeof organizerImportEventFields)[number];
export type OrganizerImportRaceField = (typeof organizerImportRaceFields)[number];
export type OrganizerImportProposalValue = string | number | boolean | null | string[] | Array<{
  name: string;
  distanceKm: number;
  waterRefill: boolean | null;
  solidRefill: boolean | null;
  assistanceAllowed: boolean | null;
}>;

export type OrganizerImportFieldProposal = {
  id: string;
  scope: "event" | "format";
  previewRaceKey: string | null;
  field: OrganizerImportEventField | OrganizerImportRaceField;
  label: string;
  value: OrganizerImportProposalValue;
  currentValue: OrganizerImportProposalValue;
  sourceKind: "gpx" | "structured-data" | "html" | "pdf" | "llm";
  sourceLabel: string;
  sourceUrl: string | null;
  evidence: string[];
  confidence: "high" | "medium" | "low";
  comparison: "fill-missing" | "same" | "conflict" | "unverified";
  recommended: boolean;
};

export type OrganizerImportProposalSnapshot = {
  version: 1;
  eventId: string;
  previewHash: string;
  expiresAt: string;
  proposals: OrganizerImportFieldProposal[];
};
