type PendingOnboardingTransition = {
  planName: string | null;
  progress: number;
};

let pendingOnboardingTransition: PendingOnboardingTransition | null = null;
const onboardingTransitionListeners = new Set<
  (transition: PendingOnboardingTransition | null) => void
>();

function emitPendingOnboardingTransition() {
  for (const listener of onboardingTransitionListeners) {
    listener(pendingOnboardingTransition);
  }
}

export function getPendingOnboardingTransition() {
  return pendingOnboardingTransition;
}

export function setPendingOnboardingTransition(next: PendingOnboardingTransition) {
  pendingOnboardingTransition = next;
  emitPendingOnboardingTransition();
}

export function updatePendingOnboardingTransition(
  patch: Partial<PendingOnboardingTransition>,
) {
  if (!pendingOnboardingTransition) {
    pendingOnboardingTransition = {
      planName: patch.planName ?? null,
      progress: patch.progress ?? 0.08,
    };
    return;
  }

  pendingOnboardingTransition = {
    ...pendingOnboardingTransition,
    ...patch,
  };
  emitPendingOnboardingTransition();
}

export function clearPendingOnboardingTransition() {
  pendingOnboardingTransition = null;
  emitPendingOnboardingTransition();
}

export function addPendingOnboardingTransitionListener(
  listener: (transition: PendingOnboardingTransition | null) => void,
) {
  onboardingTransitionListeners.add(listener);

  return () => {
    onboardingTransitionListeners.delete(listener);
  };
}
