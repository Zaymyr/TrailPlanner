"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useI18n } from "../i18n-provider";
import type { Translations } from "../../locales/types";

const createResetRequestSchema = (authCopy: Translations["auth"]) =>
  z.object({
    email: z.string().trim().email({ message: authCopy.shared.emailInvalid }),
  });

type ResetRequestForm = z.infer<ReturnType<typeof createResetRequestSchema>>;

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const resetRequestSchema = useMemo(() => createResetRequestSchema(t.auth), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetRequestForm>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setFormMessage(null);

    try {
      const response = await fetch("/api/auth/password-reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        setFormError(t.auth.passwordResetRequest.error);
        return;
      }

      setFormMessage(t.auth.passwordResetRequest.success);
    } catch (error) {
      console.error("Unable to request password reset", error);
      setFormError(t.auth.passwordResetRequest.error);
    }
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border border-border-strong bg-card p-6 text-foreground shadow-lg dark:bg-slate-950/60">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t.auth.passwordResetRequest.title}</h1>
        <p className="text-muted-foreground">{t.auth.passwordResetRequest.description}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t.auth.shared.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.auth.shared.emailPlaceholder}
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-amber-400">{errors.email.message}</p>}
        </div>

        {formError && <p className="text-sm text-amber-400">{formError}</p>}
        {formMessage && <p className="text-sm text-emerald-300">{formMessage}</p>}

        <Button type="submit" disabled={isSubmitting} className="justify-center">
          {isSubmitting ? t.auth.passwordResetRequest.submitting : t.auth.passwordResetRequest.submit}
        </Button>
      </form>

      <Link href="/sign-in" className="text-sm text-emerald-300 hover:text-emerald-200">
        {t.auth.passwordResetRequest.backToSignIn}
      </Link>
    </div>
  );
}
