"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CoachComment,
  CoachCommentCreate,
  CoachCommentDelete,
  CoachCommentUpdate,
} from "../../lib/coach-comments";
import {
  createCoachComment,
  deleteCoachComment,
  fetchCoachComments,
  updateCoachComment,
} from "../../lib/coach-comments-client";

const buildCoachCommentsKey = (accessToken?: string, planId?: string) => [
  "coach-comments",
  accessToken,
  planId,
];

export const useCoachComments = ({ accessToken, planId }: { accessToken?: string; planId?: string }) => {
  const queryClient = useQueryClient();
  const queryKey = buildCoachCommentsKey(accessToken, planId);

  const query = useQuery({
    queryKey,
    enabled: Boolean(accessToken && planId),
    queryFn: async () => {
      if (!accessToken || !planId) {
        throw new Error("Missing credentials.");
      }

      return fetchCoachComments(accessToken, planId);
    },
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CoachCommentCreate) => {
      if (!accessToken) {
        throw new Error("Missing credentials.");
      }

      return createCoachComment(accessToken, payload);
    },
    onSuccess: (comment) => {
      queryClient.setQueryData<CoachComment[]>(queryKey, (previous) => [comment, ...(previous ?? [])]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: CoachCommentUpdate) => {
      if (!accessToken) {
        throw new Error("Missing credentials.");
      }

      return updateCoachComment(accessToken, payload);
    },
    onSuccess: (comment) => {
      queryClient.setQueryData<CoachComment[]>(queryKey, (previous) =>
        (previous ?? []).map((item) => (item.id === comment.id ? comment : item))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: CoachCommentDelete) => {
      if (!accessToken) {
        throw new Error("Missing credentials.");
      }

      await deleteCoachComment(accessToken, payload);
      return payload.id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<CoachComment[]>(queryKey, (previous) =>
        (previous ?? []).filter((item) => item.id !== deletedId)
      );
    },
  });

  const createComment = async (payload: CoachCommentCreate) => {
    const previous = queryClient.getState<CoachComment[]>(queryKey).data ?? [];

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

  const updateComment = async (payload: CoachCommentUpdate) => {
    const previous = queryClient.getState<CoachComment[]>(queryKey).data ?? [];

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

  const deleteComment = async (payload: CoachCommentDelete) => {
    const previous = queryClient.getState<CoachComment[]>(queryKey).data ?? [];

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
    createComment,
    updateComment,
    deleteComment,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    createError: createMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
  };
};
