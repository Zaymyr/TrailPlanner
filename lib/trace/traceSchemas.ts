import { z } from "zod";

export const tracePointInputSchema = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  elevation: z.number().finite().optional().nullable(),
});

export const tracePointSchema = tracePointInputSchema.extend({
  id: z.string().uuid().optional(),
  trace_id: z.string().uuid().optional(),
  idx: z.number().int().nonnegative(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const aidStationInputSchema = z.object({
  name: z.string().trim().min(1),
  lat: z.number().finite(),
  lng: z.number().finite(),
  type: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const aidStationSchema = aidStationInputSchema.extend({
  id: z.string().uuid().optional(),
  trace_id: z.string().uuid().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const traceRowSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string().trim(),
  is_public: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const traceSummarySchema = traceRowSchema;

export const traceDetailSchema = z.object({
  trace: traceRowSchema,
  points: z.array(tracePointSchema),
  aidStations: z.array(aidStationSchema),
});

export const traceSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  isPublic: z.boolean().default(false),
  points: z.array(
    tracePointInputSchema.extend({
      idx: z.number().int().nonnegative(),
    })
  ).min(1),
  aidStations: z.array(
    aidStationInputSchema.extend({
      id: z.string().uuid().optional(),
    })
  ).optional().default([]),
});

export const traceSearchFiltersSchema = z.object({
  search: z.string().trim().optional(),
});

export const traceListResponseSchema = z.object({
  myTraces: z.array(traceSummarySchema),
  publicTraces: z.array(traceSummarySchema),
});

export type TraceSummary = z.infer<typeof traceSummarySchema>;
export type TracePoint = z.infer<typeof tracePointSchema>;
export type AidStation = z.infer<typeof aidStationSchema>;
export type TraceDetail = z.infer<typeof traceDetailSchema>;
export type TraceSavePayload = z.infer<typeof traceSaveSchema>;
