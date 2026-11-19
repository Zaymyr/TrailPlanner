// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createReelPipelineState,
  REEL_PIPELINE_STEPS,
  runReelPipeline,
  waitUntil,
  type ReelPipelineRunners,
  type ReelPipelineState,
} from "./reel-pipeline";
import { useReelPipeline } from "./useReelPipeline";

type Context = { overrides?: Record<string, string>; clips?: Record<string, string>; jobId?: string };

const makeRunners = (overrides: Partial<ReelPipelineRunners<Context>> = {}) => {
  const calls: string[] = [];
  const runners: ReelPipelineRunners<Context> = {
    prepare: vi.fn(async () => { calls.push("prepare"); }),
    text: vi.fn(async () => { calls.push("text"); return { overrides: { "hl-intro": "Prêt ?" }, warnings: ["Chiffre non fourni : 3 200 m"] }; }),
    voice: vi.fn(async () => { calls.push("voice"); return { clips: { "hl-intro": "clip" } }; }),
    save: vi.fn(async () => { calls.push("save"); }),
    render: vi.fn(async () => { calls.push("render"); return { jobId: "job-1" }; }),
    ...overrides,
  };
  return { runners, calls };
};

const run = (runners: ReelPipelineRunners<Context>, state: ReelPipelineState = createReelPipelineState(), context: Context = {}, isCancelled = () => false) => {
  const states: ReelPipelineState[] = [];
  const result = runReelPipeline({ runners, context, state, isCancelled, onState: (next) => states.push(next) });
  return { result, states };
};

describe("runReelPipeline", () => {
  it("runs prepare, then text, voice, save and render in order and hands each result to the next steps", async () => {
    const { runners, calls } = makeRunners();
    const { result, states } = run(runners);
    const { state, context } = await result;

    expect(calls).toEqual(["prepare", "text", "voice", "save", "render"]);
    expect(REEL_PIPELINE_STEPS).toEqual(["text", "voice", "save", "render"]);
    expect(state.status).toBe("done");
    expect(Object.values(state.steps)).toEqual(["done", "done", "done", "done"]);
    expect(context).toEqual({ overrides: { "hl-intro": "Prêt ?" }, clips: { "hl-intro": "clip" }, jobId: "job-1" });
    // The data of the text step reaches the voice, save and render steps.
    for (const step of ["voice", "save", "render"] as const) {
      expect(runners[step]).toHaveBeenCalledWith(expect.objectContaining({ overrides: { "hl-intro": "Prêt ?" } }));
    }
    expect(runners.render).toHaveBeenCalledWith(expect.objectContaining({ clips: { "hl-intro": "clip" } }));
    // One step at a time: the state shows the running step.
    expect(states.some((entry) => entry.steps.voice === "running" && entry.steps.text === "done")).toBe(true);
  });

  it("passes the warnings through without blocking, without duplicates", async () => {
    const { runners } = makeRunners({
      voice: vi.fn(async () => ({ clips: {}, warnings: ["Chiffre non fourni : 3 200 m", "Texte trop long"] })),
    });
    const { state } = await run(runners).result;
    expect(state.status).toBe("done");
    expect(state.warnings).toEqual(["Chiffre non fourni : 3 200 m", "Texte trop long"]);
  });

  it("stops at the failing step with its error and leaves the next steps untouched", async () => {
    const { runners } = makeRunners({ voice: vi.fn(async () => { throw new Error("ElevenLabs indisponible"); }) });
    const { state } = await run(runners).result;

    expect(state).toMatchObject({ status: "error", failedStep: "voice", error: "ElevenLabs indisponible" });
    expect(state.steps).toEqual({ text: "done", voice: "error", save: "pending", render: "pending" });
    expect(runners.save).not.toHaveBeenCalled();
    expect(runners.render).not.toHaveBeenCalled();
  });

  it("resumes from the failed step, never replaying the steps already done", async () => {
    let failVoice = true;
    const { runners, calls } = makeRunners({
      voice: vi.fn(async () => {
        calls.push("voice");
        if (failVoice) throw new Error("boom");
        return { clips: { "hl-intro": "clip" } };
      }),
    });
    const first = await run(runners).result;
    expect(first.state.failedStep).toBe("voice");

    failVoice = false;
    const second = await run(runners, first.state, first.context).result;
    expect(second.state.status).toBe("done");
    expect(second.state.failedStep).toBeNull();
    expect(second.state.error).toBeNull();
    // text once, voice twice (failed then retried), save and render once.
    expect(calls.filter((call) => call === "text")).toHaveLength(1);
    expect(calls.filter((call) => call === "voice")).toHaveLength(2);
    expect(calls.filter((call) => call === "save")).toHaveLength(1);
    expect(calls.filter((call) => call === "render")).toHaveLength(1);
    // The context of the steps done before the failure is kept.
    expect(runners.save).toHaveBeenCalledWith(expect.objectContaining({ overrides: { "hl-intro": "Prêt ?" }, clips: { "hl-intro": "clip" } }));
  });

  it("reports a failing prepare on the first step, and nothing else runs", async () => {
    const { runners } = makeRunners({ prepare: vi.fn(async () => { throw new Error("Récit non chargé"); }) });
    const { state } = await run(runners).result;
    expect(state).toMatchObject({ status: "error", failedStep: "text", error: "Récit non chargé" });
    expect(runners.text).not.toHaveBeenCalled();
  });

  it("is cancelled before the next step and never reaches the render", async () => {
    let cancelled = false;
    const { runners } = makeRunners({
      voice: vi.fn(async () => { cancelled = true; return { clips: {} }; }),
    });
    const { state } = await run(runners, createReelPipelineState(), {}, () => cancelled).result;

    expect(state.status).toBe("cancelled");
    expect(state.steps).toEqual({ text: "done", voice: "done", save: "pending", render: "pending" });
    expect(runners.save).not.toHaveBeenCalled();
    expect(runners.render).not.toHaveBeenCalled();

    // A cancelled run resumes where it stopped.
    cancelled = false;
    const resumed = await run(runners, state).result;
    expect(resumed.state.status).toBe("done");
    expect(runners.text).toHaveBeenCalledTimes(1);
    expect(runners.render).toHaveBeenCalledTimes(1);
  });

  it("ignores a cancel asked once the render is running", async () => {
    let cancelled = false;
    const { runners } = makeRunners({ render: vi.fn(async () => { cancelled = true; return { jobId: "job-1" }; }) });
    const { state } = await run(runners, createReelPipelineState(), {}, () => cancelled).result;
    expect(state.status).toBe("done");
    expect(state.steps.render).toBe("done");
  });
});

describe("waitUntil", () => {
  it("resolves once the predicate holds and throws the message on timeout", async () => {
    let ready = false;
    setTimeout(() => { ready = true; }, 30);
    await expect(waitUntil(() => ready, { intervalMs: 5, message: "no" })).resolves.toBeUndefined();
    await expect(waitUntil(() => false, { timeoutMs: 30, intervalMs: 5, message: "Délai dépassé" })).rejects.toThrow("Délai dépassé");
  });
});

describe("useReelPipeline", () => {
  it("starts, fails, resumes from the failed step and keeps the context", async () => {
    let failSave = true;
    const { runners } = makeRunners({
      save: vi.fn(async () => { if (failSave) throw new Error("PUT refusé"); }),
    });
    const { result } = renderHook(() => useReelPipeline(runners, () => ({})));

    await act(async () => { await result.current.start(); });
    expect(result.current.state).toMatchObject({ status: "error", failedStep: "save", error: "PUT refusé" });
    expect(runners.render).not.toHaveBeenCalled();

    failSave = false;
    await act(async () => { await result.current.resume(); });
    await waitFor(() => expect(result.current.state.status).toBe("done"));
    expect(runners.text).toHaveBeenCalledTimes(1);
    expect(runners.voice).toHaveBeenCalledTimes(1);
    expect(runners.save).toHaveBeenCalledTimes(2);
    expect(runners.render).toHaveBeenCalledTimes(1);
    expect(runners.render).toHaveBeenCalledWith(expect.objectContaining({ overrides: { "hl-intro": "Prêt ?" } }));
  });

  it("cancels before the render starts and resumes afterwards", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { runners } = makeRunners({ voice: vi.fn(async () => { await gate; return { clips: {} }; }) });
    const { result } = renderHook(() => useReelPipeline(runners, () => ({})));

    let started: void | Promise<void> = undefined;
    act(() => { started = result.current.start(); });
    await waitFor(() => expect(result.current.state.steps.voice).toBe("running"));
    act(() => result.current.cancel());
    expect(result.current.cancelRequested).toBe(true);
    await act(async () => { release(); await started; });

    expect(result.current.state.status).toBe("cancelled");
    expect(runners.render).not.toHaveBeenCalled();
    expect(result.current.cancelRequested).toBe(false);

    await act(async () => { await result.current.resume(); });
    expect(result.current.state.status).toBe("done");
    expect(runners.text).toHaveBeenCalledTimes(1);
  });
});
