"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthCard, AuthError, authInputClassName, authSubmitClassName, AuthSuccess, AuthTextLink } from "../../components/auth/AuthCard";
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
    <AuthCard
      title={t.auth.passwordResetRequest.title}
      description={t.auth.passwordResetRequest.description}
      footer={<AuthTextLink href="/sign-in">{t.auth.passwordResetRequest.backToSignIn}</AuthTextLink>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t.auth.shared.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.auth.shared.emailPlaceholder}
            className={authInputClassName}
            {...register("email")}
          />
          {errors.email && <AuthError>{errors.email.message}</AuthError>}
        </div>

        {formError && <AuthError>{formError}</AuthError>}
        {formMessage && <AuthSuccess>{formMessage}</AuthSuccess>}

        <Button type="submit" disabled={isSubmitting} className={authSubmitClassName}>
          {isSubmitting ? t.auth.passwordResetRequest.submitting : t.auth.passwordResetRequest.submit}
        </Button>
      </form>
    </AuthCard>
  );
}
