import "server-only";

import { z } from "zod";

const nullableText = z.string().trim().max(500).nullable();
const nullableShortText = z.string().trim().max(200).nullable();
const nullableClock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable();

const aidStationProposalSchema = z.object({
  amenities: z.object({ toilets: z.boolean(), shelter: z.boolean(), medical: z.boolean(), hotDrinks: z.boolean(), hotFood: z.boolean() }),
  dropBagAvailable: z.boolean(),
  maxStopMinutes: z.number().int().positive().max(600).nullable(),
  supportersAccess: z.enum(["allowed", "restricted", "forbidden"]).nullable(),
  cutoffTime: nullableClock,
  cutoffDayOffset: z.number().int().min(0).max(2).nullable(),
  note: nullableShortText,
});

const accessProposalSchema = z.object({
  parkings: z.array(z.object({ name: z.string().trim().min(1).max(120), address: nullableText, capacity: z.number().int().positive().nullable(), paid: z.boolean().nullable(), note: nullableShortText })).max(12),
  shuttleLines: z.array(z.object({ from: z.string().trim().min(1).max(200), to: z.string().trim().min(1).max(200), startTime: nullableClock, endTime: nullableClock, frequencyMinutes: z.number().int().positive().max(1440).nullable(), bookingUrl: z.string().url().nullable(), free: z.boolean().nullable(), note: nullableShortText })).max(12),
});

const bibPickupProposalSchema = z.object({
  requiredDocumentKinds: z.array(z.enum(["id_card", "registration_qr", "medical_certificate", "license_or_pps", "parental_authorization", "other"])),
  requiredDocumentsOther: nullableShortText,
  thirdPartyPickupAllowed: z.boolean().nullable(),
  thirdPartyDocumentKinds: z.array(z.enum(["id_copy", "proxy_letter", "registration_qr", "other"])),
  thirdPartyDocumentsOther: nullableShortText,
});

const runnerInfoProposalSchema = z.object({
  startArea: z.object({ address: nullableText, opensAt: nullableClock, note: nullableShortText }),
  briefing: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), time: nullableClock, location: nullableText, videoUrl: z.string().url().nullable(), mandatory: z.boolean(), note: nullableShortText }),
  rules: z.object({ regulationUrl: z.string().url().nullable(), polesAllowed: z.enum(["allowed", "partial", "forbidden"]).nullable(), cupRequired: z.boolean().nullable(), musicAllowed: z.boolean().nullable(), outsideAssistanceForbidden: z.boolean().nullable(), note: nullableShortText }),
});

const equipmentProposalSchema = z.object({
  checkpoints: z.array(z.enum(["bib_pickup", "start", "course"])),
  shortNote: nullableShortText,
});

export const organizerLegacyBlockSchema = z.enum(["aid_station", "access", "bib_pickup", "runner_info", "equipment"]);
export type OrganizerLegacyBlock = z.infer<typeof organizerLegacyBlockSchema>;

const proposalSchemas = {
  aid_station: aidStationProposalSchema,
  access: accessProposalSchema,
  bib_pickup: bibPickupProposalSchema,
  runner_info: runnerInfoProposalSchema,
  equipment: equipmentProposalSchema,
} as const;

const jsonSchemas: Record<OrganizerLegacyBlock, Record<string, unknown>> = {
  aid_station: {
    type: "object", additionalProperties: false, required: ["amenities", "dropBagAvailable", "maxStopMinutes", "supportersAccess", "cutoffTime", "cutoffDayOffset", "note"],
    properties: {
      amenities: { type: "object", additionalProperties: false, required: ["toilets", "shelter", "medical", "hotDrinks", "hotFood"], properties: Object.fromEntries(["toilets", "shelter", "medical", "hotDrinks", "hotFood"].map((key) => [key, { type: "boolean" }])) },
      dropBagAvailable: { type: "boolean" },
      maxStopMinutes: { type: ["integer", "null"], minimum: 1, maximum: 600 }, supportersAccess: { type: ["string", "null"], enum: ["allowed", "restricted", "forbidden", null] },
      cutoffTime: { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }, cutoffDayOffset: { type: ["integer", "null"], minimum: 0, maximum: 2 }, note: { type: ["string", "null"], maxLength: 200 },
    },
  },
  access: {
    type: "object", additionalProperties: false, required: ["parkings", "shuttleLines"], properties: {
      parkings: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["name", "address", "capacity", "paid", "note"], properties: { name: { type: "string" }, address: { type: ["string", "null"] }, capacity: { type: ["integer", "null"] }, paid: { type: ["boolean", "null"] }, note: { type: ["string", "null"] } } } },
      shuttleLines: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["from", "to", "startTime", "endTime", "frequencyMinutes", "bookingUrl", "free", "note"], properties: { from: { type: "string" }, to: { type: "string" }, startTime: { type: ["string", "null"] }, endTime: { type: ["string", "null"] }, frequencyMinutes: { type: ["integer", "null"] }, bookingUrl: { type: ["string", "null"] }, free: { type: ["boolean", "null"] }, note: { type: ["string", "null"] } } } },
    },
  },
  bib_pickup: {
    type: "object", additionalProperties: false, required: ["requiredDocumentKinds", "requiredDocumentsOther", "thirdPartyPickupAllowed", "thirdPartyDocumentKinds", "thirdPartyDocumentsOther"], properties: {
      requiredDocumentKinds: { type: "array", items: { type: "string", enum: ["id_card", "registration_qr", "medical_certificate", "license_or_pps", "parental_authorization", "other"] } }, requiredDocumentsOther: { type: ["string", "null"] }, thirdPartyPickupAllowed: { type: ["boolean", "null"] }, thirdPartyDocumentKinds: { type: "array", items: { type: "string", enum: ["id_copy", "proxy_letter", "registration_qr", "other"] } }, thirdPartyDocumentsOther: { type: ["string", "null"] },
    },
  },
  runner_info: {
    type: "object", additionalProperties: false, required: ["startArea", "briefing", "rules"], properties: {
      startArea: { type: "object", additionalProperties: false, required: ["address", "opensAt", "note"], properties: { address: { type: ["string", "null"] }, opensAt: { type: ["string", "null"] }, note: { type: ["string", "null"] } } },
      briefing: { type: "object", additionalProperties: false, required: ["date", "time", "location", "videoUrl", "mandatory", "note"], properties: { date: { type: ["string", "null"] }, time: { type: ["string", "null"] }, location: { type: ["string", "null"] }, videoUrl: { type: ["string", "null"] }, mandatory: { type: "boolean" }, note: { type: ["string", "null"] } } },
      rules: { type: "object", additionalProperties: false, required: ["regulationUrl", "polesAllowed", "cupRequired", "musicAllowed", "outsideAssistanceForbidden", "note"], properties: { regulationUrl: { type: ["string", "null"] }, polesAllowed: { type: ["string", "null"], enum: ["allowed", "partial", "forbidden", null] }, cupRequired: { type: ["boolean", "null"] }, musicAllowed: { type: ["boolean", "null"] }, outsideAssistanceForbidden: { type: ["boolean", "null"] }, note: { type: ["string", "null"] } } },
    },
  },
  equipment: { type: "object", additionalProperties: false, required: ["checkpoints", "shortNote"], properties: { checkpoints: { type: "array", items: { type: "string", enum: ["bib_pickup", "start", "course"] } }, shortNote: { type: ["string", "null"] } } },
};

export class OrganizerLegacyConversionError extends Error {}

export async function convertOrganizerLegacyBlock(input: { block: OrganizerLegacyBlock; text: string; apiKey?: string | null; model?: string }) {
  const text = input.text.trim();
  if (!text) throw new OrganizerLegacyConversionError("Le texte à convertir est vide.");
  const apiKey = input.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OrganizerLegacyConversionError("La conversion assistée est momentanément indisponible.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model ?? process.env.OPENAI_IMPORT_MODEL ?? "gpt-4.1-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "Convertis uniquement les informations explicitement présentes en données structurées. N'invente rien. Normalise les heures (par exemple 9h en 09:00). Utilise null ou [] lorsqu'une information manque." },
        { role: "user", content: text },
      ],
      response_format: { type: "json_schema", json_schema: { name: `organizer_${input.block}_proposal`, strict: true, schema: jsonSchemas[input.block] } },
    }),
  });
  if (!response.ok) throw new OrganizerLegacyConversionError("La conversion assistée n'a pas abouti. Réessaie plus tard.");
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string; refusal?: string } }> };
  const message = payload.choices?.[0]?.message;
  if (message?.refusal || !message?.content) throw new OrganizerLegacyConversionError("Aucune proposition exploitable n'a été produite.");
  let candidate: unknown;
  try { candidate = JSON.parse(message.content); } catch { throw new OrganizerLegacyConversionError("La proposition reçue est illisible."); }
  const parsed = proposalSchemas[input.block].safeParse(candidate);
  if (!parsed.success) throw new OrganizerLegacyConversionError("La proposition reçue ne respecte pas le format attendu.");
  return parsed.data;
}
