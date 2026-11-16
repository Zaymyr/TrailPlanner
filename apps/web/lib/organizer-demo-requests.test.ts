import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDemoRequestAdminEmail,
  buildDemoRequestConfirmationEmail,
  demoRequestAdminEmail,
  keepKnownAttribution,
} from "./organizer-demo-requests";

describe("organizer demo request e-mails", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("escapes visitor input in the admin e-mail and lists every field", () => {
    const email = buildDemoRequestAdminEmail({
      email: "orga@trail.fr",
      raceUrl: "https://trail.fr/?a=<script>",
      phone: null,
      attribution: { utm_source: "linkedin" },
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.text).toContain("Téléphone : Non renseigné");
    expect(email.text).toContain("utm_source=linkedin");
  });

  it("confirms the request to the organizer with the race link", () => {
    const email = buildDemoRequestConfirmationEmail({ raceUrl: "https://trail.fr" });
    expect(email.subject).toContain("bien reçue");
    expect(email.text).toContain("https://trail.fr");
  });

  it("sends the admin copy to the support mailbox unless overridden", () => {
    expect(demoRequestAdminEmail()).toBe("faustin@pace-yourself.com");
    vi.stubEnv("ORGANIZER_DEMO_NOTIFY_EMAIL", "demo@pace-yourself.com");
    expect(demoRequestAdminEmail()).toBe("demo@pace-yourself.com");
  });

  it("keeps only known UTM keys", () => {
    expect(keepKnownAttribution({ utm_source: "a", utm_medium: "b", other: "x" })).toEqual({ utm_source: "a", utm_medium: "b" });
  });
});
