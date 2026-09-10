import { describe, expect, it } from "vitest";

import {
  getOrganizerImportTusEndpoint,
  isOrganizerImportDocumentMimeType,
  WEBSITE_IMPORT_MAX_DOCUMENT_BYTES,
} from "./organizer-import-documents";

describe("organizer import document uploads", () => {
  it("uses the direct hosted Storage origin for resumable uploads", () => {
    expect(getOrganizerImportTusEndpoint("https://project-ref.supabase.co")).toBe(
      "https://project-ref.storage.supabase.co/storage/v1/upload/resumable"
    );
  });

  it("keeps custom Supabase origins intact", () => {
    expect(getOrganizerImportTusEndpoint("https://storage.example.test/base")).toBe(
      "https://storage.example.test/storage/v1/upload/resumable"
    );
  });

  it("accepts only the documented import media types", () => {
    expect(isOrganizerImportDocumentMimeType("application/pdf")).toBe(true);
    expect(isOrganizerImportDocumentMimeType("image/webp")).toBe(true);
    expect(isOrganizerImportDocumentMimeType("image/svg+xml")).toBe(false);
    expect(WEBSITE_IMPORT_MAX_DOCUMENT_BYTES).toBe(25 * 1024 * 1024);
  });
});
