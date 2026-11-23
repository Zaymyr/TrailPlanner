"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthCard, AuthDivider, AuthError, authInputClassName, authSubmitClassName, AuthSuccess, AuthTextLink, OAuthButtons } from "../../components/auth/AuthCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { persistSessionToStorage } from "../../lib/auth-storage";
import { trackSignUpCompleted, trackSignUpStarted, type SignUpMethod } from "../../lib/product-analytics";
import { parseSourceRaceFromPath, readFunnelSourceRace } from "../../lib/race-funnel-source";
import { redirectToAppleOAuth, redirectToGoogleOAuth } from "../../lib/oauth";
import {
  buildAuthCallbackPath,
  buildAuthHref,
  clearRememberedRunnerReturnPath,
  readCurrentReturnPath,
} from "../../lib/organizer-acquisition";

import { useI18n } from "../i18n-provider";
import type { Translations } from "../../locales/types";

const createPasswordSchema = (message: string) =>
  z.string().min(8, message).regex(/[A-Za-zÀ-ÖØ-öø-ÿ]/, message).regex(/\d/, message);

const createSignUpSchema = (authCopy: Translations["auth"]) =>
  z
    .object({
      fullName: z
        .string()
        .trim()
        .min(2, authCopy.signUp.fullNameRequirement)
        .max(120),
      email: z.string().trim().email({ message: authCopy.shared.emailInvalid }),
      password: createPasswordSchema(authCopy.shared.passwordRequirement),
      confirmPassword: createPasswordSchema(authCopy.shared.passwordRequirement),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: authCopy.signUp.mismatchError,
      path: ["confirmPassword"],
    });

type SignUpForm = z.infer<ReturnType<typeof createSignUpSchema>>;

/** Race that led the runner here: carried by the return path, else the last race page/estimate. */
const resolveSourceRace = (returnPath: string) => parseSourceRaceFromPath(returnPath) ?? readFunnelSourceRace();

export default function SignUpPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  // Keep an explicit `?next=` when switching between sign-in and sign-up (read after mount: the page is prerendered).
  const [alternateAuthHref, setAlternateAuthHref] = useState("/sign-in");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("next")) {
      setAlternateAuthHref(buildAuthHref("/sign-in", readCurrentReturnPath()));
    }
  }, []);

  const signUpSchema = useMemo(() => createSignUpSchema(t.auth), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setFormMessage(null);

    try {
      const returnPath = readCurrentReturnPath();
      const sourceRace = resolveSourceRace(returnPath);
      trackSignUpStarted({ method: "email", sourceRace });
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          returnPath,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        access_token?: string;
        refresh_token?: string;
        message?: string;
        requiresEmailConfirmation?: boolean;
      } | null;

      if (!response.ok) {
        setFormError(data?.message ?? t.auth.signUp.error);
        return;
      }

      if (data?.access_token || data?.requiresEmailConfirmation) {
        trackSignUpCompleted({
          method: "email",
          emailConfirmationPending: !data.access_token,
          sourceRace,
        });
      }

      if (data?.access_token) {
        persistSessionToStorage({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          email: values.email,
        });

        setFormMessage(t.auth.signUp.success);
        clearRememberedRunnerReturnPath();
        router.push(returnPath as Route);
        router.refresh();
        return;
      }

      if (data?.requiresEmailConfirmation) {
        setFormMessage(t.auth.signUp.pendingEmail);
        return;
      }

      setFormMessage(t.auth.signUp.success);
    } catch (error) {
      console.error("Unable to sign up", error);
      setFormError(t.auth.shared.genericError);
    }
  });

  const trackOAuthSignUpStarted = (method: SignUpMethod, returnPath: string) =>
    trackSignUpStarted({ method, sourceRace: resolveSourceRace(returnPath) });

  const handleGoogleSignUp = () => {
    setOauthError(null);

    try {
      const returnPath = readCurrentReturnPath();
      trackOAuthSignUpStarted("google", returnPath);
      redirectToGoogleOAuth(buildAuthCallbackPath(returnPath));
    } catch (error) {
      console.error("Unable to start Google sign up", error);
      setOauthError(t.auth.shared.oauthStartError);
    }
  };

  const handleAppleSignUp = () => {
    setOauthError(null);

    try {
      const returnPath = readCurrentReturnPath();
      trackOAuthSignUpStarted("apple", returnPath);
      redirectToAppleOAuth(buildAuthCallbackPath(returnPath));
    } catch (error) {
      console.error("Unable to start Apple sign up", error);
      setOauthError(t.auth.shared.oauthStartError);
    }
  };

  return (
    <AuthCard
      title={t.auth.signUp.title}
      description={t.auth.signUp.description}
      footer={
        <>
          {t.auth.shared.hasAccount} <AuthTextLink href={alternateAuthHref}>{t.auth.shared.signInLink}</AuthTextLink>
        </>
      }
    >
      <OAuthButtons
        googleLabel={t.auth.signIn.continueWithGoogle}
        appleLabel={t.auth.signIn.continueWithApple}
        onGoogle={handleGoogleSignUp}
        onApple={handleAppleSignUp}
        error={oauthError}
      />

      <AuthDivider label={t.auth.signIn.continueWithEmail} />

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">{t.auth.signUp.fullNameLabel}</Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder={t.auth.signUp.fullNamePlaceholder}
            className={authInputClassName}
            {...register("fullName")}
          />
          {errors.fullName && <AuthError>{errors.fullName.message}</AuthError>}
        </div>

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
          <Label htmlFor="password">{t.auth.shared.passwordLabel}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
        minLength={8}
            placeholder={t.auth.shared.passwordPlaceholder}
            className={authInputClassName}
            {...register("password")}
          />
          {errors.password && <AuthError>{errors.password.message}</AuthError>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">{t.auth.signUp.confirmPasswordLabel}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
        minLength={8}
            placeholder={t.auth.signUp.confirmPasswordPlaceholder}
            className={authInputClassName}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <AuthError>{errors.confirmPassword.message}</AuthError>}
        </div>

        {formError && <AuthError>{formError}</AuthError>}
        {formMessage && <AuthSuccess>{formMessage}</AuthSuccess>}

        <Button type="submit" disabled={isSubmitting} className={authSubmitClassName}>
          {isSubmitting ? t.auth.signUp.submitting : t.auth.signUp.submit}
        </Button>
      </form>
    </AuthCard>
  );
}
