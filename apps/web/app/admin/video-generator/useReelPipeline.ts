"use client";

import { useCallback, useRef, useState } from "react";

import {
  createReelPipelineState,
  runReelPipeline,
  type ReelPipelineRunners,
  type ReelPipelineState,
} from "./reel-pipeline";

/**
 * State and actions of the one-click reel. `runners` are read when each step starts (always the
 * latest ones, whatever the editor re-rendered meanwhile); the data the steps hand to each other
 * lives here and is kept across a resume.
 */
export const useReelPipeline = <Context extends object>(runners: ReelPipelineRunners<Context>, initialContext: () => Context) => {
  const [state, setState] = useState<ReelPipelineState>(createReelPipelineState);
  const [cancelRequested, setCancelRequested] = useState(false);
  const runnersRef = useRef(runners);
  runnersRef.current = runners;
  const stateRef = useRef(state);
  const contextRef = useRef<Context | null>(null);
  const runningRef = useRef(false);
  const cancelRef = useRef(false);

  const run = useCallback(async (from: ReelPipelineState, context: Context) => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelRef.current = false;
    setCancelRequested(false);
    // Late-bound: each call reaches the runners of the latest render.
    const latest: ReelPipelineRunners<Context> = {
      prepare: () => runnersRef.current.prepare?.() ?? Promise.resolve(),
      text: (data) => runnersRef.current.text(data),
      voice: (data) => runnersRef.current.voice(data),
      save: (data) => runnersRef.current.save(data),
      render: (data) => runnersRef.current.render(data),
    };
    try {
      const result = await runReelPipeline({
        runners: latest,
        context,
        state: from,
        // Once the render step started there is nothing left to cancel.
        isCancelled: () => cancelRef.current,
        onState: (next) => {
          stateRef.current = next;
          setState(next);
        },
      });
      contextRef.current = result.context;
    } finally {
      runningRef.current = false;
      setCancelRequested(false);
    }
  }, []);

  /** A new run from the first step. */
  const start = useCallback(() => {
    contextRef.current = initialContext();
    return run(createReelPipelineState(), contextRef.current);
  }, [initialContext, run]);

  /** Runs again from the failed (or cancelled) step; the steps done are kept. */
  const resume = useCallback(() => {
    if (!contextRef.current) return start();
    return run(stateRef.current, contextRef.current);
  }, [run, start]);

  const cancel = useCallback(() => {
    if (!runningRef.current) return;
    cancelRef.current = true;
    setCancelRequested(true);
  }, []);

  return { state, cancelRequested, running: state.status === "running", start, resume, cancel };
};
