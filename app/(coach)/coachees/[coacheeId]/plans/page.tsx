"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import type { CoachPlan } from "../../../../../lib/coach-plans";
import { CoachCommentsSection } from "./CoachCommentsSection";
import { useCoachCoacheePlans } from "../../../../hooks/useCoachCoacheePlans";
import { useI18n } from "../../../../i18n-provider";
import { useVerifiedSession } from "../../../../hooks/useVerifiedSession";

const planFormSchema = z.object({
  name: z.string().trim().min(1),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

type PlanRowProps = {
  plan: CoachPlan;
  accessToken: string;
  coacheeId: string;
  onSave: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
  t: ReturnType<typeof useI18n>["t"];
};

const PlanRow = ({ plan, accessToken, coacheeId, onSave, onDelete, isUpdating, isDeleting, t }: PlanRowProps) => {
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: plan.name,
    },
  });

  useEffect(() => {
    form.reset({ name: plan.name });
  }, [form, plan.name]);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-slate-900">{plan.name}</CardTitle>
        <p className="text-xs text-slate-500">
          {t.coachPlans.updatedLabel.replace("{date}", new Date(plan.updatedAt).toLocaleDateString())}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (values) => {
            await onSave(values.name);
          })}
        >
          <div className="space-y-2">
            <Label htmlFor={`plan-name-${plan.id}`}>{t.coachPlans.fields.nameLabel}</Label>
            <Input id={`plan-name-${plan.id}`} {...form.register("name")} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? t.coachPlans.actions.saving : t.coachPlans.actions.save}
            </Button>
            <Button type="button" variant="outline" disabled={isDeleting} onClick={onDelete}>
              {isDeleting ? t.coachPlans.actions.deleting : t.coachPlans.actions.delete}
            </Button>
          </div>
        </form>
        <div className="border-t border-slate-200 pt-4">
          <CoachCommentsSection accessToken={accessToken} coacheeId={coacheeId} plan={plan} />
        </div>
      </CardContent>
    </Card>
  );
};

export default function CoachCoacheePlansPage() {
  const { t } = useI18n();
  const params = useParams();
  const { session } = useVerifiedSession();
  const coacheeId = useMemo(() => {
    const value = params?.coacheeId;
    return typeof value === "string" ? value : value?.[0];
  }, [params]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data: plans,
    isLoading,
    error,
    createPlan,
    updatePlan,
    deletePlan,
    isCreating,
    isUpdating,
    isDeleting,
    createError,
    updateError,
    deleteError,
  } = useCoachCoacheePlans({
    accessToken: session?.accessToken,
    coacheeId,
  });

  const createForm = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: "",
    },
  });

  const handleCreate = async (values: PlanFormValues) => {
    if (!coacheeId) return;
    setSuccessMessage(null);
    try {
      await createPlan({
        coacheeId,
        name: values.name,
        plannerValues: {},
        elevationProfile: [],
      });
      createForm.reset({ name: "" });
      setSuccessMessage(t.coachPlans.messages.created);
    } catch {
      setSuccessMessage(null);
    }
  };

  const handleUpdate = async (plan: CoachPlan, name: string) => {
    if (!coacheeId) return;
    setSuccessMessage(null);
    try {
      await updatePlan({
        id: plan.id,
        coacheeId,
        name,
        plannerValues: plan.plannerValues,
        elevationProfile: plan.elevationProfile,
      });
      setSuccessMessage(t.coachPlans.messages.updated);
    } catch {
      setSuccessMessage(null);
    }
  };

  const handleDelete = async (plan: CoachPlan) => {
    if (!coacheeId) return;
    setSuccessMessage(null);
    try {
      await deletePlan({
        id: plan.id,
        coacheeId,
      });
      setSuccessMessage(t.coachPlans.messages.deleted);
    } catch {
      setSuccessMessage(null);
    }
  };

  if (!session?.accessToken) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">{t.coachPlans.title}</h1>
        <p className="text-sm text-slate-600">{t.coachPlans.authRequired}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{t.coachPlans.title}</h1>
        <p className="text-sm text-slate-600">{t.coachPlans.description}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">{t.coachPlans.createTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={createForm.handleSubmit(handleCreate)}>
            <div className="space-y-2">
              <Label htmlFor="new-plan-name">{t.coachPlans.fields.nameLabel}</Label>
              <Input
                id="new-plan-name"
                placeholder={t.coachPlans.fields.namePlaceholder}
                {...createForm.register("name")}
              />
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? t.coachPlans.actions.creating : t.coachPlans.actions.create}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">{t.coachPlans.listTitle}</h2>
          <p className="text-sm text-slate-500">{t.coachPlans.listDescription}</p>
        </div>

        {isLoading ? <p className="text-sm text-slate-500">{t.coachPlans.loading}</p> : null}
        {error ? <p className="text-sm text-red-600">{t.coachPlans.loadError}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
        {createError ? <p className="text-sm text-red-600">{t.coachPlans.errors.create}</p> : null}
        {updateError ? <p className="text-sm text-red-600">{t.coachPlans.errors.update}</p> : null}
        {deleteError ? <p className="text-sm text-red-600">{t.coachPlans.errors.delete}</p> : null}

        {!isLoading && !error && (plans?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500">{t.coachPlans.empty}</p>
        ) : null}

        <div className="grid gap-4">
          {coacheeId
            ? (plans ?? []).map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  accessToken={session.accessToken}
                  coacheeId={coacheeId}
                  t={t}
                  isUpdating={isUpdating}
                  isDeleting={isDeleting}
                  onSave={(name) => handleUpdate(plan, name)}
                  onDelete={() => handleDelete(plan)}
                />
              ))
            : null}
        </div>
      </section>
    </div>
  );
}
