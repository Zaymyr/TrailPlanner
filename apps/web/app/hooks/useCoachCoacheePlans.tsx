"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CoachPlan, CoachPlanCreate, CoachPlanDelete, CoachPlanUpdate } from "../../lib/coach-plans";
import { createCoachPlan, deleteCoachPlan, fetchCoachPlans, updateCoachPlan } from "../../lib/coach-plans-client";

const buildCoachPlansKey = (accessToken?: string, coacheeId?: string) => ["coach-plans", accessToken, coacheeId];

export const useCoachCoacheePlans = ({
  accessToken,
  coacheeId,
}: {
  accessToken?: string;
  coacheeId?: string;
}) => {
  const queryClient = useQueryClient();
  const queryKey = buildCoachPlansKey(accessToken, coacheeId);

  const query = useQuery({
    queryKey,
    enabled: Boolean(accessToken && coacheeId),
    queryFn: async () => {
      if (!accessToken || !coacheeId) {
        throw new Error("Missing credentials.");
      }

      return fetchCoachPlans(accessToken, coacheeId);
    },
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CoachPlanCreate) => {
      if (!accessToken) {
        throw new Error("Missing credentials.");
      }

      return createCoachPlan(accessToken, payload);
    },
    onSuccess: (plan) => {
      queryClient.setQueryData<CoachPlan[]>(queryKey, (previous) => [plan, ...(previous ?? [])]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: CoachPlanUpdate) => {
      if (!accessToken) {
        throw new Error("Missing credentials.");
      }

      return updateCoachPlan(accessToken, payload);
    },
    onSuccess: (plan) => {
      queryClient.setQueryData<CoachPlan[]>(queryKey, (previous) =>
        (previous ?? []).map((item) => (item.id === plan.id ? plan : item))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: CoachPlanDelete) => {
      if (!accessToken) {
        throw new Error("Missing credentials.");
      }

      await deleteCoachPlan(accessToken, payload);
      return payload.id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<CoachPlan[]>(queryKey, (previous) =>
        (previous ?? []).filter((item) => item.id !== deletedId)
      );
    },
  });

  const createPlan = async (payload: CoachPlanCreate) => {
    const previous = queryClient.getState<CoachPlan[]>(queryKey).data ?? [];

    try {
      const result = await createMutation.mutateAsync(payload);
      return result;
    } catch (error) {
      queryClient.setQueryData(queryKey, previous);
      throw error;
    } finally {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const updatePlan = async (payload: CoachPlanUpdate) => {
    const previous = queryClient.getState<CoachPlan[]>(queryKey).data ?? [];

    try {
      const result = await updateMutation.mutateAsync(payload);
      return result;
    } catch (error) {
      queryClient.setQueryData(queryKey, previous);
      throw error;
    } finally {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const deletePlan = async (payload: CoachPlanDelete) => {
    const previous = queryClient.getState<CoachPlan[]>(queryKey).data ?? [];

    try {
      await deleteMutation.mutateAsync(payload);
    } catch (error) {
      queryClient.setQueryData(queryKey, previous);
      throw error;
    } finally {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  return {
    ...query,
    createPlan,
    updatePlan,
    deletePlan,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    createError: createMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
  };
};
