import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendAdminUserNotificationEmail, sendOrganizerAssignmentEmail, sendTransactionalEmail } from "./resend";

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

describe("sendAdminUserNotificationEmail", () => {
  const originalApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "email-admin-1" })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
  });

  it("uses an idempotency key and escapes the transactional content", async () => {
    const result = await sendAdminUserNotificationEmail({
      to: "Runner@Example.com",
      notificationId: "11111111-1111-4111-8111-111111111111",
      title: "Course <terminée>",
      body: "Bonjour & bienvenue\nDeuxième ligne",
    });

    expect(result).toEqual({ status: "sent", id: "email-admin-1" });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.headers).toMatchObject({
      "Idempotency-Key": "admin-user-notification/11111111-1111-4111-8111-111111111111",
    });
    const body = JSON.parse(init?.body as string);
    expect(body.to).toEqual(["runner@example.com"]);
    expect(body.html).toContain('<html lang="fr" dir="ltr">');
    expect(body.html).toContain('<div lang="fr" dir="ltr"');
    expect(body.html).toContain("Course &lt;terminée&gt;");
    expect(body.html).toContain("Bonjour &amp; bienvenue<br>Deuxième ligne");
    expect(body.html).toContain("l'onglet Notifications de l'application Pace Yourself");
    expect(body.html).not.toContain("pace-yourself.com/profile");
    expect(body.html).not.toContain("<a ");
    expect(body.text).toContain("Deuxième ligne");
    expect(body.text).toContain("l'onglet Notifications de l'application Pace Yourself");
    expect(body.text).not.toContain("pace-yourself.com/profile");
  });
});

describe("transactional e-mail journal", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.SUPABASE_URL = "https://db.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const journalBodies = () =>
    vi.mocked(fetch).mock.calls
      .filter(([url]) => String(url).includes("/rest/v1/transactional_email_log"))
      .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);

  it("journals a sent e-mail under the category of its idempotency key, address masked, no content", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) =>
      String(url).startsWith("https://api.resend.com") ? Response.json({ id: "email-9" }) : new Response(null, { status: 201 })));
    const result = await sendTransactionalEmail({ to: "Orga@Trail.fr", subject: "Votre vidéo", html: "<p>Secret</p>", text: "Secret", idempotencyKey: "flyover/paid/order-1" });
    expect(result).toEqual({ status: "sent", id: "email-9" });
    const [row] = journalBodies();
    expect(row).toEqual({ category: "flyover/paid", status: "sent", status_code: null, message: null, recipient_masked: "or***@trail.fr", provider_message_id: "email-9" });
    expect(JSON.stringify(journalBodies())).not.toMatch(/Secret|Votre vidéo|orga@trail\.fr/i);
  });

  it("journals a failure with its code and still returns it", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) =>
      String(url).startsWith("https://api.resend.com") ? Response.json({ message: "Invalid `to` field" }, { status: 422 }) : new Response(null, { status: 201 })));
    const result = await sendTransactionalEmail({ to: "orga@trail.fr", subject: "S", html: "h", text: "t", category: "organizer-demo/admin" });
    expect(result).toMatchObject({ status: "failed", statusCode: 422 });
    expect(journalBodies()[0]).toMatchObject({ category: "organizer-demo/admin", status: "failed", status_code: 422, message: "Invalid `to` field" });
  });

  it("never fails the send when the journal is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("https://api.resend.com")) return Response.json({ id: "email-10" });
      throw new Error("journal offline");
    }));
    await expect(sendOrganizerAssignmentEmail({ to: "orga@trail.fr", eventName: "Trail", organizerUrl: "https://pace-yourself.com/organizer" })).resolves.toEqual({ status: "sent", id: "email-10" });
  });

  it("journals a skipped e-mail when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
    await expect(sendAdminUserNotificationEmail({ to: "runner@example.com", notificationId: "n1", title: "T", body: "B" })).resolves.toEqual({ status: "skipped", reason: "missing-config" });
    expect(journalBodies()[0]).toMatchObject({ category: "admin-user-notification", status: "skipped", recipient_masked: "ru***@example.com" });
  });
});
