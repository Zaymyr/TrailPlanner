"use client";

import { useEffect, useState } from "react";

import { fetchCoachIntakeTargets } from "../../lib/coach-intake-targets-client";
import type { CoachIntakeTargets } from "../../lib/coach-intake-targets";

type CoachIntakeTargetsState = {
  targets: CoachIntakeTargets | null;
  isLoading: boolean;
  error: string | null;
};

export const useCoachIntakeTargets = (accessToken?: string): CoachIntakeTargetsState => {
  const [targets, setTargets] = useState<CoachIntakeTargets | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setTargets(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const abortController = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchCoachIntakeTargets(accessToken, abortController.signal)
      .then((data) => {
        if (!abortController.signal.aborted) {
          setTargets(data);
        }
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          console.error("Unable to load coach intake targets", err);
          setTargets(null);
          setError(err instanceof Error ? err.message : "Unable to load coach intake targets");
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [accessToken]);

  return { targets, isLoading, error };
};
