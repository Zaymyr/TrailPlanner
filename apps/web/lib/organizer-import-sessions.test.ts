import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  organizerImportSourceManifestSchema,
  type OrganizerImportSourceManifest,
} from "./organizer-import-sessions";

describe("organizer import session manifests", () => {
  it("keeps additionalUrls as the canonical manifest field", () => {
    const manifest: OrganizerImportSourceManifest = organizerImportSourceManifestSchema.parse({
      url: "https://race.example/event",
      additionalUrls: ["https://race.example/format-1"],
      documents: [],
    });

    expect(manifest).toEqual({
      url: "https://race.example/event",
      additionalUrls: ["https://race.example/format-1"],
      documents: [],
    });
    expect(manifest).not.toHaveProperty("formatUrls");
  });

  it("normalizes legacy formatUrls manifests without leaking the old field", () => {
    const manifest: OrganizerImportSourceManifest = organizerImportSourceManifestSchema.parse({
      url: "",
      formatUrls: ["https://race.example/legacy-format"],
      documents: [],
    });

    expect(manifest).toEqual({
      url: "",
      additionalUrls: ["https://race.example/legacy-format"],
      documents: [],
    });
    expect(manifest).not.toHaveProperty("formatUrls");
  });

  it("prefers canonical additionalUrls when both manifest fields are present", () => {
    const manifest = organizerImportSourceManifestSchema.parse({
      url: "https://race.example/event",
      additionalUrls: ["https://race.example/canonical"],
      formatUrls: ["https://race.example/legacy"],
    });

    expect(manifest.additionalUrls).toEqual(["https://race.example/canonical"]);
    expect(manifest).not.toHaveProperty("formatUrls");
    expect(manifest.documents).toEqual([]);
  });
});
