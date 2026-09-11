import { randomUUID } from "node:crypto";

import type { SupabaseServiceConfig } from "./supabase";

export const ORGANIZER_INVOICE_BUCKET = "organizer-invoices";
export const MAX_ORGANIZER_INVOICE_SIZE = 10 * 1024 * 1024;

const headers = (config: SupabaseServiceConfig, contentType?: string) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

export async function validateOrganizerInvoice(file: File): Promise<ArrayBuffer> {
  if (file.size === 0) throw new Error("La facture est vide.");
  if (file.size > MAX_ORGANIZER_INVOICE_SIZE) throw new Error("La facture dépasse 10 Mo.");
  if (file.type !== "application/pdf") throw new Error("La facture doit être un PDF.");
  const data = await file.arrayBuffer();
  const bytes = new Uint8Array(data);
  if (new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("Le fichier ne contient pas un PDF valide.");
  }
  return data;
}

export const buildOrganizerInvoicePath = (editionId: string, paymentId: string = randomUUID()) =>
  `${editionId}/${paymentId}/${randomUUID()}.pdf`;

export async function uploadOrganizerInvoice(
  config: SupabaseServiceConfig,
  path: string,
  bytes: ArrayBuffer
) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${ORGANIZER_INVOICE_BUCKET}/${path}`, {
    method: "POST",
    headers: { ...headers(config, "application/pdf"), "x-upsert": "false" },
    body: bytes,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to upload organizer invoice: ${await response.text()}`);
}

export async function deleteOrganizerInvoice(config: SupabaseServiceConfig, path: string | null | undefined) {
  if (!path) return;
  await fetch(`${config.supabaseUrl}/storage/v1/object/${ORGANIZER_INVOICE_BUCKET}/${path}`, {
    method: "DELETE",
    headers: headers(config),
    cache: "no-store",
  }).catch(() => null);
}

export async function createOrganizerInvoiceDownloadUrl(
  config: SupabaseServiceConfig,
  path: string,
  fileName: string
) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/sign/${ORGANIZER_INVOICE_BUCKET}/${path}`, {
    method: "POST",
    headers: headers(config, "application/json"),
    body: JSON.stringify({ expiresIn: 60 }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to sign organizer invoice: ${await response.text()}`);
  const data = await response.json() as { signedURL?: string; signedUrl?: string };
  const signedPath = data.signedURL ?? data.signedUrl;
  if (!signedPath) throw new Error("Supabase did not return a signed invoice URL.");
  const url = new URL(signedPath, config.supabaseUrl);
  url.searchParams.set("download", fileName);
  return url.toString();
}
