"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { persistSessionToStorage } from "../../lib/auth-storage";
import { useI18n } from "../i18n-provider";
import type { Translations } from "../../locales/types";

type ResetTokens = {
  accessToken: string;
  refreshToken?: string;
};

const createResetSchema = (authCopy: Translations["auth"]) =>
  z
    .object({
      password: z.string().min(8, authCopy.shared.passwordRequirement),
      confirmPassword: z.string().min(8, authCopy.shared.passwordRequirement),
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

  if (!accessToken || type !== "recovery") {
    return null;
  }

  window.history.replaceState(null, "", window.location.pathname);
  return { accessToken, refreshToken };
};

export default function ResetPasswordPage() {
  const router = useRouter();
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
          ...(resetTokens.refreshToken ? { "x-refresh-token": resetTokens.refreshToken } : {}),
        },
      });

      const sessionData = (await sessionResponse.json().catch(() => null)) as {
        user?: { email?: string };
      } | null;

      persistSessionToStorage({
        accessToken: resetTokens.accessToken,
        refreshToken: resetTokens.refreshToken,
        email: sessionData?.user?.email,
      });

      setFormMessage(t.auth.passwordReset.success);
      router.push("/race-planner");
      router.refresh();
    } catch (error) {
      console.error("Unable to reset password", error);
      setFormError(t.auth.passwordReset.error);
    }
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border border-border-strong bg-card p-6 text-foreground shadow-lg dark:bg-slate-950/60">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t.auth.passwordReset.title}</h1>
        <p className="text-muted-foreground">{t.auth.passwordReset.description}</p>
      </div>

      {linkError ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-amber-400">{linkError}</p>
          <Link href="/sign-in" className="text-sm text-emerald-300 hover:text-emerald-200">
            {t.auth.passwordReset.backToSignIn}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t.auth.shared.passwordLabel}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={t.auth.shared.passwordPlaceholder}
              {...register("password")}
            />
            {errors.password && <p className="text-sm text-amber-400">{errors.password.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">{t.auth.passwordReset.confirmPasswordLabel}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t.auth.passwordReset.confirmPasswordPlaceholder}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-amber-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          {formError && <p className="text-sm text-amber-400">{formError}</p>}
          {formMessage && <p className="text-sm text-emerald-300">{formMessage}</p>}

          <Button type="submit" disabled={isSubmitting} className="justify-center">
            {isSubmitting ? t.auth.passwordReset.submitting : t.auth.passwordReset.submit}
          </Button>
        </form>
      )}
    </div>
  );
}
