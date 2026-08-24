import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  analyzeOrganizerOfficialSources,
  classifyOrganizerOfficialSourceDeterministically,
  classifyOrganizerSourcesDeterministically,
  type OrganizerSourceDocument,
} from "./organizer-source-intelligence";

const multiFormatSource: OrganizerSourceDocument = {
  url: "https://trail.example/formats",
  title: "Les formats du Trail des Crêtes",
  isPrimary: false,
  text: [
    "Trois formats sont proposés.",
    "Trail Découverte — 12 km — D+ 300 m",
    "Trail des Crêtes — 28 km — D+ 1 200 m",
    "Ultra des Crêtes — 55 km — D+ 2 800 m",
  ].join("\n"),
};

const ambiguousSource = (suffix: string): OrganizerSourceDocument => ({
  url: `https://trail.example/informations-${suffix}`,
  title: "Informations officielles",
  isPrimary: false,
  text: "Bienvenue aux participants. Toutes les informations officielles seront publiées prochainement.",
});

const mockOpenAi = (output: unknown) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify(output) } }],
}), { status: 200, headers: { "Content-Type": "application/json" } }));

describe("organizer source intelligence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("stays deterministic and never calls OpenAI when no key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await analyzeOrganizerOfficialSources({ sources: [multiFormatSource] });

    expect(result.usedLlm).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.sources).toEqual(classifyOrganizerSourcesDeterministically([multiFormatSource]));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies a page exposing several named distances as multi-format", () => {
    const analysis = classifyOrganizerOfficialSourceDeterministically(multiFormatSource);

    expect(analysis).toMatchObject({ role: "multi_format", confidence: "high" });
    expect(analysis.assertions.filter((assertion) => assertion.field === "name")).toHaveLength(3);
    expect(analysis.assertions.filter((assertion) => assertion.field === "distanceKm").map((assertion) => assertion.value))
      .toEqual(expect.arrayContaining([12, 28, 55]));
  });

  it("drops an invented LLM assertion while keeping grounded source analysis", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const source = ambiguousSource("invented-claim");
    const fetchMock = mockOpenAi({
      analyses: [{
        sourceIndex: 0,
        role: "event_overview",
        confidence: "medium",
        evidence: ["Bienvenue aux participants."],
        assertions: [{
          scope: "event",
          formatName: null,
          field: "name",
          value: "Ultra inventé",
          evidence: "Bienvenue aux participants.",
        }],
      }],
    });

    const result = await analyzeOrganizerOfficialSources({ sources: [source] });

    expect(result.usedLlm).toBe(true);
    expect(result.sources[0].role).toBe("event_overview");
    expect(result.sources[0].assertions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "Ultra inventé" }),
    ]));
    const request = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(request).toMatchObject({ temperature: 0, store: false });
    expect(request.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true } });
    expect(request.messages[1].content).toContain("<untrusted_sources>");
  });

  it("ignores an LLM analysis whose evidence is not present in the source", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const source = ambiguousSource("invented-evidence");
    mockOpenAi({
      analyses: [{
        sourceIndex: 0,
        role: "single_format",
        confidence: "high",
        evidence: ["Course secrète de 90 km"],
        assertions: [],
      }],
    });

    const result = await analyzeOrganizerOfficialSources({ sources: [source] });

    expect(result.usedLlm).toBe(false);
    expect(result.sources[0].role).toBe("other");
    expect(result.warnings).toHaveLength(1);
  });

  it("falls back to deterministic analysis for an invalid LLM structure", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const source = ambiguousSource("invalid-structure");
    mockOpenAi({ analyses: [{ sourceIndex: 0, role: "unknown-role" }] });

    const result = await analyzeOrganizerOfficialSources({ sources: [source] });

    expect(result.usedLlm).toBe(false);
    expect(result.sources[0]).toEqual(classifyOrganizerOfficialSourceDeterministically(source));
    expect(result.warnings[0]).toContain("invalide");
  });

  it("reuses a bounded in-memory result for the same content and model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const source = ambiguousSource("cache");
    const fetchMock = mockOpenAi({
      analyses: [{
        sourceIndex: 0,
        role: "event_overview",
        confidence: "medium",
        evidence: ["Informations officielles"],
        assertions: [],
      }],
    });

    const first = await analyzeOrganizerOfficialSources({ sources: [source] });
    const second = await analyzeOrganizerOfficialSources({ sources: [source] });

    expect(first.usedLlm).toBe(true);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("samples the beginning, middle, and end of a long source within the prompt budget", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const source: OrganizerSourceDocument = {
      url: "https://trail.example/longue-source",
      title: "Informations longues",
      isPrimary: false,
      text: `${"A".repeat(15_000)}PREUVE-MILIEU${"B".repeat(15_000)}PREUVE-FIN`,
    };
    const fetchMock = mockOpenAi({
      analyses: [{
        sourceIndex: 0,
        role: "other",
        confidence: "low",
        evidence: ["PREUVE-FIN"],
        assertions: [],
      }],
    });

    const result = await analyzeOrganizerOfficialSources({ sources: [source] });
    const request = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const prompt = request.messages[1].content as string;

    expect(result.usedLlm).toBe(true);
    expect(prompt).toContain("PREUVE-MILIEU");
    expect(prompt).toContain("PREUVE-FIN");
    expect(prompt).toContain("contenu omis");
    expect(prompt.length).toBeLessThan(14_000);
  });
});
