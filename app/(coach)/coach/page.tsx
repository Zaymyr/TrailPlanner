"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CoacheeList } from "../../../components/coach/CoacheeList";
import { InviteForm } from "../../../components/coach/InviteForm";
import { InviteList } from "../../../components/coach/InviteList";
import { TierCard } from "../../../components/coach/TierCard";
import type { CoachCoachee } from "../../../lib/coach-coachees";
import { fetchCoachCoachees } from "../../../lib/coach-coachees-client";
import type { CoachDashboard } from "../../../lib/coach-dashboard";
import { fetchCoachDashboard } from "../../../lib/coach-dashboard-client";
import { cancelCoachInvite, createCoachInvite, resendCoachInvite } from "../../../lib/coach-invites-client";
import { useI18n } from "../../i18n-provider";
import { useVerifiedSession } from "../../hooks/useVerifiedSession";

const dashboardQueryKey = (accessToken?: string) => ["coach-dashboard", accessToken];
const coacheesQueryKey = (accessToken?: string) => ["coach-coachees", accessToken];

export default function CoachDashboardPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const { session, isLoading: isSessionLoading } = useVerifiedSession();
  const accessToken = session?.accessToken;

  const dashboardQuery = useQuery<CoachDashboard>({
    queryKey: dashboardQueryKey(accessToken),
    queryFn: () => {
      if (!accessToken) {
        return Promise.reject(new Error("Missing access token"));
      }
      return fetchCoachDashboard(accessToken);
    },
    enabled: Boolean(accessToken),
  });

  const coacheesQuery = useQuery<CoachCoachee[]>({
    queryKey: coacheesQueryKey(accessToken),
    queryFn: () => {
      if (!accessToken) {
        return Promise.reject(new Error("Missing access token"));
      }
      return fetchCoachCoachees(accessToken);
    },
    enabled: Boolean(accessToken),
  });

  const inviteMutation = useMutation<void, { email: string }>({
    mutationFn: async (payload: { email: string }) => {
      if (!accessToken) {
        throw new Error("Missing access token");
      }
      await createCoachInvite(accessToken, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(accessToken) });
      void queryClient.invalidateQueries({ queryKey: coacheesQueryKey(accessToken) });
    },
  });

  const resendInviteMutation = useMutation<void, { id: string }>({
    mutationFn: async ({ id }) => {
      if (!accessToken) {
        throw new Error("Missing access token");
      }
      await resendCoachInvite(accessToken, id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(accessToken) });
    },
  });

  const cancelInviteMutation = useMutation<void, { id: string }>({
    mutationFn: async ({ id }) => {
      if (!accessToken) {
        throw new Error("Missing access token");
      }
      await cancelCoachInvite(accessToken, id);
    },
    onMutate: async (variables: { id: string }) => {
      const { id } = variables;
      if (!accessToken) {
        return {};
      }
      const previousDashboard = queryClient.getState<CoachDashboard>(dashboardQueryKey(accessToken)).data;
      if (previousDashboard) {
        queryClient.setQueryData<CoachDashboard>(dashboardQueryKey(accessToken), {
          ...previousDashboard,
          invites: previousDashboard.invites.filter((invite) => invite.id !== id),
        });
      }
      return { previousDashboard };
    },
    onError: (_error, _variables, context) => {
      const typedContext = context as { previousDashboard?: CoachDashboard } | undefined;
      if (typedContext?.previousDashboard && accessToken) {
        queryClient.setQueryData(dashboardQueryKey(accessToken), typedContext.previousDashboard);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(accessToken) });
    },
  });

  const actionError = resendInviteMutation.error ?? cancelInviteMutation.error;
  const resendingInviteId = resendInviteMutation.isPending ? resendInviteMutation.variables?.id : null;
  const cancelingInviteId = cancelInviteMutation.isPending ? cancelInviteMutation.variables?.id : null;

  if (isSessionLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <p className="text-sm text-slate-500">{t.coachDashboard.loading}</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">{t.coachDashboard.title}</h1>
        <p className="text-sm text-slate-600">{t.coachDashboard.authRequired}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{t.coachDashboard.title}</h1>
        <p className="text-sm text-slate-600">{t.coachDashboard.description}</p>
      </header>

      <TierCard
        dashboard={dashboardQuery.data}
        isLoading={dashboardQuery.isLoading}
        error={dashboardQuery.error}
        labels={t.profile.subscription.coachTiers.labels}
        copy={t.coachDashboard.tier}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <InviteForm
          onInvite={async (payload) => inviteMutation.mutateAsync(payload)}
          isSubmitting={inviteMutation.isPending}
          errorMessage={inviteMutation.error ? inviteMutation.error.message : null}
          copy={t.coachDashboard.inviteForm}
        />
        <InviteList
          invites={dashboardQuery.data?.invites ?? []}
          isLoading={dashboardQuery.isLoading}
          error={dashboardQuery.error}
          actionError={actionError?.message ?? null}
          onResend={async (inviteId) => resendInviteMutation.mutateAsync({ id: inviteId })}
          onCancel={async (inviteId) => cancelInviteMutation.mutateAsync({ id: inviteId })}
          resendingInviteId={resendingInviteId}
          cancelingInviteId={cancelingInviteId}
          copy={t.coachDashboard.invites}
          locale={locale}
        />
      </div>

      <CoacheeList
        coachees={coacheesQuery.data ?? []}
        isLoading={coacheesQuery.isLoading}
        error={coacheesQuery.error}
        copy={t.coachDashboard.coachees}
        locale={locale}
      />
    </div>
  );
}
