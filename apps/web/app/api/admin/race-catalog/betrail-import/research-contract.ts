import { z } from "zod";
import { organizerRaceDetailsSchema } from "../../../../../lib/organizer-dashboard-details";

const proofSchema = z.object({
  value: z.union([z.string().max(20_000), z.number().finite()]),
  evidence: z.string().min(1).max(30_000),
  context: z.string().max(2_000).optional(),
  source_url: z.string().url().refine(value => /^https?:\/\//i.test(value)),
  status: z.literal("verified"),
  method: z.string().max(100),
  edition_year: z.string().regex(/^20\d{2}$/),
});
export const researchSchema = z.object({
  schemaVersion: z.literal("2"),
  formatKey: z.string().min(1).max(100),
  fields: z.record(z.string().max(20_000)),
  provenance: z.record(proofSchema),
  candidates: z.record(z.string().max(2_000)),
  route: z.object({url:z.string().max(2_000), status:z.string().max(100), sha256:z.string().max(64)}),
}).superRefine((research, context) => {
  for (const field of ["race_date", "location", "distance_km"]) if (!research.fields[field]) context.addIssue({code:z.ZodIssueCode.custom,message:`Missing verified ${field}`});
  for (const [field,value] of Object.entries(research.fields)) {
    const proof = research.provenance[field];
    if (!proof || String(proof.value) !== value) context.addIssue({code:z.ZodIssueCode.custom,message:`Evidence/value mismatch: ${field}`});
  }
  for (const field of ["distance_km","elevation_gain_m","elevation_loss_m","latitude","longitude","altitude_min_m","altitude_max_m"]) {
    if (research.fields[field] !== undefined && (!research.fields[field].trim() || !Number.isFinite(Number(research.fields[field])))) context.addIssue({code:z.ZodIssueCode.custom,message:`Invalid numeric ${field}`});
  }
  if (!(Number(research.fields.distance_km) > 0)) context.addIssue({code:z.ZodIssueCode.custom,message:"Invalid distance"});
  for (const field of ["elevation_gain_m","elevation_loss_m"]) if (Number(research.fields[field]) < 0) context.addIssue({code:z.ZodIssueCode.custom,message:`Invalid ${field}`});
  for (const field of ["start_time","end_time"]) if (research.fields[field] !== undefined && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(research.fields[field])) context.addIssue({code:z.ZodIssueCode.custom,message:`Invalid ${field}`});
});

// Preserve the complete field-level evidence in the existing JSONB column.
// Only established dashboard keys are mapped to displayed information.
export const buildResearchDetails = (research: z.infer<typeof researchSchema>) => {
  const f = research.fields;
  const details = organizerRaceDetailsSchema.parse({
    raceLocation: {label:f.location},
    schedule: {startTime:f.start_time, finishCutoffTime:f.end_time, cutoffNote:f.cutoff_times},
    mandatoryEquipment: {note:f.mandatory_equipment},
    bibPickup: {note:f.bib_pickup, overrideEnabled:Boolean(f.bib_pickup)},
    access: {startAddress:f.location, note:f.access, officialParkings:f.parking, shuttles:f.shuttle, mapUrl:f.maps_url, overrideEnabled:true},
    runnerInfo: {note:f.event_details},
  });
  return {...details, catalogResearch:research};
};
