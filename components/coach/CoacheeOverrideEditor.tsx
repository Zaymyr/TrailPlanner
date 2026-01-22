"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { Translations } from "../../locales/types";

const intakeTargetsFormSchema = z.object({
  carbsPerHour: z.number().min(0).nullable(),
  waterMlPerHour: z.number().min(0).nullable(),
  sodiumMgPerHour: z.number().min(0).nullable(),
});

export type CoacheeOverrideFormValues = z.infer<typeof intakeTargetsFormSchema>;

type CoacheeOverrideEditorProps = {
  defaultValues: CoacheeOverrideFormValues;
  isSaving: boolean;
  onSubmit: (values: CoacheeOverrideFormValues) => Promise<void>;
  copy: Translations["coachCoacheeDetail"]["override"];
  successMessage?: string | null;
  errorMessage?: string | null;
  disabled?: boolean;
};

const toNullableNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function CoacheeOverrideEditor({
  defaultValues,
  isSaving,
  onSubmit,
  copy,
  successMessage,
  errorMessage,
  disabled = false,
}: CoacheeOverrideEditorProps) {
  const form = useForm<CoacheeOverrideFormValues>({
    resolver: zodResolver(intakeTargetsFormSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  return (
    <div className="space-y-4">
      {copy.helper ? <p className="text-xs text-slate-500">{copy.helper}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="carbsPerHour">{copy.fields.carbsLabel}</Label>
          <Input
            id="carbsPerHour"
            type="number"
            step="0.1"
            placeholder={copy.fields.carbsPlaceholder}
            disabled={disabled}
            {...form.register("carbsPerHour", { setValueAs: toNullableNumber })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="waterMlPerHour">{copy.fields.waterLabel}</Label>
          <Input
            id="waterMlPerHour"
            type="number"
            step="1"
            placeholder={copy.fields.waterPlaceholder}
            disabled={disabled}
            {...form.register("waterMlPerHour", { setValueAs: toNullableNumber })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sodiumMgPerHour">{copy.fields.sodiumLabel}</Label>
          <Input
            id="sodiumMgPerHour"
            type="number"
            step="1"
            placeholder={copy.fields.sodiumPlaceholder}
            disabled={disabled}
            {...form.register("sodiumMgPerHour", { setValueAs: toNullableNumber })}
          />
        </div>
        <Button type="submit" disabled={disabled || isSaving}>
          {isSaving ? copy.saving : copy.save}
        </Button>
      </form>
    </div>
  );
}
