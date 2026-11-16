import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const submitMock = vi.fn();
vi.mock("../../../lib/http", async (original) => ({
  ...(await original<typeof import("../../../lib/http")>()),
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true, remaining: 4 })),
}));
vi.mock("../../../lib/supabase", () => ({ getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.test", supabaseServiceRoleKey: "key" }) }));
vi.mock("../../../lib/organizer-demo-requests", async (original) => ({
  ...(await original<typeof import("../../../lib/organizer-demo-requests")>()),
  submitOrganizerDemoRequest: (...args: unknown[]) => submitMock(...args),
}));

import { POST } from "./route";

const post = (body: unknown) => POST(new NextRequest("https://pace-yourself.com/api/organizer-demo-requests", {
  method: "POST",
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
}));

describe("POST /api/organizer-demo-requests", () => {
  beforeEach(() => {
    submitMock.mockReset();
    submitMock.mockResolvedValue({ stored: true, adminEmail: "sent", confirmationEmail: "sent" });
  });

  it("requires an e-mail and a race link", async () => {
    expect((await post({ email: "", raceUrl: "https://trail.fr" })).status).toBe(400);
    expect((await post({ email: "orga@trail.fr", raceUrl: "" })).status).toBe(400);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("normalizes the link, keeps the phone optional and only known UTM keys", async () => {
    const response = await post({ email: " Orga@Trail.fr ", raceUrl: "www.trail.fr/ultra", attribution: { utm_source: "mail", foo: "bar" } });
    expect(response.status).toBe(201);
    expect(submitMock).toHaveBeenCalledWith(expect.anything(), {
      email: "orga@trail.fr",
      raceUrl: "https://www.trail.fr/ultra",
      phone: null,
      attribution: { utm_source: "mail" },
    });
  });

  it("rejects an invalid phone number", async () => {
    expect((await post({ email: "orga@trail.fr", raceUrl: "https://trail.fr", phone: "abc" })).status).toBe(400);
  });

  it("silently drops honeypot submissions", async () => {
    expect((await post({ email: "orga@trail.fr", raceUrl: "https://trail.fr", website: "spam" })).status).toBe(201);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("fails only when the request was neither stored nor e-mailed to the team", async () => {
    submitMock.mockResolvedValue({ stored: false, adminEmail: "sent", confirmationEmail: "failed" });
    expect((await post({ email: "orga@trail.fr", raceUrl: "https://trail.fr" })).status).toBe(201);
    submitMock.mockResolvedValue({ stored: false, adminEmail: "failed", confirmationEmail: "failed" });
    expect((await post({ email: "orga@trail.fr", raceUrl: "https://trail.fr" })).status).toBe(502);
  });
});
