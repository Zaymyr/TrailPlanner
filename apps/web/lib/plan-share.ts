import crypto from "node:crypto";
import { z } from "zod";

export const PLAN_SHARE_SCHEMA_VERSION = 1;
export const PLAN_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,160}$/;

const shareProductSchema = z
  .object({
    productId: z.string().min(1).max(120),
    name: z.string().trim().min(1).max(180),
    brand: z.string().trim().max(160).nullable(),
    quantity: z.number().finite().nonnegative().max(999),
    carbsG: z.number().finite().nonnegative().max(100000),
    sodiumMg: z.number().finite().nonnegative().max(1000000),
  })
  .passthrough();

const shareCheckpointSchema = z
  .object({
    index: z.number().int().nonnegative().max(1000),
    name: z.string().trim().min(1).max(180),
    distanceKm: z.number().finite().nonnegative().max(1000),
    isStart: z.boolean(),
    isFinish: z.boolean(),
    arrivalMinute: z.number().finite().nonnegative().max(100000),
    pauseMinutes: z.number().finite().nonnegative().max(10000),
    supplies: z.array(shareProductSchema).max(250),
    waterState: z.enum(["full", "refill", "unavailable", "finish"]),
    solidState: z.enum(["available", "unavailable", "finish"]),
  })
  .passthrough();

export const planShareSnapshotSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(180),
    distanceKm: z.number().finite().nonnegative().max(1000),
    elevationGainM: z.number().finite().nonnegative().max(100000),
    waterBagLiters: z.number().finite().nonnegative().max(20),
    targetCarbsPerHour: z.number().finite().nonnegative().max(250),
    targetWaterPerHour: z.number().finite().nonnegative().max(3000),
    targetSodiumPerHour: z.number().finite().nonnegative().max(5000),
    totalDurationMin: z.number().finite().nonnegative().max(100000),
    totalProductUnits: z.number().finite().nonnegative().max(10000),
    totalCarbsG: z.number().finite().nonnegative().max(100000),
    totalSodiumMg: z.number().finite().nonnegative().max(1000000),
    productTotals: z.array(shareProductSchema).max(250),
    checkpoints: z.array(shareCheckpointSchema).min(1).max(500),
  })
  .passthrough();

export type PlanShareSnapshot = z.infer<typeof planShareSnapshotSchema>;

export const departureTimeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);

export const localeSchema = z.enum(["fr", "en"]);

export function generatePlanShareToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPlanShareToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidPlanShareToken(token: string) {
  return PLAN_SHARE_TOKEN_PATTERN.test(token);
}

export function getPlanShareBaseUrl(request?: Request) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WEB_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : "");

  if (configured) return configured.replace(/\/+$/, "");
  if (request) return new URL(request.url).origin;
  return "https://pace-yourself.com";
}

export function buildPlanShareUrl(token: string, request?: Request) {
  return new URL(`/share/plan/${token}`, getPlanShareBaseUrl(request)).toString();
}
