"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { CoachInviteCreate } from "../../lib/coach-invites";
import type { Translations } from "../../locales/types";

const inviteFormSchema = z.object({
  email: z.string().trim().email(),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

type InviteFormProps = {
  onInvite: (payload: CoachInviteCreate) => Promise<void>;
  isSubmitting: boolean;
  errorMessage?: string | null;
  copy: Translations["coachDashboard"]["inviteForm"];
};

export function InviteForm({ onInvite, isSubmitting, errorMessage, copy }: InviteFormProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSuccessMessage(null);
    try {
      await onInvite(values);
      form.reset();
      setSuccessMessage(copy.success);
    } catch {
      // Error state handled via mutation and errorMessage prop.
    }
  });

  useEffect(() => {
    if (errorMessage) {
      setSuccessMessage(null);
    }
  }, [errorMessage]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        {copy.description ? <p className="text-sm text-slate-500">{copy.description}</p> : null}
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="invite-email">{copy.emailLabel}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={copy.emailPlaceholder}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? copy.submitting : copy.submit}
          </Button>
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
