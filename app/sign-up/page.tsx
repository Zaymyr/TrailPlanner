"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { persistSessionToStorage } from "../../lib/auth-storage";
import { redirectToGoogleOAuth } from "../../lib/oauth";

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter your full name").max(120),
    email: z.string().trim().email({ message: "Enter a valid email" }),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

type SignUpForm = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

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
      } | null;

      if (!response.ok || !data?.access_token) {
        setFormError(data?.message ?? "Unable to create account. Please try again.");
        return;
      }

      persistSessionToStorage({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        email: values.email,
      });

      setFormMessage("Account created! Redirecting…");
      router.push("/race-planner");
      router.refresh();
    } catch (error) {
      console.error("Unable to sign up", error);
      setFormError("Something went wrong. Please try again.");
    }
  });

  const handleGoogleSignUp = () => {
    setOauthError(null);

    try {
      redirectToGoogleOAuth();
    } catch (error) {
      console.error("Unable to start Google sign up", error);
      setOauthError(error instanceof Error ? error.message : "Unable to start Google sign up.");
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">Sign up</h1>
        <p className="text-slate-300">
          Create your Trailplanner account to start organizing your race day fueling.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          className="justify-center border-slate-700 bg-slate-900/60 text-slate-50 hover:bg-slate-800"
          onClick={handleGoogleSignUp}
        >
          Continue with Google
        </Button>
        {oauthError && <p className="text-sm text-amber-400">{oauthError}</p>}
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-400">
        <div className="h-px flex-1 bg-slate-800" />
        <span>Or continue with email</span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Alex Runner"
            {...register("fullName")}
          />
          {errors.fullName && <p className="text-sm text-amber-400">{errors.fullName.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-amber-400">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder="••••••••"
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-amber-400">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder="••••••••"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <p className="text-sm text-amber-400">{errors.confirmPassword.message}</p>}
        </div>

        {formError && <p className="text-sm text-amber-400">{formError}</p>}
        {formMessage && <p className="text-sm text-emerald-300">{formMessage}</p>}

        <Button type="submit" disabled={isSubmitting} className="justify-center">
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </div>
  );
}
