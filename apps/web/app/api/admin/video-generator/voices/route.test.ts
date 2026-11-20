import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";

const mocks = vi.hoisted(() => ({ gate: vi.fn() }));

vi.mock("../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render-api")>("../../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});

const VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const ROW_ID = "55555555-5555-4555-8555-555555555555";
const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const row = { id: ROW_ID, elevenlabs_voice_id: VOICE_ID, name: "Adam", active: true };
const voice = { id: ROW_ID, voiceId: VOICE_ID, name: "Adam", active: true };

const json = (method: string, body: unknown) => new Request("http://localhost/api/admin/video-generator/voices", {
  method,
  headers: { authorization: "Bearer admin", "content-type": "application/json" },
  body: JSON.stringify(body),
});
const idContext = { params: { id: ROW_ID } };

describe("admin voice pool routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    mocks.gate.mockReset();
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin-user", supabase } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const denied = () => mocks.gate.mockResolvedValue({ ok: false, response: Response.json({ message: "Not authorized." }, { status: 403 }) });

  it("gates every route with the admin check", async () => {
    denied();
    const responses = await Promise.all([
      GET(new Request("http://localhost/api/admin/video-generator/voices")),
      POST(json("POST", { voiceId: VOICE_ID, name: "Adam" })),
      PATCH(json("PATCH", { active: false }), idContext),
      DELETE(json("DELETE", undefined), idContext),
    ]);
    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists the voices of the pool", async () => {
    fetchMock.mockResolvedValue(Response.json([row]));
    const response = await GET(new Request("http://localhost/api/admin/video-generator/voices"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ voices: [voice] });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/rest/v1/video_voices?select=");
  });

  it("adds a voice, attributed to the admin", async () => {
    fetchMock.mockResolvedValue(Response.json([row], { status: 201 }));
    const response = await POST(json("POST", { voiceId: VOICE_ID, name: " Adam " }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ voice });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ elevenlabs_voice_id: VOICE_ID, name: "Adam", created_by: "admin-user" });
  });

  it("rejects a bad voice id, a missing name without suggestion and a name that is too long", async () => {
    expect((await POST(json("POST", { voiceId: "bad id!", name: "Adam" }))).status).toBe(400);
    expect((await POST(json("POST", { voiceId: VOICE_ID, name: "x".repeat(41) }))).status).toBe(400);
    expect((await POST(json("POST", { voiceId: VOICE_ID, name: "" }))).status).toBe(400);
    const noName = await POST(json("POST", { voiceId: VOICE_ID }));
    expect(noName.status).toBe(400);
    expect((await noName.json()).message).toBe("Donne un nom à cette voix.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 409 in French when the voice is already in the pool", async () => {
    fetchMock.mockResolvedValue(Response.json({ code: "23505" }, { status: 409 }));
    const response = await POST(json("POST", { voiceId: VOICE_ID, name: "Adam" }));
    expect(response.status).toBe(409);
    expect((await response.json()).message).toBe("Cette voix est déjà dans le pool.");
  });

  it("suggests the ElevenLabs name and never leaks the key, or only warns when the check fails", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret");
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => String(input).startsWith("https://api.elevenlabs.io")
      ? Response.json({ name: "Adam (premade)" })
      : Response.json([{ ...row, name: "Adam (premade)" }], { status: 201 }));
    const suggested = await POST(json("POST", { voiceId: VOICE_ID }));
    expect(suggested.status).toBe(201);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.elevenlabs.io/v1/voices/${VOICE_ID}`);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ "xi-api-key": "sk_secret" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).name).toBe("Adam (premade)");
    expect(JSON.stringify(await suggested.json())).not.toContain("sk_secret");

    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => String(input).startsWith("https://api.elevenlabs.io")
      ? new Response("{}", { status: 404 })
      : Response.json([row], { status: 201 }));
    const warned = await POST(json("POST", { voiceId: VOICE_ID, name: "Adam" }));
    expect(warned.status).toBe(201);
    expect((await warned.json()).warning).toContain("pas été trouvé");
  });

  it("renames and deactivates a voice, 404 when it does not exist", async () => {
    fetchMock.mockResolvedValue(Response.json([{ ...row, name: "Adam posé", active: false }]));
    const response = await PATCH(json("PATCH", { name: "Adam posé", active: false }), idContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ voice: { ...voice, name: "Adam posé", active: false } });
    expect(String(fetchMock.mock.calls[0][0])).toContain(`video_voices?id=eq.${ROW_ID}`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "Adam posé", active: false });

    fetchMock.mockResolvedValue(Response.json([]));
    expect((await PATCH(json("PATCH", { active: true }), idContext)).status).toBe(404);
  });

  it("validates the PATCH body and the voice id", async () => {
    expect((await PATCH(json("PATCH", {}), idContext)).status).toBe(400);
    expect((await PATCH(json("PATCH", { active: "yes" }), idContext)).status).toBe(400);
    expect((await PATCH(json("PATCH", { name: "" }), idContext)).status).toBe(400);
    expect((await PATCH(json("PATCH", { active: true }), { params: { id: "not-a-uuid" } })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes a voice, 404 when it does not exist", async () => {
    fetchMock.mockResolvedValue(Response.json([{ id: ROW_ID }]));
    const response = await DELETE(json("DELETE", undefined), idContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");

    fetchMock.mockResolvedValue(Response.json([]));
    expect((await DELETE(json("DELETE", undefined), idContext)).status).toBe(404);
    expect((await DELETE(json("DELETE", undefined), { params: { id: "nope" } })).status).toBe(400);
  });

  it("answers 502 when the database fails", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await GET(new Request("http://localhost/api/admin/video-generator/voices"))).status).toBe(502);
  });
});
