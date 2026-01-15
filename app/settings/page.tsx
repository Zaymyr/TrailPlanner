"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { FuelTypeBadge, getFuelTypeLabel } from "../../components/products/FuelTypeBadge";
import { readStoredSession } from "../../lib/auth-storage";
import { defaultFuelType, fuelTypeSchema, fuelTypeValues } from "../../lib/fuel-types";
import { readLocalProducts, upsertLocalProduct } from "../../lib/local-products";
import { fuelProductSchema, type FuelProduct } from "../../lib/product-types";
import { fetchUserProfile, updateUserProfile } from "../../lib/profile-client";
import { mapProductToSelection } from "../../lib/product-preferences";
import { useProductSelection } from "../hooks/useProductSelection";
import { useI18n } from "../i18n-provider";

const productListSchema = z.object({ products: z.array(fuelProductSchema) });
const productDetailSchema = z.object({ product: fuelProductSchema });
const baseButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300";
const outlineButtonClass =
  "border border-border text-[hsl(var(--success))] hover:bg-muted hover:text-foreground dark:border-emerald-300 dark:text-emerald-100 dark:hover:bg-emerald-950/60";
const primaryButtonClass = "bg-emerald-400 text-slate-950 hover:bg-emerald-300";
const createLocalProductId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

function ProductIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 3v7a2 2 0 0 0 2 2h1V3" />
      <path d="M11 3v18" />
      <path d="M18 3c0 2-1 5-3 5h0c2 0 3 3 3 5v8" />
    </svg>
  );
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const [session, setSession] = useState(() => readStoredSession());
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const { selectedProducts, replaceSelection } = useProductSelection();
  const [filterQuery, setFilterQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof FuelProduct>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [warningDraft, setWarningDraft] = useState<{ values: ProductFormValues; zeroFields: string[] } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setSession(readStoredSession());
  }, []);

  const productFormSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t.racePlanner.validation.required),
        fuelType: fuelTypeSchema,
        carbsGrams: z.coerce.number().nonnegative({ message: t.productSettings.validation.nonNegative }),
        sodiumMg: z.coerce.number().nonnegative({ message: t.racePlanner.validation.nonNegative }),
        caloriesKcal: z.coerce.number().nonnegative({ message: t.racePlanner.validation.nonNegative }),
        proteinGrams: z.coerce.number().nonnegative({ message: t.racePlanner.validation.nonNegative }),
        fatGrams: z.coerce.number().nonnegative({ message: t.racePlanner.validation.nonNegative }),
        productUrl: z
          .string()
          .trim()
          .optional()
          .transform((value) => (value ? value : undefined))
          .pipe(z.string().url({ message: t.productSettings.validation.invalidUrl }).optional()),
      }),
    [
      t.productSettings.validation.invalidUrl,
      t.productSettings.validation.nonNegative,
      t.racePlanner.validation.nonNegative,
      t.racePlanner.validation.required,
    ]
  );

  type ProductFormValues = z.infer<typeof productFormSchema>;

  const fuelTypeOptions = useMemo(
    () =>
      fuelTypeValues.map((value) => ({
        value,
        label: getFuelTypeLabel(value, locale),
      })),
    [locale]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      fuelType: defaultFuelType,
      carbsGrams: 25,
      sodiumMg: 85,
      caloriesKcal: 100,
      proteinGrams: 0,
      fatGrams: 0,
      productUrl: "",
    },
  });

  const productsQuery = useQuery({
    queryKey: ["products", session?.accessToken ?? "local"],
    queryFn: async () => {
      const localProducts = readLocalProducts();

      const response = await fetch("/api/products", {
        headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        if (localProducts.length > 0) {
          return localProducts;
        }
        const message = (data as { message?: string } | null)?.message ?? t.productSettings.errors.loadFailed;
        throw new Error(message);
      }

      const parsed = productListSchema.safeParse(data);

      if (!parsed.success) {
        if (localProducts.length > 0) {
          return localProducts;
        }
        throw new Error(t.productSettings.errors.loadFailed);
      }

      const merged = new Map(parsed.data.products.map((product) => [product.id, product]));
      localProducts.forEach((product) => {
        if (!merged.has(product.id)) {
          merged.set(product.id, product);
        }
      });
      return Array.from(merged.values());
    },
  });

  const productLoadError =
    productsQuery.error instanceof Error
      ? productsQuery.error.message
      : productsQuery.error
        ? t.productSettings.errors.loadFailed
        : null;

  const profileQuery = useQuery({
    queryKey: ["profile", session?.accessToken],
    enabled: Boolean(session?.accessToken),
    queryFn: async () => {
      if (!session?.accessToken) {
        throw new Error(t.productSettings.errors.missingSession);
      }
      return fetchUserProfile(session.accessToken);
    },
    staleTime: 60_000,
    onSuccess: (profile) => {
      replaceSelection(profile.favoriteProducts.map((product) => mapProductToSelection(product)));
      queryClient.setQueryData(["profile", session?.accessToken], profile);
    },
  });

  const favoritesLoadError =
    profileQuery.error instanceof Error
      ? profileQuery.error.message
      : profileQuery.error
        ? t.productSettings.errors.loadFailed
        : null;

  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const createProductMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!session?.accessToken) {
        const slugBase = values.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "");
        const suffix = Math.random().toString(36).slice(2, 6);
        const product: FuelProduct = {
          id: createLocalProductId(),
          slug: slugBase ? `${slugBase}-${suffix}` : `product-${suffix}`,
          name: values.name,
          fuelType: values.fuelType,
          productUrl: values.productUrl ?? undefined,
          caloriesKcal: values.caloriesKcal,
          carbsGrams: values.carbsGrams,
          sodiumMg: values.sodiumMg,
          proteinGrams: values.proteinGrams,
          fatGrams: values.fatGrams,
          waterMl: 0,
        };

        upsertLocalProduct(product);
        return product;
      }

      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.productSettings.errors.createFailed;
        throw new Error(message);
      }

      const parsed = productDetailSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.productSettings.errors.createFailed);
      }

      return parsed.data.product;
    },
    onSuccess: (product) => {
      setFormError(null);
      setFormMessage(t.productSettings.success);
      if (!session?.accessToken) {
        queryClient.setQueryData(["products", "local"], (current) => {
          const list = Array.isArray(current) ? current : [];
          return [product, ...list.filter((item) => item.id !== product.id)];
        });
      } else {
        void productsQuery.refetch();
      }
      reset();
      handleToggle(product);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.productSettings.errors.createFailed;
      setFormError(message);
      setFormMessage(null);
    },
  });

  const updateFavoritesMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      if (!session?.accessToken) {
        throw new Error(t.productSettings.errors.missingSession);
      }

      return updateUserProfile(session.accessToken, { favoriteProductIds: productIds });
    },
    onSuccess: (profile) => {
      setSelectionError(null);
      replaceSelection(profile.favoriteProducts.map((product) => mapProductToSelection(product)));
      queryClient.setQueryData(["profile", session?.accessToken], profile);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.productSettings.errors.loadFailed;
      setSelectionError(message);
    },
  });

  const handleToggle = (product: FuelProduct) => {
    setSelectionError(null);
    const isSelected = selectedProducts.some((item) => item.id === product.id);

    const nextSelection = isSelected
      ? selectedProducts.filter((item) => item.id !== product.id)
      : [...selectedProducts, mapProductToSelection(product)];

    const previousSelection = selectedProducts;
    replaceSelection(nextSelection);

    if (session?.accessToken) {
      updateFavoritesMutation.mutate(nextSelection.map((item) => item.id), {
        onError: () => replaceSelection(previousSelection),
      });
    }
  };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setFormMessage(null);
    const zeroFields: string[] = [];
    if (values.carbsGrams === 0) zeroFields.push(t.productSettings.fields.carbs);
    if (values.caloriesKcal === 0) zeroFields.push(t.productSettings.fields.calories);
    if (values.proteinGrams === 0) zeroFields.push(t.productSettings.fields.protein);
    if (values.fatGrams === 0) zeroFields.push(t.productSettings.fields.fat);
    if (values.sodiumMg === 0) zeroFields.push(t.productSettings.fields.sodium);

    if (zeroFields.length > 0) {
      setWarningDraft({ values, zeroFields });
      return;
    }

    return createProductMutation.mutate(values);
  });

  const authMissing = !session?.accessToken;
  const productList = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = filterQuery.trim().toLowerCase();
    if (!normalizedQuery) return productList;
    return productList.filter((product) => product.name.toLowerCase().includes(normalizedQuery));
  }, [filterQuery, productList]);

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts].sort((a, b) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];

      if (typeof valueA === "string" && typeof valueB === "string") {
        return valueA.localeCompare(valueB, undefined, { sensitivity: "base" });
      }

      if (typeof valueA === "number" && typeof valueB === "number") {
        return valueA - valueB;
      }

      return 0;
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [filteredProducts, sortDirection, sortKey]);

  const handleSort = (key: keyof FuelProduct) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <div className="mx-auto flex w-full flex-col gap-6 rounded-2xl border border-border-strong bg-card p-6 text-foreground shadow-md shadow-emerald-900/20 dark:bg-slate-950/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.productSettings.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/race-planner"
            className={`${baseButtonClass} ${outlineButtonClass} border-emerald-300/50 dark:text-emerald-50 dark:hover:border-emerald-200`}
          >
            {t.productSettings.actions.openPlanner}
          </Link>
          {authMissing && (
            <Link href="/sign-in" className={`${baseButtonClass} ${primaryButtonClass}`}>
              {t.productSettings.signInCta}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">{t.productSettings.listTitle}</CardTitle>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={filterQuery}
                  onChange={(event) => setFilterQuery(event.target.value)}
                  placeholder={t.productSettings.filters.searchPlaceholder}
                  className="w-full sm:w-64"
                />
                <Button
                  variant="outline"
                  onClick={() => productsQuery.refetch()}
                  disabled={productsQuery.status === "pending"}
                >
                  {t.productSettings.actions.refresh}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {authMissing && (
              <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-700 dark:text-amber-200">
                {t.productSettings.localNotice}
              </p>
            )}

            {selectionError && <p className="text-sm text-red-600 dark:text-red-300">{selectionError}</p>}

            {favoritesLoadError && <p className="text-sm text-red-600 dark:text-red-300">{favoritesLoadError}</p>}

            {productsQuery.isLoading && <p className="text-sm text-muted-foreground">{t.productSettings.loading}</p>}

            {productLoadError && <p className="text-sm text-red-600 dark:text-red-300">{productLoadError}</p>}

            {!productsQuery.isLoading && sortedProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">{t.productSettings.empty}</p>
            )}

            {sortedProducts.length > 0 && (
              <Table containerClassName="max-h-[520px] overflow-y-auto">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-24 text-center">
                      <div className="flex items-center justify-center gap-2 text-[hsl(var(--success))]">
                        <ProductIcon className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {t.productSettings.fields.productUrl}
                        </span>
                      </div>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={() => handleSort("name")}
                      >
                        {t.productSettings.fields.name}
                        {sortKey === "name" ? (sortDirection === "asc" ? "↑" : "↓") : null}
                      </button>
                    </TableHead>
                    <TableHead>{t.productSettings.fields.fuelType}</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={() => handleSort("carbsGrams")}
                      >
                        {t.productSettings.fields.carbs}
                        {sortKey === "carbsGrams" ? (sortDirection === "asc" ? "↑" : "↓") : null}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={() => handleSort("sodiumMg")}
                      >
                        {t.productSettings.fields.sodium}
                        {sortKey === "sodiumMg" ? (sortDirection === "asc" ? "↑" : "↓") : null}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={() => handleSort("caloriesKcal")}
                      >
                        {t.productSettings.fields.calories}
                        {sortKey === "caloriesKcal" ? (sortDirection === "asc" ? "↑" : "↓") : null}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={() => handleSort("proteinGrams")}
                      >
                        {t.productSettings.fields.protein}
                        {sortKey === "proteinGrams" ? (sortDirection === "asc" ? "↑" : "↓") : null}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={() => handleSort("fatGrams")}
                      >
                        {t.productSettings.fields.fat}
                        {sortKey === "fatGrams" ? (sortDirection === "asc" ? "↑" : "↓") : null}
                      </button>
                    </TableHead>
                    <TableHead className="text-center">{t.productSettings.actions.select}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProducts.map((product) => {
                    const isSelected = selectedProducts.some((item) => item.id === product.id);
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="text-center text-[hsl(var(--success))]">
                          {product.productUrl ? (
                            <a
                              href={product.productUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center justify-center rounded-full p-2 hover:bg-emerald-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                              aria-label={t.productSettings.fields.productUrl}
                              title={t.productSettings.fields.productUrl}
                            >
                              <ProductIcon className="h-4 w-4" />
                              <span className="sr-only">{t.productSettings.fields.productUrl}</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center justify-center rounded-full bg-muted p-2 text-muted-foreground">
                              <ProductIcon className="h-4 w-4" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          <div className="flex flex-col gap-1">
                            <span>{product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <FuelTypeBadge fuelType={product.fuelType} locale={locale} />
                        </TableCell>
                        <TableCell>{product.carbsGrams} g</TableCell>
                        <TableCell>{product.sodiumMg} mg</TableCell>
                        <TableCell>{product.caloriesKcal}</TableCell>
                        <TableCell>{product.proteinGrams} g</TableCell>
                        <TableCell>{product.fatGrams} g</TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(product)}
                            aria-pressed={isSelected}
                            aria-label={
                              isSelected ? t.productSettings.actions.deselect : t.productSettings.actions.select
                            }
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/70 transition ${
                              isSelected
                                ? "bg-amber-300/30 text-amber-600 hover:bg-amber-300/40 dark:text-amber-300"
                                : "bg-transparent text-amber-600 hover:bg-amber-200/40 dark:text-amber-200 dark:hover:bg-amber-300/10"
                            } disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300`}
                          >
                            <StarIcon filled={isSelected} className="h-4 w-4" />
                            <span className="sr-only">
                              {isSelected ? t.productSettings.actions.deselect : t.productSettings.actions.select}
                            </span>
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t.productSettings.formTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">{t.productSettings.formDescription}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.productSettings.fields.name}</Label>
                <Input id="name" placeholder="Gel, boisson, barre..." {...register("name")} disabled={authMissing} />
                {errors.name && <p className="text-sm text-red-600 dark:text-red-300">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuelType">{t.productSettings.fields.fuelType}</Label>
                <select
                  id="fuelType"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  {...register("fuelType")}
                  disabled={authMissing}
                >
                  {fuelTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.fuelType && (
                  <p className="text-sm text-red-600 dark:text-red-300">{errors.fuelType.message}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="carbsGrams">{t.productSettings.fields.carbs}</Label>
                  <Input
                    id="carbsGrams"
                    type="number"
                    step="1"
                    min="0"
                    {...register("carbsGrams")}
                    disabled={authMissing}
                  />
                  {errors.carbsGrams && (
                    <p className="text-sm text-red-600 dark:text-red-300">{errors.carbsGrams.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sodiumMg">{t.productSettings.fields.sodium}</Label>
                  <Input
                    id="sodiumMg"
                    type="number"
                    step="1"
                    min="0"
                    {...register("sodiumMg")}
                    disabled={authMissing}
                  />
                  {errors.sodiumMg && (
                    <p className="text-sm text-red-600 dark:text-red-300">{errors.sodiumMg.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="caloriesKcal">{t.productSettings.fields.calories}</Label>
                  <Input
                    id="caloriesKcal"
                    type="number"
                    step="1"
                    min="0"
                    {...register("caloriesKcal")}
                    disabled={authMissing}
                  />
                  {errors.caloriesKcal && (
                    <p className="text-sm text-red-600 dark:text-red-300">{errors.caloriesKcal.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proteinGrams">{t.productSettings.fields.protein}</Label>
                  <Input
                    id="proteinGrams"
                    type="number"
                    step="0.1"
                    min="0"
                    {...register("proteinGrams")}
                    disabled={authMissing}
                  />
                  {errors.proteinGrams && (
                    <p className="text-sm text-red-600 dark:text-red-300">{errors.proteinGrams.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fatGrams">{t.productSettings.fields.fat}</Label>
                  <Input
                    id="fatGrams"
                    type="number"
                    step="0.1"
                    min="0"
                    {...register("fatGrams")}
                    disabled={authMissing}
                  />
                  {errors.fatGrams && (
                    <p className="text-sm text-red-600 dark:text-red-300">{errors.fatGrams.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productUrl">{t.productSettings.fields.productUrl}</Label>
                <Input
                  id="productUrl"
                  placeholder="https://example.com/produit"
                  {...register("productUrl")}
                  disabled={authMissing}
                  inputMode="url"
                />
                {errors.productUrl && (
                  <p className="text-sm text-red-600 dark:text-red-300">{errors.productUrl.message}</p>
                )}
              </div>

              {formError && <p className="text-sm text-red-600 dark:text-red-300">{formError}</p>}
              {formMessage && <p className="text-sm text-[hsl(var(--success))]">{formMessage}</p>}

              <Button
                type="submit"
                className="w-full justify-center"
                disabled={authMissing || createProductMutation.isPending}
              >
                {createProductMutation.isPending ? t.productSettings.submitting : t.productSettings.submit}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {warningDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-amber-500/40 bg-card p-6 text-foreground shadow-2xl dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-foreground">{t.productSettings.warning.title}</h2>
            <p className="text-sm text-muted-foreground">{t.productSettings.warning.description}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-200">
              {warningDraft.zeroFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setWarningDraft(null)}>
                {t.productSettings.warning.back}
              </Button>
              <Button
                onClick={() => {
                  if (warningDraft) {
                    createProductMutation.mutate(warningDraft.values);
                    setWarningDraft(null);
                  }
                }}
                disabled={createProductMutation.isPending}
              >
                {t.productSettings.warning.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
