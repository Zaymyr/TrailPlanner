import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const organizerFiles = [
  "app/organizer/_components/dashboard/aid-stations-editor.tsx",
];

const forbiddenSequences = [
  "Ã",
  "�",
  "â€™",
  "â€œ",
  "â€",
  "â€“",
  "â€”",
];

describe("organizer dashboard UTF-8 copy", () => {
  it.each(organizerFiles)("keeps %s free from mojibake sequences", (relativePath) => {
    const absolutePath = resolve(process.cwd(), relativePath);
    const source = readFileSync(absolutePath, "utf8");

    forbiddenSequences.forEach((sequence) => {
      expect(source).not.toContain(sequence);
    });
  });
});
