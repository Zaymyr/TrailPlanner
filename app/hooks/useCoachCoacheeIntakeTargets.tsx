"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchCoachIntakeTargets, upsertCoachIntakeTargets } from "../../lib/coach-intake-targets-client";
import type { CoachIntakeTargets, CoachIntakeTargetsUpsert } from "../../lib/coach-intake-targets";

const buildCoachIntakeTargetsKey = (accessToken?: string, coacheeId?: string) => [
  "coach-intake-targets",
  accessToken,
  coacheeId,
];

export const useCoachCoacheeIntakeTargets = ({
  accessToken,
  coacheeId,
}: {
  accessToken?: string;
  coacheeId?: string;
}) => {
  const queryClient = useQueryClient();
  const queryKey = buildCoachIntakeTargetsKey(accessToken, coacheeId);

  const query = useQuery({
    queryKey,
    enabled: Boolean(accessToken && coacheeId),
    queryFn: async () => {
      if (!accessToken || !coacheeId) {
        throw new Error("Missing credentials.");
      }

      return fetchCoachIntakeTargets(accessToken, coacheeId);
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (payload: CoachIntakeTargetsUpsert) => {
      if (!accessToken) {
        throw new Error("Missing credentials.");
      }

      return upsertCoachIntakeTargets(accessToken, payload);
    },
    onMutate: async (payload: CoachIntakeTargetsUpsert) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CoachIntakeTargets | null>(queryKey);
      queryClient.setQueryData<CoachIntakeTargets | null>(queryKey, {
        carbsPerHour: payload.carbsPerHour,
        waterMlPerHour: payload.waterMlPerHour,
        sodiumMgPerHour: payload.sodiumMgPerHour,
      });
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (targets) => {
      queryClient.setQueryData(queryKey, targets);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...query,
    upsertTargets: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
};
