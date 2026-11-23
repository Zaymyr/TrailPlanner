"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";

import { Button } from "../../components/ui/button";
import Link from "next/link";

import { AuthCard, AuthTextLink } from "../../components/auth/AuthCard";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FuelTypeBadge } from "../../components/products/FuelTypeBadge";
import { rememberPendingCheckout } from "../../lib/checkout-return";
import { trackRunnerCheckoutStarted } from "../../lib/product-analytics";
import { readFunnelSourceRace } from "../../lib/race-funnel-source";
import { fetchUserProfile, updateUserProfile } from "../../lib/profile-client";
import { mapProductToSelection } from "../../lib/product-preferences";
import { fuelProductSchema, type FuelProduct } from "../../lib/product-types";
import { PageLoadingSkeleton } from "../../components/PageLoadingSkeleton";
import { RunnerAdminAccessMode } from "../../components/RunnerAdminAccessMode";
import { fetchTrialStatus } from "../../lib/trial-client";
import { isTrialActive } from "../../lib/trial";
import { useProductSelection } from "../hooks/useProductSelection";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { useI18n } from "../i18n-provider";
import { ProfileDialog, ProfileError, ProfileSection, profileFieldClassName } from "./_components/ProfileLayout";
import { RUNNER_PROFILE_FIELDS } from "@trailplanner/shared";
import { useRunnerPrice } from "../hooks/useRunnerPrice";


const splitPaceMinutesPerKm = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return { minutes: undefined, seconds: undefined };
  }

  const totalSeconds = Math.round(value * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return { minutes, seconds };
};

const buildComfortableFlatPaceMinPerKm = (
  minutes?: number,
  seconds?: number
): number | null => {
  const safeMinutes = typeof minutes === "number" ? minutes : undefined;
  const safeSeconds = typeof seconds === "number" ? seconds : undefined;

  if (typeof safeMinutes !== "number" && typeof safeSeconds !== "number") {
    return null;
  }

  return Number(((safeMinutes ?? 0) + (safeSeconds ?? 0) / 60).toFixed(4));
};

const profileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  birthDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("").transform(() => undefined)]).optional(),
  heightCm: z.union([z.coerce.number().int().min(100).max(250), z.literal("").transform(() => undefined)]).optional(),
  weightKg: z.union([z.coerce.number().min(20).max(250), z.literal("").transform(() => undefined)]).optional(),
  waterBagLiters: z
    .union([z.coerce.number().min(0).max(20), z.literal("").transform(() => undefined)])
    .optional(),
  utmbIndex: z
    .union([z.coerce.number().min(0).max(2000), z.literal("").transform(() => undefined)])
    .optional(),
  comfortableFlatPaceMinutes: z
    .union([z.coerce.number().int().min(0).max(999), z.literal("").transform(() => undefined)])
    .optional(),
  comfortableFlatPaceSeconds: z
    .union([z.coerce.number().int().min(0).max(999), z.literal("").transform(() => undefined)])
    .optional(),
  defaultCarbsGPerHour: z
    .union([z.coerce.number().min(0).max(200), z.literal("").transform(() => undefined)])
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const productListSchema = z.object({ products: z.array(fuelProductSchema) });

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const runnerProfileLabels = useMemo(
    () => Object.fromEntries(RUNNER_PROFILE_FIELDS.map((field) => [field.key, field.labels[locale]])),
    [locale],
  ) as Record<(typeof RUNNER_PROFILE_FIELDS)[number]["key"], string>;
  const queryClient = useQueryClient();
  const { session, isLoading, entitlements, isEntitlementsLoading, refreshEntitlements } = useVerifiedSession();
  const { replaceSelection } = useProductSelection();
  const router = useRouter();
  const [favoriteProducts, setFavoriteProducts] = useState<FuelProduct[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "opening">("idle");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const annualPrice = useRunnerPrice("annual", locale);
  const [unsubscribeDialogOpen, setUnsubscribeDialogOpen] = useState(false);
  const [unsubscribeStatus, setUnsubscribeStatus] = useState<"idle" | "opening">("idle");
  const [unsubscribeError, setUnsubscribeError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDialogOpen && !upgradeDialogOpen && !unsubscribeDialogOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsDialogOpen(false);
      setUpgradeDialogOpen(false);
      setUnsubscribeDialogOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isDialogOpen, unsubscribeDialogOpen, upgradeDialogOpen]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: "",
      birthDate: undefined,
      heightCm: undefined,
      weightKg: undefined,
      waterBagLiters: undefined,
      utmbIndex: undefined,
      comfortableFlatPaceMinutes: undefined,
      comfortableFlatPaceSeconds: undefined,
      defaultCarbsGPerHour: undefined,
    },
  });

  const authMissing = !session?.accessToken;

  useEffect(() => {
    if (!session?.accessToken) {
      setFavoriteProducts([]);
      replaceSelection([]);
    }
  }, [replaceSelection, session?.accessToken]);

  const profileQuery = useQuery({
    queryKey: ["profile", session?.accessToken],
    enabled: Boolean(session?.accessToken),
    queryFn: async () => {
      if (!session?.accessToken) {
        throw new Error(t.profile.authRequired);
      }

      return fetchUserProfile(session.accessToken);
    },
    staleTime: 60_000,
    onSuccess: (profile) => {
      const comfortableFlatPace = splitPaceMinutesPerKm(profile.comfortableFlatPaceMinPerKm);
      form.reset({
        fullName: profile.fullName ?? "",
        birthDate: profile.birthDate ?? undefined,
        heightCm: profile.heightCm ?? undefined,
        weightKg: profile.weightKg ?? undefined,
        waterBagLiters: profile.waterBagLiters ?? undefined,
        utmbIndex: profile.utmbIndex ?? undefined,
        comfortableFlatPaceMinutes: comfortableFlatPace.minutes,
        comfortableFlatPaceSeconds: comfortableFlatPace.seconds,
        defaultCarbsGPerHour: profile.defaultCarbsGPerHour ?? undefined,
      });
      setFavoriteProducts(profile.favoriteProducts);
      replaceSelection(profile.favoriteProducts.map((product) => mapProductToSelection(product)));
      queryClient.setQueryData(["profile", session?.accessToken], profile);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.profile.error;
      setSaveError(message);
    },
  });

  const trialStatusQuery = useQuery({
    queryKey: ["trial-status", session?.accessToken],
    enabled: Boolean(session?.accessToken),
    queryFn: () => fetchTrialStatus(session?.accessToken ?? ""),
    staleTime: 60_000,
  });

  const productsQuery = useQuery({
    queryKey: ["profile-products", session?.accessToken],
    enabled: Boolean(session?.accessToken),
    queryFn: async () => {
      if (!session?.accessToken) {
        throw new Error(t.profile.authRequired);
      }

      const response = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.profile.error;
        throw new Error(message);
      }

      const parsed = productListSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.profile.error);
      }

      return parsed.data.products;
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!session?.accessToken) {
        throw new Error(t.profile.authRequired);
      }

      return updateUserProfile(session.accessToken, {
        fullName: values.fullName ?? null,
        birthDate: values.birthDate ?? null,
        heightCm: typeof values.heightCm === "number" ? values.heightCm : null,
        weightKg: typeof values.weightKg === "number" ? values.weightKg : null,
        waterBagLiters: typeof values.waterBagLiters === "number" ? values.waterBagLiters : null,
        utmbIndex: typeof values.utmbIndex === "number" ? values.utmbIndex : null,
        comfortableFlatPaceMinPerKm: buildComfortableFlatPaceMinPerKm(
          values.comfortableFlatPaceMinutes,
          values.comfortableFlatPaceSeconds
        ),
        defaultCarbsGPerHour: typeof values.defaultCarbsGPerHour === "number" ? values.defaultCarbsGPerHour : null,
        favoriteProductIds: favoriteProducts.map((product) => product.id),
      });
    },
    onSuccess: (profile) => {
      const comfortableFlatPace = splitPaceMinutesPerKm(profile.comfortableFlatPaceMinPerKm);
      setSaveMessage(t.profile.success);
      setSaveError(null);
      setFavoriteProducts(profile.favoriteProducts);
      replaceSelection(profile.favoriteProducts.map((product) => mapProductToSelection(product)));
      form.reset({
        fullName: profile.fullName ?? "",
        birthDate: profile.birthDate ?? undefined,
        heightCm: profile.heightCm ?? undefined,
        weightKg: profile.weightKg ?? undefined,
        waterBagLiters: profile.waterBagLiters ?? undefined,
        utmbIndex: profile.utmbIndex ?? undefined,
        comfortableFlatPaceMinutes: comfortableFlatPace.minutes,
        comfortableFlatPaceSeconds: comfortableFlatPace.seconds,
        defaultCarbsGPerHour: profile.defaultCarbsGPerHour ?? undefined,
      });
      queryClient.setQueryData(["profile", session?.accessToken], profile);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.profile.error;
      setSaveError(message);
      setSaveMessage(null);
    },
  });

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const products = productsQuery.data ?? [];

    if (!query) return products;

    return products.filter((product) => product.name.toLowerCase().includes(query));
  }, [productsQuery.data, searchQuery]);

  const premiumPriceDisplay = annualPrice.status === "available"
    ? annualPrice.formatted
    : locale === "fr" ? "Prix indisponible" : "Price unavailable";

  const trialEndsAt = trialStatusQuery.data?.trialEndsAt ?? null;
  const trialActive = useMemo(() => isTrialActive(trialEndsAt), [trialEndsAt]);
  const trialEndsAtLabel = useMemo(() => {
    if (!trialActive || !trialEndsAt) return null;
    const formatted = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(trialEndsAt));
    return t.profile.subscription.trialEndsAt.replace("{date}", formatted);
  }, [locale, t.profile.subscription.trialEndsAt, trialActive, trialEndsAt]);

  const subscriptionStatusLabel = useMemo(() => {
    if (isEntitlementsLoading) return t.profile.subscription.loading;
    if (entitlements.isPremium) return t.profile.subscription.premiumStatus;
    if (trialActive) return t.profile.subscription.trialStatus;
    return t.profile.subscription.freeStatus;
  }, [
    entitlements.isPremium,
    isEntitlementsLoading,
    t.profile.subscription.freeStatus,
    t.profile.subscription.loading,
    t.profile.subscription.premiumStatus,
    t.profile.subscription.trialStatus,
    trialActive,
  ]);

  const premiumSourceLabel = useMemo(() => {
    if (!entitlements.isPremium) return null;
    if (trialActive) return t.profile.subscription.premiumSourceTrial;
    return t.profile.subscription.premiumSourceSubscription;
  }, [
    entitlements.isPremium,
    t.profile.subscription.premiumSourceSubscription,
    t.profile.subscription.premiumSourceTrial,
    trialActive,
  ]);
  const premiumGrant = entitlements.premiumGrant ?? null;
  const premiumGrantStartLabel = useMemo(() => {
    if (!premiumGrant?.startsAt) return null;
    const formatted = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(
      new Date(premiumGrant.startsAt)
    );
    return formatted;
  }, [locale, premiumGrant?.startsAt]);
  const isGuestSession = session?.isAnonymous === true;
  const handleUpgrade = useCallback(async () => {
    if (!session?.accessToken) {
      setUpgradeError(t.profile.authRequired);
      return;
    }

    if (session?.isAnonymous) {
      setUpgradeDialogOpen(false);
      router.push("/sign-up");
      return;
    }

    setUpgradeStatus("opening");
    setUpgradeError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.message ?? t.profile.subscription.checkoutError);
      }

      const sourceRace = readFunnelSourceRace();
      trackRunnerCheckoutStarted({ offer: "annual", placement: "profile", sourceRace });
      rememberPendingCheckout({ offer: "annual", sourceRace });
      const popup = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!popup) {
        setUpgradeError(t.profile.premiumModal.popupBlocked);
        return;
      }

      popup.opener = null;
      popup.focus();
      setUpgradeDialogOpen(false);
    } catch (error) {
      console.error("Unable to open checkout", error);
      setUpgradeError(error instanceof Error ? error.message : t.profile.subscription.checkoutError);
    } finally {
      setUpgradeStatus("idle");
    }
  }, [
    router,
    session?.accessToken,
    session?.isAnonymous,
    t.profile.authRequired,
    t.profile.premiumModal.popupBlocked,
    t.profile.subscription.checkoutError,
  ]);

  const handleOpenBillingPortal = useCallback(async () => {
    if (!session?.accessToken) {
      setUnsubscribeError(t.profile.authRequired);
      return;
    }

    setUnsubscribeStatus("opening");
    setUnsubscribeError(null);

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.message ?? t.profile.subscription.portalError);
      }

      const popup = window.open(data.url, "trailplanner-portal", "width=960,height=720,noopener,noreferrer");
      if (popup) {
        popup.focus();
        setUnsubscribeDialogOpen(false);
        return;
      }

      try {
        window.location.href = data.url;
        setUnsubscribeDialogOpen(false);
      } catch (fallbackError) {
        console.error("Unable to open billing portal in current tab", fallbackError);
        setUnsubscribeError(t.profile.premiumModal.popupBlocked);
      }
    } catch (error) {
      console.error("Unable to open billing portal", error);
      setUnsubscribeError(error instanceof Error ? error.message : t.profile.subscription.portalError);
    } finally {
      setUnsubscribeStatus("idle");
    }
  }, [
    session?.accessToken,
    t.profile.authRequired,
    t.profile.premiumModal.popupBlocked,
    t.profile.subscription.portalError,
  ]);

  const favoriteIds = useMemo(() => new Set(favoriteProducts.map((product) => product.id)), [favoriteProducts]);

  const handleFavoriteToggle = (product: FuelProduct) => {
    setSaveMessage(null);
    setSaveError(null);

    setFavoriteProducts((current) => {
      const exists = current.some((item) => item.id === product.id);
      if (exists) {
        return current.filter((item) => item.id !== product.id);
      }

      return [...current, product];
    });
  };

  const onSubmit = form.handleSubmit((values) => {
    if (!session?.accessToken) {
      setSaveError(t.profile.authRequired);
      return;
    }

    const hasFlatPaceMinutes = typeof values.comfortableFlatPaceMinutes === "number";
    const hasFlatPaceSeconds = typeof values.comfortableFlatPaceSeconds === "number";
    const comfortableFlatPaceTotal =
      (values.comfortableFlatPaceMinutes ?? 0) + (values.comfortableFlatPaceSeconds ?? 0) / 60;

    if (
      (hasFlatPaceSeconds && !hasFlatPaceMinutes) ||
      (typeof values.comfortableFlatPaceSeconds === "number" && values.comfortableFlatPaceSeconds > 59) ||
      ((hasFlatPaceMinutes || hasFlatPaceSeconds) && comfortableFlatPaceTotal <= 0)
    ) {
      setSaveError(t.profile.basics.comfortableFlatPaceInvalid);
      setSaveMessage(null);
      return;
    }

    setSaveMessage(null);
    setSaveError(null);
    saveProfileMutation.mutate(values);
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSearchQuery("");
  };

  const numberInput = (setValueAs: (value: unknown) => number | undefined) => ({ setValueAs });
  const optionalNumber = (value: unknown) => (value === "" || value === null ? undefined : Number(value));

  if (isLoading) return <PageLoadingSkeleton />;

  if (authMissing) {
    return (
      <AuthCard
        title={t.profile.title}
        description={t.profile.authRequired}
        footer={
          <>
            {t.auth.shared.noAccount} <AuthTextLink href="/sign-up">{t.auth.shared.createAccountLink}</AuthTextLink>
          </>
        }
      >
        <Link
          href="/sign-in"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-brand-foreground transition hover:bg-brand-light"
        >
          {t.auth.signIn.submit}
        </Link>
      </AuthCard>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <RunnerAdminAccessMode />
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{t.profile.eyebrow}</p>
        <h1 className="text-3xl font-bold leading-tight text-foreground">{t.profile.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.profile.description}</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <ProfileSection
          id="profile-subscription"
          title={t.profile.subscription.title}
          subtitle={subscriptionStatusLabel}
          action={
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => session?.accessToken && void refreshEntitlements(session.accessToken)}
              disabled={!session?.accessToken || isEntitlementsLoading}
            >
              {t.profile.subscription.refresh}
            </Button>
          }
        >
          {entitlements.isPremium ? (
            <span className="inline-flex w-fit items-center rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
              {t.profile.subscription.premiumStatus}
            </span>
          ) : null}

          {!entitlements.isPremium && trialActive && trialEndsAtLabel ? (
            <p className="text-sm text-muted-foreground">{trialEndsAtLabel}</p>
          ) : null}

          {premiumSourceLabel ? (
            <p className="text-sm text-muted-foreground">
              {t.profile.subscription.premiumSourceLabel}:{" "}
              <span className="font-semibold text-foreground">{premiumSourceLabel}</span>
            </p>
          ) : null}

          {premiumGrant ? (
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold text-foreground">{t.profile.subscription.premiumGrant.startsAt}</dt>
              <dd className="text-muted-foreground">{premiumGrantStartLabel ?? "—"}</dd>
              <dt className="font-semibold text-foreground">{t.profile.subscription.premiumGrant.initialDuration}</dt>
              <dd className="text-muted-foreground">{premiumGrant.initialDurationDays}</dd>
              <dt className="font-semibold text-foreground">{t.profile.subscription.premiumGrant.remainingDuration}</dt>
              <dd className="text-muted-foreground">{premiumGrant.remainingDurationDays}</dd>
            </dl>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {!entitlements.isPremium ? (
              <Button
                type="button"
                className="h-11 rounded-xl"
                onClick={() => {
                  if (isGuestSession) {
                    router.push("/sign-up");
                    return;
                  }

                  setUpgradeDialogOpen(true);
                }}
                disabled={isEntitlementsLoading || upgradeStatus === "opening"}
              >
                {isGuestSession ? t.auth.signUp.submit : t.profile.subscription.subscribeCta}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl text-pace-semantic-danger hover:border-pace-semantic-danger hover:bg-pace-semantic-dangerSurface"
                onClick={() => setUnsubscribeDialogOpen(true)}
                disabled={unsubscribeStatus === "opening"}
              >
                {t.profile.subscription.unsubscribeCta}
              </Button>
            )}
          </div>
        </ProfileSection>

        <ProfileSection id="profile-basics" title={t.profile.basics.title} subtitle={t.profile.basics.subtitle}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">{runnerProfileLabels.full_name}</Label>
              <Input id="fullName" autoComplete="name" placeholder={t.profile.basics.namePlaceholder} className={profileFieldClassName} {...form.register("fullName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">{runnerProfileLabels.birth_date}</Label>
              <Input id="birthDate" type="date" max={new Date().toISOString().slice(0, 10)} className={profileFieldClassName} {...form.register("birthDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heightCm">{runnerProfileLabels.height_cm} (cm)</Label>
              <Input id="heightCm" type="number" inputMode="numeric" min="100" max="250" step="1" placeholder="175" className={profileFieldClassName} {...form.register("heightCm", numberInput((value) => (value === "" ? undefined : Number(value))))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weightKg">{runnerProfileLabels.weight_kg} (kg)</Label>
              <Input id="weightKg" type="number" inputMode="decimal" min="20" max="250" step="0.1" placeholder="70" className={profileFieldClassName} {...form.register("weightKg", numberInput((value) => (value === "" ? undefined : Number(value))))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waterBagLiters">{runnerProfileLabels.water_bag_liters} (L)</Label>
              <Input id="waterBagLiters" type="number" inputMode="decimal" min="0" step="0.1" placeholder="1.5" className={profileFieldClassName} {...form.register("waterBagLiters", numberInput(optionalNumber))} />
              <p className="text-xs text-muted-foreground">{t.profile.basics.waterBagHelper}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="utmbIndex">{runnerProfileLabels.utmb_index}</Label>
              <Input id="utmbIndex" type="number" inputMode="numeric" min="0" step="1" placeholder="600" className={profileFieldClassName} {...form.register("utmbIndex", numberInput(optionalNumber))} />
              <p className="text-xs text-muted-foreground">{t.profile.basics.utmbIndexHelper}</p>
            </div>
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="text-sm font-medium text-foreground">{runnerProfileLabels.comfortable_flat_pace_min_per_km}</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="comfortableFlatPaceMinutes" className="text-xs text-muted-foreground">
                    {t.profile.basics.comfortableFlatPaceMinutesLabel}
                  </Label>
                  <Input id="comfortableFlatPaceMinutes" type="number" inputMode="numeric" min="0" step="1" placeholder="6" className={profileFieldClassName} {...form.register("comfortableFlatPaceMinutes", numberInput(optionalNumber))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="comfortableFlatPaceSeconds" className="text-xs text-muted-foreground">
                    {t.profile.basics.comfortableFlatPaceSecondsLabel}
                  </Label>
                  <Input id="comfortableFlatPaceSeconds" type="number" inputMode="numeric" min="0" max="59" step="1" placeholder="00" className={profileFieldClassName} {...form.register("comfortableFlatPaceSeconds", numberInput(optionalNumber))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t.profile.basics.comfortableFlatPaceHelper}</p>
            </fieldset>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="defaultCarbsGPerHour">{runnerProfileLabels.default_carbs_g_per_hour} (g/h)</Label>
              <Input id="defaultCarbsGPerHour" type="number" inputMode="numeric" min="0" max="200" step="1" placeholder="60" className={profileFieldClassName} {...form.register("defaultCarbsGPerHour", numberInput((value) => (value === "" ? undefined : Number(value))))} />
              <p className="text-xs text-muted-foreground">{t.profile.basics.carbsTargetHelper}</p>
            </div>
          </div>
        </ProfileSection>

        <ProfileSection
          id="profile-favorites"
          title={t.profile.favorites.title}
          subtitle={t.profile.favorites.subtitle}
          action={
            <>
              <span className="text-xs font-medium text-muted-foreground">
                {t.profile.favorites.selectedLabel}: {favoriteProducts.length}
              </span>
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => setIsDialogOpen(true)}>
                {t.profile.favorites.add}
              </Button>
            </>
          }
        >
          {profileQuery.isLoading ? <p className="text-sm text-muted-foreground">{t.productSettings.loading}</p> : null}
          {favoriteProducts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              {t.profile.favorites.empty}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {favoriteProducts.map((product) => (
                <li key={product.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words text-sm font-semibold text-foreground">{product.name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <FuelTypeBadge fuelType={product.fuelType} locale={locale} />
                      <span className="tabular-nums">
                        {t.racePlanner.sections.gels.nutrition
                          .replace("{carbs}", product.carbsGrams.toString())
                          .replace("{sodium}", product.sodiumMg.toString())}{" "}
                        · {product.caloriesKcal} kcal
                      </span>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" className="h-11 shrink-0 rounded-xl px-3 text-sm" onClick={() => handleFavoriteToggle(product)}>
                    {t.profile.favorites.remove}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {saveError ? <ProfileError>{saveError}</ProfileError> : null}
          {saveMessage ? <p role="status" className="text-sm font-medium text-brand">{saveMessage}</p> : null}
          <Button type="submit" className="h-12 rounded-xl px-6 text-base font-semibold" disabled={saveProfileMutation.isPending}>
            {saveProfileMutation.isPending ? t.profile.saving : t.profile.save}
          </Button>
        </div>
      </form>

      {isDialogOpen ? (
        <ProfileDialog
          titleId="favorites-dialog-title"
          title={t.profile.favorites.dialog.title}
          description={t.profile.favorites.subtitle}
          closeLabel={t.profile.favorites.dialog.close}
          onClose={closeDialog}
          widthClassName="sm:max-w-2xl"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Input
                type="search"
                aria-label={t.profile.favorites.dialog.searchPlaceholder}
                placeholder={t.profile.favorites.dialog.searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className={`${profileFieldClassName} flex-1`}
              />
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {t.profile.favorites.selectedLabel}: {favoriteProducts.length}
              </span>
            </div>
            {productsQuery.isLoading ? <p className="text-sm text-muted-foreground">{t.productSettings.loading}</p> : null}
            {productsQuery.error ? <ProfileError>{t.profile.error}</ProfileError> : null}
            {!productsQuery.isLoading && filteredProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.productSettings.empty}</p>
            ) : null}
            {filteredProducts.length > 0 ? (
              <ul className="divide-y divide-border">
                {filteredProducts.map((product) => {
                  const isSelected = favoriteIds.has(product.id);
                  return (
                    <li key={product.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-words text-sm font-semibold text-foreground">{product.name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <FuelTypeBadge fuelType={product.fuelType} locale={locale} />
                          <span className="tabular-nums">
                            {product.carbsGrams} g · {product.sodiumMg} mg · {product.caloriesKcal} kcal
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        aria-pressed={isSelected}
                        className="h-10 shrink-0 rounded-full px-4 text-sm"
                        onClick={() => handleFavoriteToggle(product)}
                      >
                        {isSelected ? t.profile.favorites.table.selected : t.profile.favorites.table.select}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </ProfileDialog>
      ) : null}

      {upgradeDialogOpen ? (
        <ProfileDialog
          titleId="upgrade-dialog-title"
          title={t.profile.premiumModal.title}
          description={t.profile.premiumModal.description}
          closeLabel={t.profile.premiumModal.cancel}
          onClose={() => {
            setUpgradeDialogOpen(false);
            setUpgradeError(null);
          }}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => {
                  setUpgradeDialogOpen(false);
                  setUpgradeError(null);
                }}
              >
                {t.profile.premiumModal.cancel}
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl"
                onClick={handleUpgrade}
                disabled={upgradeStatus === "opening" || annualPrice.status !== "available"}
              >
                {upgradeStatus === "opening" ? t.profile.subscription.loading : t.profile.premiumModal.subscribe}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm font-semibold text-brand">
              {t.profile.premiumModal.priceLabel}: {premiumPriceDisplay}
            </p>
            {annualPrice.status === "unavailable" ? (
              <p className="text-sm text-muted-foreground" role="status">
                {t.profile.premiumModal.unavailable}
              </p>
            ) : null}
            <div>
              <p className="text-sm font-semibold text-foreground">{t.profile.premiumModal.featuresTitle}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {t.profile.premiumModal.features.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 font-bold text-brand">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {upgradeError ? <ProfileError>{upgradeError}</ProfileError> : null}
          </div>
        </ProfileDialog>
      ) : null}

      {unsubscribeDialogOpen ? (
        <ProfileDialog
          role="alertdialog"
          titleId="unsubscribe-dialog-title"
          title={t.profile.subscription.unsubscribeConfirm.title}
          description={t.profile.subscription.unsubscribeConfirm.description}
          closeLabel={t.profile.subscription.unsubscribeConfirm.cancel}
          onClose={() => {
            setUnsubscribeDialogOpen(false);
            setUnsubscribeError(null);
          }}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => {
                  setUnsubscribeDialogOpen(false);
                  setUnsubscribeError(null);
                }}
              >
                {t.profile.subscription.unsubscribeConfirm.cancel}
              </Button>
              <Button type="button" className="h-11 rounded-xl" onClick={handleOpenBillingPortal} disabled={unsubscribeStatus === "opening"}>
                {unsubscribeStatus === "opening"
                  ? t.profile.subscription.loading
                  : t.profile.subscription.unsubscribeConfirm.confirm}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="space-y-2 rounded-xl border border-pace-semantic-warning/40 bg-pace-semantic-warningSurface px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{t.profile.subscription.unsubscribeConfirm.lossesTitle}</p>
              <ul className="space-y-1 text-sm text-foreground">
                {t.profile.premiumModal.features.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {unsubscribeError ? <ProfileError>{unsubscribeError}</ProfileError> : null}
          </div>
        </ProfileDialog>
      ) : null}
    </div>
  );
}
