// Overpass API client for the course terrain job (OpenStreetMap, ODbL).
// Lessons from the prototype (docs/03-business-rules/course-terrain.md): the client must wait
// longer than the server-side `[timeout:N]`, an HTTP 200 carrying a runtime `remark` is a failure,
// small bboxes avoid the timeouts of the public instances on ultras.

import { z } from "zod";

import type { Bbox } from "./geometry";
import type { OsmWay } from "./matching";

export const OVERPASS_USER_AGENT = "PaceYourself/1.0 (+https://pace-yourself.com)";
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;
/** Server-side query timeout, seconds. */
export const OVERPASS_SERVER_TIMEOUT_S = 25;
/** Client abort, strictly longer than the server timeout so the server error is what we read. */
export const OVERPASS_CLIENT_TIMEOUT_MS = 35_000;
export const OVERPASS_MAX_TRIES = 4;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

/** Ways that are not physically runnable or not built yet. */
const EXCLUDED_HIGHWAYS = "proposed|construction|abandoned|razed|platform|bus_stop|elevator";

export class OverpassError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverpassError";
  }
}

const elementSchema = z.object({
  type: z.string(),
  id: z.number(),
  tags: z.record(z.string()).optional(),
  geometry: z.array(z.object({ lat: z.number(), lon: z.number() }).nullable()).optional(),
});

const responseSchema = z.object({
  elements: z.array(z.unknown()).default([]),
  remark: z.string().optional(),
});

export function buildOverpassQuery(bbox: Bbox): string {
  const box = [bbox.south, bbox.west, bbox.north, bbox.east].map((value) => value.toFixed(6)).join(",");
  return `[out:json][timeout:${OVERPASS_SERVER_TIMEOUT_S}];way["highway"]["highway"!~"^(${EXCLUDED_HIGHWAYS})$"](${box});out tags geom;`;
}

/** Parses an Overpass JSON body; a runtime-error `remark` (timeout, memory) is a failure. */
export function parseOverpassWays(body: unknown): OsmWay[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new OverpassError("Unexpected Overpass response");
  if (parsed.data.remark && /error|timed out|timeout|out of memory|runtime/i.test(parsed.data.remark)) {
    throw new OverpassError(`Overpass remark: ${parsed.data.remark.slice(0, 200)}`);
  }
  const ways: OsmWay[] = [];
  for (const element of parsed.data.elements) {
    const way = elementSchema.safeParse(element);
    if (!way.success || way.data.type !== "way" || !way.data.geometry) continue;
    const geometry = way.data.geometry.filter((node): node is { lat: number; lon: number } => node !== null);
    if (geometry.length >= 2) ways.push({ id: way.data.id, tags: way.data.tags, geometry });
  }
  return ways;
}

export type OverpassClientOptions = {
  fetchImpl?: typeof fetch;
  endpoints?: readonly string[];
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Epoch ms after which no new request may start (the cron time budget). */
  deadline: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetches the highway ways intersecting `bbox`. Tries alternate between endpoints with a short
 * backoff; never starts a request that could outlive `deadline`.
 */
export async function fetchOverpassWays(bbox: Bbox, options: OverpassClientOptions): Promise<OsmWay[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoints = options.endpoints ?? OVERPASS_ENDPOINTS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const body = `data=${encodeURIComponent(buildOverpassQuery(bbox))}`;
  let lastError: Error = new OverpassError("Overpass not attempted");

  for (let attempt = 0; attempt < OVERPASS_MAX_TRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]!;
      if (now() + delay + OVERPASS_CLIENT_TIMEOUT_MS > options.deadline) break;
      await sleep(delay);
    }
    if (now() + OVERPASS_CLIENT_TIMEOUT_MS > options.deadline) break;
    const endpoint = endpoints[attempt % endpoints.length]!;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": OVERPASS_USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(OVERPASS_CLIENT_TIMEOUT_MS),
      });
      if (!response.ok) {
        lastError = new OverpassError(`${new URL(endpoint).host} HTTP ${response.status}`);
        continue;
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new OverpassError(`${new URL(endpoint).host} returned a non-JSON body`);
      }
      return parseOverpassWays(json);
    } catch (cause) {
      lastError = cause instanceof OverpassError
        ? cause
        : new OverpassError(`${new URL(endpoint).host} ${cause instanceof Error ? cause.name : "request"} failed`);
    }
  }
  throw lastError;
}
