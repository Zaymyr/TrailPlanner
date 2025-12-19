import { z } from "zod";

import { traceDetailSchema, traceListResponseSchema, traceSaveSchema, traceSummarySchema } from "./traceSchemas";

export type TraceSummaryView = {
  id: string;
  ownerId: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TracePointView = {
  id?: string;
  idx: number;
  lat: number;
  lng: number;
  elevation?: number | null;
};

export type AidStationView = {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  type?: string;
  notes?: string;
};

export type TraceDetailView = {
  trace: TraceSummaryView;
  points: TracePointView[];
  aidStations: AidStationView[];
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const mapTraceSummary = (row: z.infer<typeof traceSummarySchema>): TraceSummaryView => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  isPublic: row.is_public,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapDetail = (data: z.infer<typeof traceDetailSchema>): TraceDetailView => ({
  trace: mapTraceSummary(data.trace),
  points: data.points
    .slice()
    .sort((a, b) => a.idx - b.idx)
    .map((point) => ({
      id: point.id,
      idx: point.idx,
      lat: point.lat,
      lng: point.lng,
      elevation: point.elevation ?? null,
    })),
  aidStations: data.aidStations.map((station) => ({
    id: station.id,
    name: station.name,
    lat: station.lat,
    lng: station.lng,
    type: station.type,
    notes: station.notes,
  })),
});

const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

const buildAuthHeaders = (accessToken: string): HeadersInit => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

export const fetchTraceLists = async (
  accessToken: string,
  search?: string,
  fetcher: Fetcher = defaultFetcher
): Promise<{ myTraces: TraceSummaryView[]; publicTraces: TraceSummaryView[] }> => {
  if (!accessToken) {
    throw new Error("Missing access token");
  }

  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL("/api/trace/list", origin);
  if (search) {
    url.searchParams.set("search", search);
  }

  const response = await fetcher(url.toString(), {
    headers: buildAuthHeaders(accessToken),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error((data as { message?: string } | null)?.message ?? "Unable to load traces");
  }

  const parsed = traceListResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid trace list response");
  }

  return {
    myTraces: parsed.data.myTraces.map(mapTraceSummary),
    publicTraces: parsed.data.publicTraces.map(mapTraceSummary),
  };
};

export const fetchTraceById = async (
  accessToken: string,
  id: string,
  fetcher: Fetcher = defaultFetcher
): Promise<TraceDetailView> => {
  if (!accessToken) {
    throw new Error("Missing access token");
  }

  const response = await fetcher(`/api/trace/get/${id}`, {
    headers: buildAuthHeaders(accessToken),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error((data as { message?: string } | null)?.message ?? "Unable to load trace");
  }

  const parsed = traceDetailSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid trace detail response");
  }

  return mapDetail(parsed.data);
};

export const saveTrace = async (
  accessToken: string,
  payload: unknown,
  fetcher: Fetcher = defaultFetcher
): Promise<TraceDetailView> => {
  if (!accessToken) {
    throw new Error("Missing access token");
  }

  const body = traceSaveSchema.parse(payload);

  const response = await fetcher("/api/trace/save", {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error((data as { message?: string } | null)?.message ?? "Unable to save trace");
  }

  const parsed = traceDetailSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid trace response");
  }

  return mapDetail(parsed.data);
};

export const deleteTrace = async (accessToken: string, id: string, fetcher: Fetcher = defaultFetcher): Promise<void> => {
  if (!accessToken) {
    throw new Error("Missing access token");
  }

  const response = await fetcher(`/api/trace/delete/${id}`, {
    method: "DELETE",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Unable to delete trace");
  }
};

export const duplicateTrace = async (
  accessToken: string,
  id: string,
  fetcher: Fetcher = defaultFetcher
): Promise<TraceDetailView> => {
  if (!accessToken) {
    throw new Error("Missing access token");
  }

  const response = await fetcher(`/api/trace/duplicate/${id}`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error((data as { message?: string } | null)?.message ?? "Unable to duplicate trace");
  }

  const parsed = traceDetailSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid trace response");
  }

  return mapDetail(parsed.data);
};
