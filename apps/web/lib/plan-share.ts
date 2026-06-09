import crypto from "node:crypto";
import { z } from "zod";

export const PLAN_SHARE_SCHEMA_VERSION = 1;
export const PLAN_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,160}$/;
const DEFAULT_PLAN_SHARE_BASE_URL = "https://pace-yourself.com";
const STABLE_PLAN_SHARE_TOKEN_SCOPE = "plan-share-link-v1";

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

export function generatePlanShareId() {
  return crypto.randomUUID();
}

export function generateStablePlanShareToken(shareId: string, secret: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${STABLE_PLAN_SHARE_TOKEN_SCOPE}:${shareId.toLowerCase()}`, "utf8")
    .digest("base64url");
}

export function hashPlanShareToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidPlanShareToken(token: string) {
  return PLAN_SHARE_TOKEN_PATTERN.test(token);
}

function normalizePlanShareBaseUrl(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, "") ?? "";
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "vercel.app" || hostname.endsWith(".vercel.app")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPlanShareBaseUrl() {
  const configured = [
    process.env.PLAN_SHARE_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_URL,
  ]
    .map(normalizePlanShareBaseUrl)
    .find((value): value is string => Boolean(value));

  return configured ?? DEFAULT_PLAN_SHARE_BASE_URL;
}

export function buildPlanShareUrl(token: string) {
  return new URL(`/share/plan/${token}`, getPlanShareBaseUrl()).toString();
}
