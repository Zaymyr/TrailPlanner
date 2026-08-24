import "server-only";

import { z } from "zod";

import { serviceHeaders, type OrganizerAuth } from "./organizer";
import { getSupabaseServiceConfig } from "./supabase";

export const organizerImportSessionStatusSchema = z.enum([
  "discovered",
  "formats_confirmed",
  "fields_analyzed",
  "applied",
  "cancelled",
]);

const temporaryDocumentSchema = z.object({
  path: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  mediaType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().nonnegative(),
});

export const organizerImportSourceManifestSchema = z.object({
  url: z.string().url().or(z.literal("")),
  additionalUrls: z.array(z.string().url()).optional(),
  formatUrls: z.array(z.string().url()).optional(),
  documents: z.array(temporaryDocumentSchema).default([]),
}).transform(({ additionalUrls, formatUrls, ...manifest }) => ({
  ...manifest,
  additionalUrls: additionalUrls ?? formatUrls ?? [],
}));

export const organizerImportSessionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_id: z.string().uuid(),
  created_by: z.string().uuid(),
  status: organizerImportSessionStatusSchema,
  source_manifest: organizerImportSourceManifestSchema,
  discovery_snapshot: z.unknown().nullable(),
  confirmed_formats: z.unknown().nullable(),
  field_snapshot: z.unknown().nullable(),
  expires_at: z.string().datetime({ offset: true }),
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
});

export type OrganizerImportSourceManifest = z.infer<typeof organizerImportSourceManifestSchema>;
export type OrganizerImportSession = z.infer<typeof organizerImportSessionSchema>;

const sessionSelect = [
  "id",
  "event_id",
  "edition_id",
  "created_by",
  "status",
  "source_manifest",
  "discovery_snapshot",
  "confirmed_formats",
  "field_snapshot",
  "expires_at",
  "created_at",
  "updated_at",
].join(",");

export async function createOrganizerImportSession(
  auth: OrganizerAuth,
  input: {
    eventId: string;
    editionId: string;
    sourceManifest: OrganizerImportSourceManifest;
    discoverySnapshot: unknown;
  }
) {
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_import_sessions`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
    body: JSON.stringify({
      event_id: input.eventId,
      edition_id: input.editionId,
      created_by: auth.user.id,
      status: "discovered",
      source_manifest: input.sourceManifest,
      discovery_snapshot: input.discoverySnapshot,
      expires_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Unable to create organizer import session", await response.text());
    return null;
  }
  return z.array(organizerImportSessionSchema).parse(await response.json())[0] ?? null;
}

export async function loadOrganizerImportSession(auth: OrganizerAuth, sessionId: string, eventId: string) {
  const query = new URLSearchParams({
    id: `eq.${sessionId}`,
    event_id: `eq.${eventId}`,
    created_by: `eq.${auth.user.id}`,
    expires_at: `gt.${new Date().toISOString()}`,
    select: sessionSelect,
    limit: "1",
  });
  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_import_sessions?${query.toString()}`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!response.ok) {
    console.error("Unable to load organizer import session", await response.text());
    return null;
  }
  return z.array(organizerImportSessionSchema).parse(await response.json())[0] ?? null;
}

export async function updateOrganizerImportSession(
  auth: OrganizerAuth,
  session: OrganizerImportSession,
  patch: Partial<Pick<OrganizerImportSession, "status" | "confirmed_formats" | "field_snapshot">>
) {
  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_import_sessions?id=eq.${session.id}&event_id=eq.${session.event_id}&created_by=eq.${auth.user.id}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify(patch),
      cache: "no-store",
    }
  );
  if (!response.ok) {
    console.error("Unable to update organizer import session", await response.text());
    return null;
  }
  return z.array(organizerImportSessionSchema).parse(await response.json())[0] ?? null;
}

export async function deleteOrganizerImportDocuments(
  auth: Pick<OrganizerAuth, "serviceConfig">,
  documents: OrganizerImportSourceManifest["documents"]
) {
  const results = await Promise.all(
    documents.map((document) =>
      fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/organizer-imports/${document.path}`, {
        method: "DELETE",
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }).catch(() => null)
    )
  );
  return results.every((response) => response === null || response.ok || response.status === 404);
}

export async function deleteOrganizerImportSession(auth: OrganizerAuth, session: OrganizerImportSession) {
  await deleteOrganizerImportDocuments(auth, session.source_manifest.documents);
  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_import_sessions?id=eq.${session.id}&event_id=eq.${session.event_id}&created_by=eq.${auth.user.id}`,
    { method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!response.ok) console.error("Unable to delete organizer import session", await response.text());
  return response.ok;
}

export async function cleanupExpiredOrganizerImportSessions(limit = 100) {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) throw new Error("Supabase service configuration is missing.");

  const query = new URLSearchParams({
    expires_at: `lte.${new Date().toISOString()}`,
    select: sessionSelect,
    order: "expires_at.asc",
    limit: String(Math.max(1, Math.min(limit, 500))),
  });
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/organizer_import_sessions?${query.toString()}`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );
  if (!response.ok) throw new Error("Unable to load expired organizer import sessions.");
  const sessions = z.array(organizerImportSessionSchema).parse(await response.json());
  let deleted = 0;
  let failed = 0;

  for (const session of sessions) {
    const documentsDeleted = await deleteOrganizerImportDocuments(
      { serviceConfig },
      session.source_manifest.documents
    );
    if (!documentsDeleted) {
      failed += 1;
      continue;
    }
    const deleteResponse = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/organizer_import_sessions?id=eq.${session.id}`,
      { method: "DELETE", headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
    );
    if (deleteResponse.ok) deleted += 1;
    else failed += 1;
  }

  return { scanned: sessions.length, deleted, failed };
}
