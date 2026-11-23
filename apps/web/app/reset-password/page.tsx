"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthCard, AuthError, authInputClassName, AuthNotice, authSubmitClassName, AuthSuccess, AuthTextLink } from "../../components/auth/AuthCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { persistSessionToStorage } from "../../lib/auth-storage";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { useI18n } from "../i18n-provider";
import type { Translations } from "../../locales/types";

const createPasswordSchema = (message: string) =>
  z.string().min(8, message).regex(/[A-Za-zÀ-ÖØ-öø-ÿ]/, message).regex(/\d/, message);

type ResetTokens = {
  accessToken: string;
  refreshToken?: string;
  flow: "invite" | "recovery";
};

const createResetSchema = (authCopy: Translations["auth"]) =>
  z
    .object({
      password: createPasswordSchema(authCopy.shared.passwordRequirement),
      confirmPassword: createPasswordSchema(authCopy.shared.passwordRequirement),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: authCopy.passwordReset.mismatchError,
      path: ["confirmPassword"],
    });

type ResetForm = z.infer<ReturnType<typeof createResetSchema>>;

const parseResetTokens = (): ResetTokens | null => {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token") ?? undefined;
  const type = params.get("type");
  const isInviteLink = type === "invite";
  const isRecoveryLink = type === "recovery";

  if (!accessToken || (!isRecoveryLink && !isInviteLink)) {
    return null;
  }

  window.history.replaceState(null, "", window.location.pathname);
  return { accessToken, refreshToken, flow: isInviteLink ? "invite" : "recovery" };
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const { refresh } = useVerifiedSession();
  const { t } = useI18n();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [resetTokens, setResetTokens] = useState<ResetTokens | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const resetSchema = useMemo(() => createResetSchema(t.auth), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    const tokens = parseResetTokens();
    if (!tokens) {
      setLinkError(t.auth.passwordReset.invalidLink);
      return;
    }

    setResetTokens(tokens);
  }, [t]);

  const onSubmit = handleSubmit(async (values) => {
    if (!resetTokens) {
      setFormError(t.auth.passwordReset.invalidLink);
      return;
    }

    setFormError(null);
    setFormMessage(null);

    try {
      const response = await fetch("/api/auth/password-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resetTokens.accessToken}`,
        },
        body: JSON.stringify({ password: values.password }),
      });

      if (!response.ok) {
        setFormError(t.auth.passwordReset.error);
        return;
      }

      const sessionResponse = await fetch("/api/auth/session", {
        headers: {
          Authorization: `Bearer ${resetTokens.accessToken}`,
          ...(resetTokens.refreshToken ? { "x-refresh-token": `Bearer ${resetTokens.refreshToken}` } : {}),
        },
      });

      const sessionData = (await sessionResponse.json().catch(() => null)) as {
        user?: { id?: string; email?: string };
        access_token?: string;
        refresh_token?: string;
      } | null;

      if (!sessionResponse.ok || !sessionData?.user?.id) {
        setFormError(t.auth.passwordReset.error);
        return;
      }

      persistSessionToStorage({
        accessToken: sessionData?.access_token ?? resetTokens.accessToken,
        refreshToken: sessionData?.refresh_token ?? resetTokens.refreshToken,
        email: sessionData?.user?.email,
      });

      const sessionReady = await refresh({ afterCurrent: true });
      if (!sessionReady) {
        setFormError(t.auth.passwordReset.error);
        return;
      }

      setFormMessage(t.auth.passwordReset.success);
      const destination = resetTokens.flow === "invite" ? "/organizer" : "/race-planner";
      router.replace(destination);
    } catch (error) {
      console.error("Unable to reset password", error);
      setFormError(t.auth.passwordReset.error);
    }
  });

  return (
    <AuthCard
      title={t.auth.passwordReset.title}
      description={t.auth.passwordReset.description}
      footer={<AuthTextLink href="/sign-in">{t.auth.passwordReset.backToSignIn}</AuthTextLink>}
    >
      {linkError ? (
        <AuthNotice>
          <p className="font-semibold">{linkError}</p>
          <Button
            type="button"
            className={authSubmitClassName}
            data-testid="request-new-password-link"
            onClick={() => router.push("/forgot-password")}
          >
            {t.auth.passwordResetRequest.title}
          </Button>
        </AuthNotice>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t.auth.shared.passwordLabel}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={t.auth.shared.passwordPlaceholder}
              className={authInputClassName}
              {...register("password")}
            />
            {errors.password && <AuthError>{errors.password.message}</AuthError>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">{t.auth.passwordReset.confirmPasswordLabel}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t.auth.passwordReset.confirmPasswordPlaceholder}
              className={authInputClassName}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && <AuthError>{errors.confirmPassword.message}</AuthError>}
          </div>

          {formError && <AuthError>{formError}</AuthError>}
          {formMessage && <AuthSuccess>{formMessage}</AuthSuccess>}

          <Button type="submit" disabled={isSubmitting} className={authSubmitClassName}>
            {isSubmitting ? t.auth.passwordReset.submitting : t.auth.passwordReset.submit}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
