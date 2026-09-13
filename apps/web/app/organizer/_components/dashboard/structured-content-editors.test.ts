import { describe, expect, it } from "vitest";

import { reconcileRemoteListSave } from "./structured-content-editors";

describe("reconcileRemoteListSave", () => {
  it("uses the normalized server response when the saved revision is still current", () => {
    expect(reconcileRemoteListSave({
      currentItems: [{ name: "Brouillon" }],
      currentRevision: 2,
      savedItems: [{ name: "Brouillon normalisé" }],
      savedRevision: 2,
    })).toEqual({
      items: [{ name: "Brouillon normalisé" }],
      dirty: false,
      saveAgain: false,
    });
  });

  it("keeps and queues edits made while an older revision was saving", () => {
    expect(reconcileRemoteListSave({
      currentItems: [{ name: "Modification récente" }],
      currentRevision: 3,
      savedItems: [{ name: "Ancienne réponse serveur" }],
      savedRevision: 2,
    })).toEqual({
      items: [{ name: "Modification récente" }],
      dirty: true,
      saveAgain: true,
    });
  });
});
