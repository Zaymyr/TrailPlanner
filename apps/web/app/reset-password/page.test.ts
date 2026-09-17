import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Reset password destinations", () => {
  it("sends invited organizers to their dashboard after password creation", () => {
    const source = readFileSync(resolve(process.cwd(), "app/reset-password/page.tsx"), "utf8");

    expect(source).toContain('flow: "invite" | "recovery"');
    expect(source).toContain('resetTokens.flow === "invite" ? "/organizer" : "/race-planner"');
    expect(source).toContain('await refresh({ afterCurrent: true })');
    expect(source).toContain('router.replace(destination)');
    expect(source).not.toContain('window.location.assign(destination)');
  });

  it("can verify newly stored invite tokens after the initial empty-session check", () => {
    const source = readFileSync(resolve(process.cwd(), "app/hooks/useVerifiedSession.tsx"), "utf8");

    expect(source).toContain("const task = Promise.resolve().then(async () =>");
    expect(source).toContain("if (refreshInFlight.current === task) refreshInFlight.current = null");
    expect(source).toContain("const SESSION_VERIFICATION_TIMEOUT_MS = 10_000");
    expect(source).toContain("signal: controller.signal");
    expect(source).toContain("window.clearTimeout(timeoutId)");
  });

  it("offers a prominent recovery path when an invite or reset link is invalid", () => {
    const source = readFileSync(resolve(process.cwd(), "app/reset-password/page.tsx"), "utf8");

    expect(source).toContain('data-testid="request-new-password-link"');
    expect(source).toContain('router.push("/forgot-password")');
    expect(source).toContain("t.auth.passwordResetRequest.title");
  });
});
