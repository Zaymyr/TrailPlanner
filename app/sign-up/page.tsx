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
import { useI18n } from "../i18n-provider";
import type { Translations } from "../../locales/types";

const createSignUpSchema = (authCopy: Translations["auth"]) =>
  z
    .object({
      fullName: z
        .string()
        .trim()
        .min(2, authCopy.signUp.fullNameRequirement)
        .max(120),
      email: z.string().trim().email({ message: authCopy.shared.emailInvalid }),
      password: z.string().min(8, authCopy.shared.passwordRequirement),
      confirmPassword: z.string().min(8, authCopy.shared.passwordRequirement),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: authCopy.signUp.mismatchError,
      path: ["confirmPassword"],
    });

type SignUpForm = z.infer<ReturnType<typeof createSignUpSchema>>;

export default function SignUpPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
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

      if (data?.access_token) {
        persistSessionToStorage({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          email: values.email,
        });

        setFormMessage(t.auth.signUp.success);
        router.push("/race-planner");
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">{t.auth.signUp.title}</h1>
        <p className="text-slate-300">{t.auth.signUp.description}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">{t.auth.signUp.fullNameLabel}</Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder={t.auth.signUp.fullNamePlaceholder}
            {...register("fullName")}
          />
          {errors.fullName && <p className="text-sm text-amber-400">{errors.fullName.message}</p>}
        </div>

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
            autoComplete="new-password"
            minLength={8}
            placeholder={t.auth.shared.passwordPlaceholder}
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-amber-400">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">{t.auth.signUp.confirmPasswordLabel}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder={t.auth.signUp.confirmPasswordPlaceholder}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <p className="text-sm text-amber-400">{errors.confirmPassword.message}</p>}
        </div>

        {formError && <p className="text-sm text-amber-400">{formError}</p>}
        {formMessage && <p className="text-sm text-emerald-300">{formMessage}</p>}

        <Button type="submit" disabled={isSubmitting} className="justify-center">
          {isSubmitting ? t.auth.signUp.submitting : t.auth.signUp.submit}
        </Button>
      </form>
    </div>
  );
}
