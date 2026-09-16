import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendOrganizerAssignmentEmail } from "./resend";

describe("sendOrganizerAssignmentEmail", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.RESEND_FROM;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "email-1" })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = originalFrom;
  });

  it("sends an escaped transactional message with the direct organizer link", async () => {
    const result = await sendOrganizerAssignmentEmail({
      to: " Organizer@Example.com ",
      eventName: "Trail <des Crêtes>",
      organizerUrl: "https://pace-yourself.com/organizer?eventId=event-1&source=admin",
    });

    expect(result).toEqual({ status: "sent", id: "email-1" });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer re_test" });
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      from: "Pace Yourself <hello@mail.pace-yourself.com>",
      to: ["organizer@example.com"],
      subject: "Vous gérez maintenant Trail <des Crêtes> sur Pace Yourself",
    });
    expect(body.html).toContain("Trail &lt;des Crêtes&gt;");
    expect(body.html).toContain("eventId=event-1&amp;source=admin");
    expect(body.html).toContain("https://pace-yourself.com/branding/logo-horizontal-v2.png");
    expect(body.html).toContain('class="container"');
    expect(body.html).toContain("Accès organisateur");
    expect(body.html).toContain("background:#ffffff; border-radius:16px");
    expect(body.html).not.toContain("RESEND_UNSUBSCRIBE_URL");
    expect(body.text).toContain("https://pace-yourself.com/organizer?eventId=event-1&source=admin");
  });
});
