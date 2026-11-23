"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthCard, AuthDivider, AuthError, authInputClassName, authSubmitClassName, AuthSuccess, AuthTextLink, OAuthButtons } from "../../components/auth/AuthCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { persistSessionToStorage } from "../../lib/auth-storage";
import { SIGN_IN_ERROR_CODES } from "../../lib/auth-errors";
import { redirectToAppleOAuth, redirectToGoogleOAuth } from "../../lib/oauth";
import {
  buildAuthCallbackPath,
  buildAuthHref,
  clearRememberedRunnerReturnPath,
  readCurrentReturnPath,
} from "../../lib/organizer-acquisition";
import { useI18n } from "../i18n-provider";
import type { Translations } from "../../locales/types";

const createSignInSchema = (authCopy: Translations["auth"]) =>
  z.object({
    email: z.string().trim().email({ message: authCopy.shared.emailInvalid }),
    password: z.string().min(8, authCopy.shared.passwordRequirement),
  });

type SignInForm = z.infer<ReturnType<typeof createSignInSchema>>;

export default function SignInPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  // Keep an explicit `?next=` when switching between sign-in and sign-up (read after mount: the page is prerendered).
  const [alternateAuthHref, setAlternateAuthHref] = useState("/sign-up");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("next")) {
      setAlternateAuthHref(buildAuthHref("/sign-up", readCurrentReturnPath()));
    }
  }, []);

  const signInSchema = useMemo(() => createSignInSchema(t.auth), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setFormMessage(null);

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = (await response.json().catch(() => null)) as {
        access_token?: string;
        refresh_token?: string;
        code?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.access_token) {
        setFormError(
          data?.code === SIGN_IN_ERROR_CODES.invalidCredentials
            ? t.auth.signIn.invalidCredentials
            : response.status === 429 && data?.message
              ? data.message
              : t.auth.signIn.error
        );
        return;
      }

      persistSessionToStorage({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        email: values.email,
      });

      setFormMessage(t.auth.signIn.success);
      const returnPath = readCurrentReturnPath();
      clearRememberedRunnerReturnPath();
      router.push(returnPath as Route);
      router.refresh();
    } catch (error) {
      console.error("Unable to sign in", error);
      setFormError(t.auth.shared.genericError);
    }
  });

  const handleGoogleSignIn = () => {
    setOauthError(null);

    try {
      redirectToGoogleOAuth(buildAuthCallbackPath(readCurrentReturnPath()));
    } catch (error) {
      console.error("Unable to start Google sign-in", error);
      setOauthError(
        t.auth.shared.oauthStartError
      );
    }
  };

  const handleAppleSignIn = () => {
    setOauthError(null);

    try {
      redirectToAppleOAuth(buildAuthCallbackPath(readCurrentReturnPath()));
    } catch (error) {
      console.error("Unable to start Apple sign-in", error);
      setOauthError(
        t.auth.shared.oauthStartError
      );
    }
  };

  return (
    <AuthCard
      title={t.auth.signIn.title}
      description={t.auth.signIn.description}
      footer={
        <>
          {t.auth.shared.noAccount} <AuthTextLink href={alternateAuthHref}>{t.auth.shared.createAccountLink}</AuthTextLink>
        </>
      }
    >
      <OAuthButtons
        googleLabel={t.auth.signIn.continueWithGoogle}
        appleLabel={t.auth.signIn.continueWithApple}
        onGoogle={handleGoogleSignIn}
        onApple={handleAppleSignIn}
        error={oauthError}
      />

      <AuthDivider label={t.auth.signIn.continueWithEmail} />

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

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">{t.auth.shared.passwordLabel}</Label>
            <AuthTextLink href="/forgot-password">{t.auth.signIn.forgotPassword}</AuthTextLink>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t.auth.shared.passwordPlaceholder}
            className={authInputClassName}
            {...register("password")}
          />
          {errors.password && <AuthError>{errors.password.message}</AuthError>}
        </div>

        {formError && <AuthError>{formError}</AuthError>}
        {formMessage && <AuthSuccess>{formMessage}</AuthSuccess>}

        <Button type="submit" disabled={isSubmitting} className={authSubmitClassName}>
          {isSubmitting ? t.auth.signIn.submitting : t.auth.signIn.submit}
        </Button>
      </form>
    </AuthCard>
  );
}
