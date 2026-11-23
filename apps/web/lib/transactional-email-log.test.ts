import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  emailCategoryFromIdempotencyKey,
  maskEmailAddress,
  recordTransactionalEmail,
  resolveEmailCategory,
  toEmailLogRow,
  truncateLogMessage,
} from "./transactional-email-log";

describe("maskEmailAddress", () => {
  it("keeps two characters of the local part and the domain", () => {
    expect(maskEmailAddress("Faustin.Lemaire@Gmail.com ")).toBe("fa***@gmail.com");
    expect(maskEmailAddress("ab@club.fr")).toBe("a***@club.fr");
    expect(maskEmailAddress("x@club.fr")).toBe("x***@club.fr");
  });

  it("returns null when it is not an address", () => {
    expect(maskEmailAddress(null)).toBeNull();
    expect(maskEmailAddress("no-at-sign")).toBeNull();
    expect(maskEmailAddress("@domain.fr")).toBeNull();
    expect(maskEmailAddress("user@")).toBeNull();
  });
});

describe("e-mail categories", () => {
  it("drops the ids of the idempotency key", () => {
    expect(emailCategoryFromIdempotencyKey("flyover/paid/7b1c")).toBe("flyover/paid");
    expect(emailCategoryFromIdempotencyKey("flyover/ready/7b1c/2026-11-22T10:00:00Z")).toBe("flyover/ready");
    expect(emailCategoryFromIdempotencyKey("organizer-demo/admin/abc")).toBe("organizer-demo/admin");
    expect(emailCategoryFromIdempotencyKey("admin-user-notification/123")).toBe("admin-user-notification");
    expect(emailCategoryFromIdempotencyKey("7b1c-only-an-id")).toBe("transactional");
    expect(emailCategoryFromIdempotencyKey(undefined)).toBe("transactional");
  });

  it("prefers an explicit category, sanitized", () => {
    expect(resolveEmailCategory("Relance Organisateur", "flyover/paid/1")).toBe("relance-organisateur");
    expect(resolveEmailCategory(undefined, "flyover/paid/1")).toBe("flyover/paid");
  });
});

describe("toEmailLogRow", () => {
  it("never stores the full address nor a long message", () => {
    const row = toEmailLogRow({ category: "flyover/paid", status: "failed", to: "orga@trail.fr", statusCode: 422, message: `Invalid \`to\`: orga@trail.fr ${"x".repeat(400)}` });
    expect(row.recipient_masked).toBe("or***@trail.fr");
    expect(JSON.stringify(row)).not.toContain("orga@trail.fr");
    expect(row.message?.length).toBeLessThanOrEqual(300);
    expect(row.status_code).toBe(422);
    expect(truncateLogMessage("  ")).toBeNull();
  });
});

describe("recordTransactionalEmail", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.SUPABASE_URL = "https://db.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("writes one masked row with the service role", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await recordTransactionalEmail({ category: "flyover/paid", status: "sent", to: "orga@trail.fr", providerMessageId: "email-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://db.example/rest/v1/transactional_email_log");
    expect(init.headers).toMatchObject({ Authorization: "Bearer service-key", Prefer: "return=minimal" });
    expect(JSON.parse(init.body)).toEqual({ category: "flyover/paid", status: "sent", status_code: null, message: null, recipient_masked: "or***@trail.fr", provider_message_id: "email-1" });
  });

  it("never throws: network error, refusal or missing configuration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(recordTransactionalEmail({ category: "x", status: "sent", to: null })).resolves.toBeUndefined();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    await expect(recordTransactionalEmail({ category: "x", status: "sent", to: null })).resolves.toBeUndefined();
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await recordTransactionalEmail({ category: "x", status: "sent", to: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
