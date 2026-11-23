"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { useI18n } from "../../../i18n-provider";
import { formatDateTimeLocal, premiumGrantFormSchema, type PremiumGrantFormValues } from "../admin-types";

export type PremiumGrantDraft = { id: string; startsAt: string; initialDurationDays: number; reason: string };
export type PremiumGrantSubmit = { startsAt: string; initialDurationDays: number; reason: string };

/**
 * « Accorder Premium » (POST `/api/admin/premium`, unchanged since before lot 5) and, with a `grant`,
 * « Modifier l’attribution » (PATCH `/api/admin/premium`: start, duration, reason of an existing
 * grant). Opened from the runner profile; the caller runs the request.
 */
export function PremiumGrantDialog({ open, grant, pending, onOpenChange, onSubmit }: {
  open: boolean;
  grant?: PremiumGrantDraft | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: PremiumGrantSubmit) => void;
}) {
  const { t } = useI18n();
  const reasons = useMemo(() => [
    { value: "trial_extension", label: t.admin.users.premium.reasons.trialExtension },
    { value: "support", label: t.admin.users.premium.reasons.support },
    { value: "marketing", label: t.admin.users.premium.reasons.marketing },
    { value: "partner", label: t.admin.users.premium.reasons.partner },
    { value: "other", label: t.admin.users.premium.reasons.other },
  ], [t.admin.users.premium.reasons]);

  const form = useForm<PremiumGrantFormValues>({
    resolver: zodResolver(premiumGrantFormSchema),
    defaultValues: { startsAt: formatDateTimeLocal(new Date()), initialDurationDays: 30, reason: reasons[0]?.value ?? "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(grant
      ? { startsAt: formatDateTimeLocal(new Date(grant.startsAt)), initialDurationDays: grant.initialDurationDays, reason: grant.reason }
      : { startsAt: formatDateTimeLocal(new Date()), initialDurationDays: 30, reason: reasons[0]?.value ?? "" });
  }, [form, grant, open, reasons]);

  const submit = form.handleSubmit((values) => {
    const startsAt = new Date(values.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      form.setError("startsAt", { message: t.admin.users.premium.form.errors.invalidDate });
      return;
    }
    onSubmit({ startsAt: startsAt.toISOString(), initialDurationDays: values.initialDurationDays, reason: values.reason });
  });

  const knownReason = reasons.some((reason) => reason.value === grant?.reason);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{grant ? "Modifier l’attribution Premium" : t.admin.users.premium.form.title}</DialogTitle>
          <DialogDescription>
            {grant ? "Le début, la durée et le motif de l’attribution sont remplacés. Une fin anticipée (révocation) reste prioritaire." : t.admin.users.premium.form.description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="premium-starts-at">{t.admin.users.premium.form.startsAtLabel}</Label>
            <Input id="premium-starts-at" type="datetime-local" {...form.register("startsAt")} />
            {form.formState.errors.startsAt ? <p className="text-xs text-red-600 dark:text-red-300">{form.formState.errors.startsAt.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="premium-duration">{t.admin.users.premium.form.durationLabel}</Label>
            <Input id="premium-duration" type="number" min="1" {...form.register("initialDurationDays", { valueAsNumber: true })} />
            {form.formState.errors.initialDurationDays ? <p className="text-xs text-red-600 dark:text-red-300">{form.formState.errors.initialDurationDays.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="premium-reason">{t.admin.users.premium.form.reasonLabel}</Label>
            <select id="premium-reason" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" {...form.register("reason")}>
              {grant && !knownReason ? <option value={grant.reason}>{grant.reason}</option> : null}
              {reasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {form.formState.errors.reason ? <p className="text-xs text-red-600 dark:text-red-300">{form.formState.errors.reason.message}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t.admin.users.premium.form.cancel}</Button>
            <Button type="submit" disabled={pending}>
              {pending ? t.admin.users.premium.form.submitting : grant ? "Enregistrer" : t.admin.users.premium.form.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
