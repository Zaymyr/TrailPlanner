"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { FuelTypeBadge } from "../../components/products/FuelTypeBadge";
import { fetchUserProfile, updateUserProfile } from "../../lib/profile-client";
import { mapProductToSelection } from "../../lib/product-preferences";
import { fuelProductSchema, type FuelProduct } from "../../lib/product-types";
import { fetchEntitlements } from "../../lib/entitlements-client";
import { fetchTrialStatus } from "../../lib/trial-client";
import { isTrialActive } from "../../lib/trial";
import { useProductSelection } from "../hooks/useProductSelection";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { useI18n } from "../i18n-provider";
import type { Locale } from "../../locales/types";

type StripeInterval = "day" | "week" | "month" | "year";

const stripePriceResponseSchema = z.object({
  price: z.object({
    currency: z.string().min(1),
    unitAmount: z.number().nonnegative(),
    interval: z.enum(["day", "week", "month", "year"]).nullable(),
    intervalCount: z.number().int().positive().nullable().optional().default(null),
  }),
});

const intervalLabels: Record<Locale, Record<StripeInterval, { singular: string; plural: string }>> = {
  en: {
    day: { singular: "day", plural: "days" },
    week: { singular: "week", plural: "weeks" },
    month: { singular: "month", plural: "months" },
    year: { singular: "year", plural: "years" },
  },
  fr: {
    day: { singular: "jour", plural: "jours" },
    week: { singular: "semaine", plural: "semaines" },
    month: { singular: "mois", plural: "mois" },
    year: { singular: "an", plural: "ans" },
  },
};

const formatIntervalLabel = (interval: StripeInterval | null, count: number | null, locale: Locale) => {
  if (!interval) return "";

  const label = intervalLabels[locale]?.[interval];
  if (!label) return "";

  if (!count || count === 1) return label.singular;
  return label.plural;
};

const profileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  age: z
    .union([z.coerce.number().int().min(0).max(120), z.literal("").transform(() => undefined)])
    .optional(),
  waterBagLiters: z
    .union([z.coerce.number().min(0).max(20), z.literal("").transform(() => undefined)])
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const productListSchema = z.object({ products: z.array(fuelProductSchema) });

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const { session, isLoading: isSessionLoading } = useVerifiedSession();
  const { replaceSelection } = useProductSelection();
  const [favoriteProducts, setFavoriteProducts] = useState<FuelProduct[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "opening">("idle");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [stripePrice, setStripePrice] = useState<z.infer<typeof stripePriceResponseSchema>["price"] | null>(null);
  const [unsubscribeDialogOpen, setUnsubscribeDialogOpen] = useState(false);
  const [unsubscribeStatus, setUnsubscribeStatus] = useState<"idle" | "opening">("idle");
  const [unsubscribeError, setUnsubscribeError] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: "",
      age: undefined,
      waterBagLiters: undefined,
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
      form.reset({
        fullName: profile.fullName ?? "",
        age: profile.age ?? undefined,
        waterBagLiters: profile.waterBagLiters ?? undefined,
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

  const entitlementsQuery = useQuery({
    queryKey: ["entitlements", session?.accessToken],
    enabled: Boolean(session?.accessToken),
    queryFn: async () => {
      if (!session?.accessToken) {
        throw new Error(t.profile.authRequired);
      }
      return fetchEntitlements(session.accessToken);
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
        age: typeof values.age === "number" ? values.age : null,
        waterBagLiters: typeof values.waterBagLiters === "number" ? values.waterBagLiters : null,
        favoriteProductIds: favoriteProducts.map((product) => product.id),
      });
    },
    onSuccess: (profile) => {
      setSaveMessage(t.profile.success);
      setSaveError(null);
      setFavoriteProducts(profile.favoriteProducts);
      replaceSelection(profile.favoriteProducts.map((product) => mapProductToSelection(product)));
      form.reset({
        fullName: profile.fullName ?? "",
        age: profile.age ?? undefined,
        waterBagLiters: profile.waterBagLiters ?? undefined,
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

  useEffect(() => {
    const abortController = new AbortController();

    const loadStripePrice = async () => {
      try {
        const response = await fetch("/api/stripe/price", {
          cache: "no-store",
          signal: abortController.signal,
        });

        const data = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          const message = (data as { message?: string } | null)?.message ?? t.profile.subscription.checkoutError;
          throw new Error(message);
        }

        const parsed = stripePriceResponseSchema.safeParse(data);

        if (!parsed.success) {
          throw new Error("Invalid Stripe price response.");
        }

        if (!abortController.signal.aborted) {
          setStripePrice({
            ...parsed.data.price,
            intervalCount: parsed.data.price.intervalCount ?? null,
          });
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error("Unable to load subscription price", error);
        setStripePrice(null);
      }
    };

    void loadStripePrice();

    return () => abortController.abort();
  }, [t.profile.subscription.checkoutError]);

  const formattedPremiumPrice = useMemo(() => {
    if (!stripePrice) return null;

    try {
      const formatter = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
        style: "currency",
        currency: stripePrice.currency,
      });

      const intervalLabel = formatIntervalLabel(stripePrice.interval, stripePrice.intervalCount, locale);
      const amount = formatter.format(stripePrice.unitAmount / 100);

      return intervalLabel ? `${amount}/${intervalLabel}` : amount;
    } catch (error) {
      console.error("Unable to format premium price", error);
      return null;
    }
  }, [locale, stripePrice]);

  const premiumPriceDisplay = useMemo(
    () => formattedPremiumPrice ?? t.profile.premiumModal.priceValue,
    [formattedPremiumPrice, t.profile.premiumModal.priceValue]
  );

  const trialEndsAt = trialStatusQuery.data?.trialEndsAt ?? null;
  const trialActive = useMemo(() => isTrialActive(trialEndsAt), [trialEndsAt]);
  const trialEndsAtLabel = useMemo(() => {
    if (!trialActive || !trialEndsAt) return null;
    const formatted = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(trialEndsAt));
    return t.profile.subscription.trialEndsAt.replace("{date}", formatted);
  }, [locale, t.profile.subscription.trialEndsAt, trialActive, trialEndsAt]);

  const subscriptionStatusLabel = useMemo(() => {
    if (entitlementsQuery.isLoading) return t.profile.subscription.loading;
    if (entitlementsQuery.isError) return t.profile.subscription.error;
    if (entitlementsQuery.data?.isPremium) return t.profile.subscription.premiumStatus;
    if (trialActive) return t.profile.subscription.trialStatus;
    return t.profile.subscription.freeStatus;
  }, [
    entitlementsQuery.data?.isPremium,
    entitlementsQuery.isError,
    entitlementsQuery.isLoading,
    t.profile.subscription.error,
    t.profile.subscription.freeStatus,
    t.profile.subscription.loading,
    t.profile.subscription.premiumStatus,
    t.profile.subscription.trialStatus,
    trialActive,
  ]);

  const handleUpgrade = useCallback(async () => {
    if (!session?.accessToken) {
      setUpgradeError(t.profile.authRequired);
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
    session?.accessToken,
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

    setSaveMessage(null);
    setSaveError(null);
    saveProfileMutation.mutate(values);
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSearchQuery("");
  };

  const dialogContent = (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-background/80 px-4 py-10 backdrop-blur">
      <div className="w-full max-w-5xl space-y-4 rounded-lg border border-emerald-300/30 bg-card p-4 text-foreground shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{t.profile.favorites.dialog.title}</p>
            <p className="text-sm text-muted-foreground">{t.profile.favorites.subtitle}</p>
          </div>
          <Button type="button" variant="ghost" onClick={closeDialog}>
            {t.profile.favorites.dialog.close}
          </Button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder={t.profile.favorites.dialog.searchPlaceholder}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full sm:w-80"
          />
          <p className="text-xs text-muted-foreground">
            {t.profile.favorites.selectedLabel}: {favoriteProducts.length}
          </p>
        </div>

        {productsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t.productSettings.loading}</p>
        ) : null}

        {productsQuery.error ? (
          <p className="text-sm text-red-600 dark:text-red-300">{t.profile.error}</p>
        ) : null}

        {!productsQuery.isLoading && filteredProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.productSettings.empty}</p>
        ) : null}

        {filteredProducts.length > 0 ? (
          <Table containerClassName="max-h-[420px] overflow-y-auto">
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>{t.profile.favorites.table.name}</TableHead>
                <TableHead>{t.profile.favorites.table.type}</TableHead>
                <TableHead>{t.profile.favorites.table.carbs}</TableHead>
                <TableHead>{t.profile.favorites.table.sodium}</TableHead>
                <TableHead>{t.profile.favorites.table.calories}</TableHead>
                <TableHead className="text-center">{t.profile.favorites.table.select}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const isSelected = favoriteIds.has(product.id);
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-semibold text-foreground">{product.name}</TableCell>
                    <TableCell>
                      <FuelTypeBadge fuelType={product.fuelType} locale={locale} />
                    </TableCell>
                    <TableCell>{product.carbsGrams} g</TableCell>
                    <TableCell>{product.sodiumMg} mg</TableCell>
                    <TableCell>{product.caloriesKcal}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className="h-8 px-3 text-xs"
                        onClick={() => handleFavoriteToggle(product)}
                      >
                        {isSelected ? t.profile.favorites.table.selected : t.profile.favorites.table.select}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Pace Yourself</p>
        <h2 className="text-2xl font-semibold text-foreground">{t.profile.title}</h2>
        <p className="text-sm text-muted-foreground">{t.profile.description}</p>
      </div>

      {!isSessionLoading && authMissing ? (
        <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-700 dark:text-amber-200">
          {t.profile.authRequired}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">{t.profile.subscription.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{subscriptionStatusLabel}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => entitlementsQuery.refetch()}
              disabled={!session?.accessToken || entitlementsQuery.isLoading}
            >
              {t.profile.subscription.refresh}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!session?.accessToken ? (
              <p className="text-sm text-muted-foreground">{t.profile.authRequired}</p>
            ) : entitlementsQuery.data ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-3 py-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                    entitlementsQuery.data.isPremium
                      ? "border border-emerald-300/70 bg-emerald-300/20 text-emerald-700 dark:text-emerald-100"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  {entitlementsQuery.data.isPremium ? t.profile.subscription.premiumStatus : subscriptionStatusLabel}
                </span>
                <p className="text-sm text-muted-foreground">{subscriptionStatusLabel}</p>
              </div>
            ) : null}

            {!entitlementsQuery.data?.isPremium && trialActive && trialEndsAtLabel ? (
              <p className="text-xs text-muted-foreground">{trialEndsAtLabel}</p>
            ) : null}

            {session?.accessToken ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => setUpgradeDialogOpen(true)}
                  disabled={entitlementsQuery.isLoading || entitlementsQuery.data?.isPremium || upgradeStatus === "opening"}
                >
                  {t.profile.subscription.subscribeCta}
                </Button>
                {entitlementsQuery.data?.isPremium ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 dark:text-red-100 dark:hover:bg-red-950/60"
                    onClick={() => setUnsubscribeDialogOpen(true)}
                    disabled={unsubscribeStatus === "opening"}
                  >
                    {t.profile.subscription.unsubscribeCta}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.profile.basics.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{t.profile.basics.subtitle}</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t.profile.basics.nameLabel}</Label>
              <Input
                id="fullName"
                placeholder={t.profile.basics.namePlaceholder}
                disabled={authMissing}
                {...form.register("fullName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">{t.profile.basics.ageLabel}</Label>
              <Input
                id="age"
                type="number"
                min="0"
                max="120"
                placeholder={t.profile.basics.agePlaceholder}
                disabled={authMissing}
                {...form.register("age", {
                  setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="waterBagLiters">{t.profile.basics.waterBagLabel}</Label>
              <Input
                id="waterBagLiters"
                type="number"
                min="0"
                step="0.1"
                placeholder="1.5"
                disabled={authMissing}
                {...form.register("waterBagLiters", {
                  setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                })}
              />
              <p className="text-xs text-muted-foreground">{t.profile.basics.waterBagHelper}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">{t.profile.favorites.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{t.profile.favorites.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {t.profile.favorites.selectedLabel}: {favoriteProducts.length}
              </p>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(true)} disabled={authMissing}>
                {t.profile.favorites.add}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {profileQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t.productSettings.loading}</p>
            ) : null}
            {favoriteProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.profile.favorites.empty}</p>
            ) : (
              <div className="space-y-2">
                {favoriteProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{product.name}</p>
                        <FuelTypeBadge fuelType={product.fuelType} locale={locale} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.racePlanner.sections.gels.nutrition
                          .replace("{carbs}", product.carbsGrams.toString())
                          .replace("{sodium}", product.sodiumMg.toString())}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {t.profile.favorites.table.calories}: {product.caloriesKcal}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-3 text-xs"
                        onClick={() => handleFavoriteToggle(product)}
                        disabled={authMissing}
                      >
                        {t.profile.favorites.remove}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {saveError ? <p className="text-sm text-red-600 dark:text-red-300">{saveError}</p> : null}
        {saveMessage ? <p className="text-sm text-[hsl(var(--success))]">{saveMessage}</p> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={authMissing || saveProfileMutation.isPending}>
            {saveProfileMutation.isPending ? t.profile.saving : t.profile.save}
          </Button>
        </div>
      </form>

      {isDialogOpen ? dialogContent : null}

      {upgradeDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur">
          <div className="relative w-full max-w-xl space-y-4 rounded-lg border border-emerald-300/30 bg-card p-6 text-foreground shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{t.profile.premiumModal.title}</p>
                <p className="text-sm text-muted-foreground">{t.profile.premiumModal.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setUpgradeDialogOpen(false);
                  setUpgradeError(null);
                }}
              >
                {t.profile.premiumModal.cancel}
              </Button>
            </div>

            <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-50">
              <p className="font-semibold">
                {t.profile.premiumModal.priceLabel}: {premiumPriceDisplay}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">{t.profile.premiumModal.featuresTitle}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {t.profile.premiumModal.features.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden className="mt-[2px] text-emerald-500 dark:text-emerald-300">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {upgradeError ? <p className="text-sm text-red-600 dark:text-red-300">{upgradeError}</p> : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUpgradeDialogOpen(false);
                  setUpgradeError(null);
                }}
              >
                {t.profile.premiumModal.cancel}
              </Button>
              <Button type="button" onClick={handleUpgrade} disabled={upgradeStatus === "opening"}>
                {upgradeStatus === "opening" ? t.profile.subscription.loading : t.profile.premiumModal.subscribe}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {unsubscribeDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-6 text-foreground shadow-2xl dark:bg-slate-950">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">{t.profile.subscription.unsubscribeConfirm.title}</p>
              <p className="text-sm text-muted-foreground">{t.profile.subscription.unsubscribeConfirm.description}</p>
            </div>

            <div className="space-y-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-100">
                {t.profile.subscription.unsubscribeConfirm.lossesTitle}
              </p>
              <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-50">
                {t.profile.premiumModal.features.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden className="mt-[2px] text-amber-500 dark:text-amber-200">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {unsubscribeError ? <p className="text-sm text-red-600 dark:text-red-300">{unsubscribeError}</p> : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUnsubscribeDialogOpen(false);
                  setUnsubscribeError(null);
                }}
              >
                {t.profile.subscription.unsubscribeConfirm.cancel}
              </Button>
              <Button type="button" onClick={handleOpenBillingPortal} disabled={unsubscribeStatus === "opening"}>
                {unsubscribeStatus === "opening"
                  ? t.profile.subscription.loading
                  : t.profile.subscription.unsubscribeConfirm.confirm}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
