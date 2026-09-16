import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Reset password destinations", () => {
  it("sends invited organizers to their dashboard after password creation", () => {
    const source = readFileSync(resolve(process.cwd(), "app/reset-password/page.tsx"), "utf8");

    expect(source).toContain('flow: "invite" | "recovery"');
    expect(source).toContain('resetTokens.flow === "invite" ? "/organizer" : "/race-planner"');
  });
});
