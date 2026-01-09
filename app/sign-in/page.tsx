"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { persistSessionToStorage } from "../../lib/auth-storage";
import { redirectToGoogleOAuth } from "../../lib/oauth";
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
        message?: string;
      } | null;

      if (!response.ok || !data?.access_token) {
        setFormError(data?.message ?? t.auth.signIn.error);
        return;
      }

      persistSessionToStorage({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        email: values.email,
      });

      setFormMessage(t.auth.signIn.success);
      router.push("/race-planner");
      router.refresh();
    } catch (error) {
      console.error("Unable to sign in", error);
      setFormError(t.auth.shared.genericError);
    }
  });

  const handleGoogleSignIn = () => {
    setOauthError(null);

    try {
      redirectToGoogleOAuth();
    } catch (error) {
      console.error("Unable to start Google sign-in", error);
      setOauthError(
        error instanceof Error ? error.message : "Unable to start Google sign-in."
      );
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border border-border-strong bg-card p-6 text-foreground shadow-lg dark:bg-slate-950/60">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t.auth.signIn.title}</h1>
        <p className="text-muted-foreground">{t.auth.signIn.description}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          className="justify-center border-border bg-background text-foreground hover:bg-muted dark:bg-slate-900/60 dark:text-slate-50 dark:hover:bg-slate-800"
          onClick={handleGoogleSignIn}
        >
          Continue with Google
        </Button>
        {oauthError && <p className="text-sm text-amber-400">{oauthError}</p>}
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>Or continue with email</span>
        <div className="h-px flex-1 bg-border" />
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t.auth.shared.passwordLabel}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t.auth.shared.passwordPlaceholder}
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-amber-400">{errors.password.message}</p>}
        </div>

        {formError && <p className="text-sm text-amber-400">{formError}</p>}
        {formMessage && <p className="text-sm text-emerald-300">{formMessage}</p>}

        <Button type="submit" disabled={isSubmitting} className="justify-center">
          {isSubmitting ? t.auth.signIn.submitting : t.auth.signIn.submit}
        </Button>
      </form>
    </div>
  );
}
