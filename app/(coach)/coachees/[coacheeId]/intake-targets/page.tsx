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
import { useCoachCoacheeIntakeTargets } from "../../../../hooks/useCoachCoacheeIntakeTargets";
import { useI18n } from "../../../../i18n-provider";
import { useVerifiedSession } from "../../../../hooks/useVerifiedSession";

const intakeTargetsFormSchema = z.object({
  carbsPerHour: z.union([z.coerce.number().min(0), z.literal("").transform(() => null)]),
  waterMlPerHour: z.union([z.coerce.number().min(0), z.literal("").transform(() => null)]),
  sodiumMgPerHour: z.union([z.coerce.number().min(0), z.literal("").transform(() => null)]),
});

type IntakeTargetsFormValues = z.infer<typeof intakeTargetsFormSchema>;

const toInputValue = (value: number | null | undefined) => (typeof value === "number" ? value : "");

export default function CoachCoacheeIntakeTargetsPage() {
  const { t } = useI18n();
  const params = useParams();
  const { session } = useVerifiedSession();
  const coacheeId = useMemo(() => {
    const value = params?.coacheeId;
    return typeof value === "string" ? value : value?.[0];
  }, [params]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const {
    data: targets,
    isLoading,
    error,
    upsertTargets,
    isSaving,
    saveError,
  } = useCoachCoacheeIntakeTargets({
    accessToken: session?.accessToken,
    coacheeId,
  });

  const form = useForm<IntakeTargetsFormValues>({
    resolver: zodResolver(intakeTargetsFormSchema),
    defaultValues: {
      carbsPerHour: "",
      waterMlPerHour: "",
      sodiumMgPerHour: "",
    },
  });

  useEffect(() => {
    if (targets === undefined) {
      return;
    }

    form.reset({
      carbsPerHour: toInputValue(targets?.carbsPerHour),
      waterMlPerHour: toInputValue(targets?.waterMlPerHour),
      sodiumMgPerHour: toInputValue(targets?.sodiumMgPerHour),
    });
  }, [form, targets]);

  const onSubmit = async (values: IntakeTargetsFormValues) => {
    if (!session?.accessToken || !coacheeId) {
      setSaveMessage(null);
      return;
    }

    try {
      await upsertTargets({
        coacheeId,
        carbsPerHour: values.carbsPerHour ?? null,
        waterMlPerHour: values.waterMlPerHour ?? null,
        sodiumMgPerHour: values.sodiumMgPerHour ?? null,
      });
      setSaveMessage(t.coachIntakeTargets.success);
    } catch {
      setSaveMessage(null);
    }
  };

  if (!session?.accessToken) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">{t.coachIntakeTargets.title}</h1>
        <p className="text-sm text-slate-600">{t.coachIntakeTargets.authRequired}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{t.coachIntakeTargets.title}</h1>
        <p className="text-sm text-slate-600">{t.coachIntakeTargets.description}</p>
        <p className="text-xs text-slate-500">{t.coachIntakeTargets.helper}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">{t.coachIntakeTargets.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? <p className="text-sm text-slate-500">{t.coachIntakeTargets.loading}</p> : null}
          {error ? <p className="text-sm text-red-600">{t.coachIntakeTargets.loadError}</p> : null}
          {saveMessage ? <p className="text-sm text-emerald-600">{saveMessage}</p> : null}
          {saveError ? <p className="text-sm text-red-600">{t.coachIntakeTargets.error}</p> : null}

          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="carbsPerHour">{t.coachIntakeTargets.fields.carbsLabel}</Label>
              <Input
                id="carbsPerHour"
                type="number"
                step="0.1"
                placeholder={t.coachIntakeTargets.fields.carbsPlaceholder}
                {...form.register("carbsPerHour")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waterMlPerHour">{t.coachIntakeTargets.fields.waterLabel}</Label>
              <Input
                id="waterMlPerHour"
                type="number"
                step="1"
                placeholder={t.coachIntakeTargets.fields.waterPlaceholder}
                {...form.register("waterMlPerHour")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sodiumMgPerHour">{t.coachIntakeTargets.fields.sodiumLabel}</Label>
              <Input
                id="sodiumMgPerHour"
                type="number"
                step="1"
                placeholder={t.coachIntakeTargets.fields.sodiumPlaceholder}
                {...form.register("sodiumMgPerHour")}
              />
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t.coachIntakeTargets.saving : t.coachIntakeTargets.save}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
