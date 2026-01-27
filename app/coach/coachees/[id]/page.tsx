"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CoacheeOverrideEditor, type CoacheeOverrideFormValues } from "../../../../components/coach/CoacheeOverrideEditor";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import {
  createCoachCoacheeOverride,
  disableCoachCoachee,
  fetchCoachCoacheeDetail,
} from "../../../../lib/coach-coachee-details-client";
import type { CoachCoacheeDetail } from "../../../../lib/coach-coachee-details";
import { useCoachCoacheePlans } from "../../../hooks/useCoachCoacheePlans";
import { useI18n } from "../../../i18n-provider";
import { useVerifiedSession } from "../../../hooks/useVerifiedSession";

const detailQueryKey = (accessToken?: string, coacheeId?: string) => ["coach-coachee-detail", accessToken, coacheeId];

const formatStatus = (status: string, labels: Record<string, string>) => labels[status] ?? status;

export default function CoachCoacheeDetailPage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useVerifiedSession();
  const queryClient = useQueryClient();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [removeMessage, setRemoveMessage] = useState<string | null>(null);

  const coacheeId = useMemo(() => {
    const value = params?.id;
    return typeof value === "string" ? value : value?.[0];
  }, [params]);

  const detailQuery = useQuery<CoachCoacheeDetail>({
    queryKey: detailQueryKey(session?.accessToken, coacheeId),
    queryFn: () => {
      if (!session?.accessToken || !coacheeId) {
        return Promise.reject(new Error("Missing access token"));
      }
      return fetchCoachCoacheeDetail(session.accessToken, coacheeId);
    },
    enabled: Boolean(session?.accessToken && coacheeId),
  });
  const {
    data: coacheePlans,
    isLoading: isPlansLoading,
    error: plansError,
  } = useCoachCoacheePlans({
    accessToken: session?.accessToken,
    coacheeId,
  });

  const overrideMutation = useMutation({
    mutationFn: async (values: CoacheeOverrideFormValues) => {
      if (!session?.accessToken || !coacheeId) {
        throw new Error("Missing access token");
      }
      return createCoachCoacheeOverride(session.accessToken, coacheeId, {
        carbsPerHour: values.carbsPerHour,
        waterMlPerHour: values.waterMlPerHour,
        sodiumMgPerHour: values.sodiumMgPerHour,
      });
    },
    onSuccess: async () => {
      setSaveMessage(t.coachCoacheeDetail.override.success);
      await queryClient.invalidateQueries({ queryKey: detailQueryKey(session?.accessToken, coacheeId) });
    },
    onError: () => {
      setSaveMessage(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!session?.accessToken || !coacheeId) {
        throw new Error("Missing access token");
      }
      return disableCoachCoachee(session.accessToken, coacheeId);
    },
    onSuccess: async () => {
      setRemoveMessage(t.coachCoacheeDetail.actions.success);
      await queryClient.invalidateQueries({ queryKey: detailQueryKey(session?.accessToken, coacheeId) });
      router.push("/coach");
    },
    onError: () => {
      setRemoveMessage(null);
    },
  });

  const handleRemove = async () => {
    if (!coacheeId || removeMutation.isPending) {
      return;
    }
    const confirmed = window.confirm(t.coachCoacheeDetail.actions.confirm);
    if (!confirmed) {
      return;
    }
    await removeMutation.mutateAsync();
  };

  const detail = detailQuery.data;
  const name =
    detail?.coachee.fullName ?? detail?.coachee.invitedEmail ?? t.coachCoacheeDetail.unknownName;
  const statusLabel = detail ? formatStatus(detail.coachee.status, t.coachDashboard.coachees.status) : "-";

  const overrideDefaults: CoacheeOverrideFormValues = {
    carbsPerHour: detail?.latestOverride?.carbsPerHour ?? null,
    waterMlPerHour: detail?.latestOverride?.waterMlPerHour ?? null,
    sodiumMgPerHour: detail?.latestOverride?.sodiumMgPerHour ?? null,
  };

  if (isSessionLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-10">
        <p className="text-sm text-slate-500">{t.coachCoacheeDetail.loading}</p>
      </div>
    );
  }

  if (!session?.accessToken) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">{t.coachCoacheeDetail.title}</h1>
        <p className="text-sm text-slate-600">{t.coachCoacheeDetail.authRequired}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{t.coachCoacheeDetail.title}</h1>
        <p className="text-sm text-slate-600">{t.coachCoacheeDetail.description}</p>
      </header>

      {detailQuery.isLoading ? <p className="text-sm text-slate-500">{t.coachCoacheeDetail.loading}</p> : null}
      {detailQuery.error ? <p className="text-sm text-red-600">{t.coachCoacheeDetail.loadError}</p> : null}

      {detail ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">{t.coachCoacheeDetail.profile.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t.coachCoacheeDetail.profile.fields.name}</p>
              <p className="font-medium text-slate-900">{name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t.coachCoacheeDetail.profile.fields.status}</p>
              <p>{statusLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t.coachCoacheeDetail.profile.fields.age}</p>
              <p>{detail.coachee.age ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t.coachCoacheeDetail.profile.fields.waterBag}
              </p>
              <p>{detail.coachee.waterBagLiters ?? "-"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t.coachCoacheeDetail.profile.fields.email}
              </p>
              <p>{detail.coachee.invitedEmail ?? "-"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">{t.coachCoacheeDetail.override.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">{t.coachCoacheeDetail.override.description}</p>
          {detail?.latestOverride ? (
            <p className="text-xs text-slate-500">
              {t.coachCoacheeDetail.override.latestLabel}{" "}
              {new Date(detail.latestOverride.createdAt).toLocaleDateString(locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          ) : (
            <p className="text-xs text-slate-500">{t.coachCoacheeDetail.override.latestEmpty}</p>
          )}
          <CoacheeOverrideEditor
            defaultValues={overrideDefaults}
            isSaving={overrideMutation.isPending}
            onSubmit={async (values) => {
              await overrideMutation.mutateAsync(values);
            }}
            copy={t.coachCoacheeDetail.override}
            successMessage={saveMessage}
            errorMessage={overrideMutation.error ? t.coachCoacheeDetail.override.error : null}
            disabled={!detail}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">{t.coachCoacheeDetail.plans.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">{t.coachCoacheeDetail.plans.description}</p>
          {isPlansLoading ? <p className="text-sm text-slate-500">{t.coachCoacheeDetail.plans.loading}</p> : null}
          {plansError ? <p className="text-sm text-red-600">{t.coachCoacheeDetail.plans.loadError}</p> : null}
          {!isPlansLoading && !plansError && (coacheePlans?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500">{t.coachCoacheeDetail.plans.empty}</p>
          ) : null}
          <div className="space-y-3">
            {(coacheePlans ?? []).map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"
              >
                <div>
                  <p className="font-semibold text-slate-900">{plan.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.coachCoacheeDetail.plans.updatedLabel.replace(
                      "{date}",
                      new Date(plan.updatedAt).toLocaleDateString(locale)
                    )}
                  </p>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!coacheeId) return;
                      router.push(`/race-planner?coacheeId=${coacheeId}&planId=${plan.id}`);
                    }}
                  >
                    {t.coachCoacheeDetail.plans.openPlanner}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">{t.coachCoacheeDetail.actions.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">{t.coachCoacheeDetail.actions.description}</p>
          {removeMessage ? <p className="text-sm text-emerald-600">{removeMessage}</p> : null}
          {removeMutation.error ? (
            <p className="text-sm text-red-600">{t.coachCoacheeDetail.actions.error}</p>
          ) : null}
          <Button
            type="button"
            disabled={!detail || removeMutation.isPending}
            onClick={handleRemove}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {removeMutation.isPending ? t.coachCoacheeDetail.actions.removing : t.coachCoacheeDetail.actions.remove}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
