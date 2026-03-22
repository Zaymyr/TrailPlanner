"use client";

import { useEffect, useState } from "react";

import type { CoachCoachee } from "../../lib/coach-coachees";
import { fetchCoachCoachees } from "../../lib/coach-coachees-client";

type UseCoachCoacheesState = {
  coachees: CoachCoachee[];
  isLoading: boolean;
  error: string | null;
};

export const useCoachCoachees = ({
  accessToken,
  enabled = true,
}: {
  accessToken?: string;
  enabled?: boolean;
}): UseCoachCoacheesState => {
  const [coachees, setCoachees] = useState<CoachCoachee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !enabled) {
      setCoachees([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const abortController = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchCoachCoachees(accessToken, abortController.signal)
      .then((data) => {
        if (!abortController.signal.aborted) {
          setCoachees(data);
        }
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          console.error("Unable to load coach coachees", err);
          setCoachees([]);
          setError(err instanceof Error ? err.message : "Unable to load coachees");
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
  }, [accessToken, enabled]);

  return { coachees, isLoading, error };
};
