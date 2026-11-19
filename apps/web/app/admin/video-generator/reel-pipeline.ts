/**
 * One-click reel: the order of the steps the admin runs by hand today (write the text, generate the
 * voice, save the narration, launch the background render), their state, and the rule to resume
 * after a failure. Pure orchestration: every step is a function injected by the editor, which keeps
 * the individual buttons and this flow on the same code.
 */

export const REEL_PIPELINE_STEPS = ["text", "voice", "save", "render"] as const;
export type ReelPipelineStep = (typeof REEL_PIPELINE_STEPS)[number];

export const REEL_STEP_LABELS: Record<ReelPipelineStep, string> = {
  text: "Texte",
  voice: "Voix",
  save: "Enregistrement",
  render: "Rendu lancé",
};

/**
 * Typical time between the launch and the finished video (queue, GPU render, upload), in minutes.
 * An estimate shown to the admin, not a guarantee.
 */
export const REEL_RENDER_ETA_MINUTES = 10;

export type ReelStepStatus = "pending" | "running" | "done" | "error";
export type ReelPipelineStatus = "idle" | "running" | "error" | "cancelled" | "done";

export type ReelPipelineState = {
  status: ReelPipelineStatus;
  steps: Record<ReelPipelineStep, ReelStepStatus>;
  failedStep: ReelPipelineStep | null;
  error: string | null;
  /** Points to check reported by the steps (figures not provided, limits): never blocking. */
  warnings: string[];
};

export const createReelPipelineState = (): ReelPipelineState => ({
  status: "idle",
  steps: { text: "pending", voice: "pending", save: "pending", render: "pending" },
  failedStep: null,
  error: null,
  warnings: [],
});

/** What a step returns: data for the following steps (context) and warnings for the admin. */
export type ReelStepResult<Context extends object> = (Partial<Context> & { warnings?: string[] }) | void;

export type ReelPipelineRunners<Context extends object> = {
  /**
   * Before the first step (and again on a resume): puts the editor in the state the steps need
   * (Temps forts mode, saved narration loaded). Throws to stop with an error on the first step.
   */
  prepare?: () => Promise<void>;
} & Record<ReelPipelineStep, (context: Context) => Promise<ReelStepResult<Context>>>;

const errorMessage = (error: unknown) => error instanceof Error && error.message ? error.message : "Une erreur est survenue.";

const firstPendingStep = (state: ReelPipelineState) =>
  REEL_PIPELINE_STEPS.find((step) => state.steps[step] !== "done") ?? null;

/**
 * Runs the steps from the first one not done, in order, stopping at the first failure or when
 * cancelled. A failed step is run again by the next call (resume); the steps already done are not.
 * The cancel is checked before every step, the render included, and has no effect afterwards.
 */
export const runReelPipeline = async <Context extends object>({ runners, context, state, isCancelled, onState }: {
  runners: ReelPipelineRunners<Context>;
  context: Context;
  state: ReelPipelineState;
  isCancelled: () => boolean;
  onState: (state: ReelPipelineState) => void;
}): Promise<{ state: ReelPipelineState; context: Context }> => {
  let current: ReelPipelineState = {
    ...state,
    status: "running",
    error: null,
    failedStep: null,
    steps: Object.fromEntries(REEL_PIPELINE_STEPS.map((step) => [step, state.steps[step] === "done" ? "done" : "pending"])) as ReelPipelineState["steps"],
  };
  let data = context;
  const publish = (next: ReelPipelineState) => {
    current = next;
    onState(current);
  };
  publish(current);

  const fail = (step: ReelPipelineStep, error: unknown) => publish({
    ...current,
    status: "error",
    failedStep: step,
    error: errorMessage(error),
    steps: { ...current.steps, [step]: "error" },
  });

  if (runners.prepare && firstPendingStep(current)) {
    try {
      await runners.prepare();
    } catch (error) {
      fail(firstPendingStep(current) as ReelPipelineStep, error);
      return { state: current, context: data };
    }
  }

  for (const step of REEL_PIPELINE_STEPS) {
    if (current.steps[step] === "done") continue;
    if (isCancelled()) {
      publish({ ...current, status: "cancelled" });
      return { state: current, context: data };
    }
    publish({ ...current, steps: { ...current.steps, [step]: "running" } });
    try {
      const result = await runners[step](data);
      if (result) {
        const { warnings, ...next } = result;
        data = { ...data, ...next };
        if (warnings?.length) publish({ ...current, warnings: Array.from(new Set([...current.warnings, ...warnings])) });
      }
      publish({ ...current, steps: { ...current.steps, [step]: "done" } });
    } catch (error) {
      fail(step, error);
      return { state: current, context: data };
    }
  }
  publish({ ...current, status: "done" });
  return { state: current, context: data };
};

/** Polls `predicate` until it holds; throws `message` after `timeoutMs`. */
export const waitUntil = async (predicate: () => boolean, { timeoutMs = 20_000, intervalMs = 50, message }: { timeoutMs?: number; intervalMs?: number; message: string }) => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};
