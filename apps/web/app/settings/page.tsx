"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { FuelTypeBadge, getFuelTypeLabel } from "../../components/products/FuelTypeBadge";
import { isVerifiedProduct, VerifiedProductBadge } from "../../components/products/VerifiedProductBadge";
import { readStoredSession } from "../../lib/auth-storage";
import { defaultEntitlements, fetchEntitlements } from "../../lib/entitlements-client";
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
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const outlineButtonClass = "border border-border bg-card text-brand hover:border-brand-border hover:bg-brand-surface";
const primaryButtonClass = "bg-brand text-brand-foreground hover:bg-brand-light";
/** 16 px text on phones (no iOS zoom), 44 px touch height. */
const fieldClassName = "h-11 rounded-xl text-base sm:text-sm";
/** Products rendered per step; the shared catalog holds hundreds of entries. */
const PRODUCT_PAGE_SIZE = 24;
const createLocalProductId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

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
  const [entitlements, setEntitlements] = useState(defaultEntitlements);
  const { selectedProducts, replaceSelection } = useProductSelection();
  const [filterQuery, setFilterQuery] = useState("");
  const [showMyProducts, setShowMyProducts] = useState(false);
  const [sortKey, setSortKey] = useState<keyof FuelProduct>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [visibleCount, setVisibleCount] = useState(PRODUCT_PAGE_SIZE);
  const [warningDraft, setWarningDraft] = useState<{ values: ProductFormValues; zeroFields: string[] } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setSession(readStoredSession());
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    const abortController = new AbortController();
    fetchEntitlements(session.accessToken, abortController.signal)
      .then(setEntitlements)
      .catch(() => {});
    return () => abortController.abort();
  }, [session?.accessToken]);

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

  const localProductIds = useMemo(
    () => new Set(readLocalProducts().map((p) => p.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productsQuery.data]
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = filterQuery.trim().toLowerCase();
    return productList.filter((product) => {
      const matchesSearch = !normalizedQuery || product.name.toLowerCase().includes(normalizedQuery);
      const matchesOwnership =
        !showMyProducts ||
        selectedProducts.some((s) => s.id === product.id) ||
        localProductIds.has(product.id);
      return matchesSearch && matchesOwnership;
    });
  }, [filterQuery, localProductIds, productList, selectedProducts, showMyProducts]);

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

  // Back to the first page whenever the list itself changes (search, ownership filter, sort).
  useEffect(() => {
    setVisibleCount(PRODUCT_PAGE_SIZE);
  }, [filterQuery, showMyProducts, sortKey, sortDirection]);

  const handleSort = (key: keyof FuelProduct) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const visibleProducts = sortedProducts.slice(0, visibleCount);
  const remainingCount = sortedProducts.length - visibleProducts.length;

  const sortHeader = (key: keyof FuelProduct, label: string) => (
    <button type="button" className="flex items-center gap-1 font-semibold" onClick={() => handleSort(key)}>
      {label}
      {sortKey === key ? <span aria-hidden>{sortDirection === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );

  const numberField = (id: "carbsGrams" | "sodiumMg" | "caloriesKcal" | "proteinGrams" | "fatGrams", label: string, step: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" step={step} min="0" className={fieldClassName} {...register(id)} disabled={authMissing} />
      {errors[id] && <FieldError>{errors[id]?.message}</FieldError>}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{t.productSettings.eyebrow}</p>
          <h1 className="text-3xl font-bold leading-tight text-foreground">{t.productSettings.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{t.productSettings.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/race-planner" className={`${baseButtonClass} ${outlineButtonClass}`}>
            {t.productSettings.actions.openPlanner}
          </Link>
          {authMissing && (
            <Link href="/sign-in" className={`${baseButtonClass} ${primaryButtonClass}`}>
              {t.productSettings.signInCta}
            </Link>
          )}
        </div>
      </header>

      {authMissing && (
        <p className="rounded-xl border border-pace-semantic-warning/40 bg-pace-semantic-warningSurface px-4 py-3 text-sm text-foreground">
          {t.productSettings.localNotice}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="product-list-title" className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="product-list-title" className="text-lg font-bold text-foreground">{t.productSettings.listTitle}</h2>
              <p className="text-xs font-medium text-muted-foreground">
                {t.productSettings.favoritesCount.replace("{count}", String(selectedProducts.length))}
              </p>
            </div>
            <div className="flex gap-2">
              <Label htmlFor="product-filter" className="sr-only">
                {t.productSettings.filters.searchPlaceholder}
              </Label>
              <Input
                id="product-filter"
                type="search"
                value={filterQuery}
                onChange={(event) => setFilterQuery(event.target.value)}
                placeholder={t.productSettings.filters.searchPlaceholder}
                className={`${fieldClassName} flex-1`}
              />
              <Button
                variant="outline"
                className="h-11 shrink-0 rounded-xl"
                onClick={() => productsQuery.refetch()}
                disabled={productsQuery.status === "pending"}
              >
                {t.productSettings.actions.refresh}
              </Button>
            </div>
            <div className="flex gap-2" role="group" aria-label={t.productSettings.listTitle}>
              {([false, true] as const).map((mine) => {
                const active = showMyProducts === mine;
                return (
                  <button
                    key={String(mine)}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setShowMyProducts(mine)}
                    className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border bg-background text-foreground hover:border-brand hover:text-brand"
                    }`}
                  >
                    {mine ? t.productSettings.filters.mine : t.productSettings.filters.all}
                  </button>
                );
              })}
            </div>
          </div>

          {selectionError && <FieldError>{selectionError}</FieldError>}
          {favoritesLoadError && <FieldError>{favoritesLoadError}</FieldError>}
          {productLoadError && <FieldError>{productLoadError}</FieldError>}
          {productsQuery.isLoading && <p className="text-sm text-muted-foreground">{t.productSettings.loading}</p>}
          {!productsQuery.isLoading && sortedProducts.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              {t.productSettings.empty}
            </p>
          )}

          {visibleProducts.length > 0 && (
            <ul className="divide-y divide-border sm:hidden">
              {visibleProducts.map((product) => {
                const isSelected = selectedProducts.some((item) => item.id === product.id);
                return (
                  <li key={product.id} className="flex items-center gap-3 py-3">
                    <ProductThumb product={product} locale={locale} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-snug text-foreground">{product.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <FuelTypeBadge fuelType={product.fuelType} locale={locale} />
                        <span className="tabular-nums">
                          {product.carbsGrams} g · {product.sodiumMg} mg Na · {product.caloriesKcal} kcal
                        </span>
                      </div>
                    </div>
                    <FavoriteButton
                      selected={isSelected}
                      label={isSelected ? t.productSettings.actions.deselect : t.productSettings.actions.select}
                      onClick={() => handleToggle(product)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {visibleProducts.length > 0 && (
            <Table containerClassName="hidden rounded-xl sm:block">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">{t.productSettings.actions.favoriteColumn}</TableHead>
                  <TableHead>{sortHeader("name", t.productSettings.fields.name)}</TableHead>
                  <TableHead>{sortHeader("carbsGrams", t.productSettings.fields.carbs)}</TableHead>
                  <TableHead>{sortHeader("sodiumMg", t.productSettings.fields.sodium)}</TableHead>
                  <TableHead>{sortHeader("caloriesKcal", t.productSettings.fields.calories)}</TableHead>
                  <TableHead>{sortHeader("proteinGrams", t.productSettings.fields.protein)}</TableHead>
                  <TableHead>{sortHeader("fatGrams", t.productSettings.fields.fat)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProducts.map((product) => {
                  const isSelected = selectedProducts.some((item) => item.id === product.id);
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="text-center">
                        <FavoriteButton
                          selected={isSelected}
                          label={isSelected ? t.productSettings.actions.deselect : t.productSettings.actions.select}
                          onClick={() => handleToggle(product)}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex min-w-[180px] items-center gap-3">
                          <ProductThumb product={product} locale={locale} />
                          <div className="min-w-0 space-y-1">
                            {product.productUrl ? (
                              <a href={product.productUrl} target="_blank" rel="noreferrer noopener" className="block text-brand hover:underline">
                                {product.name}
                              </a>
                            ) : (
                              <span className="block">{product.name}</span>
                            )}
                            <FuelTypeBadge fuelType={product.fuelType} locale={locale} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{product.carbsGrams} g</TableCell>
                      <TableCell className="tabular-nums">{product.sodiumMg} mg</TableCell>
                      <TableCell className="tabular-nums">{product.caloriesKcal}</TableCell>
                      <TableCell className="tabular-nums">{product.proteinGrams} g</TableCell>
                      <TableCell className="tabular-nums">{product.fatGrams} g</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {remainingCount > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={() => setVisibleCount((count) => count + PRODUCT_PAGE_SIZE)}
            >
              {t.productSettings.showMore.replace("{count}", String(remainingCount))}
            </Button>
          )}
        </section>

        <section aria-labelledby="product-form-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:sticky lg:top-6">
          <div className="space-y-1">
            <h2 id="product-form-title" className="text-lg font-bold text-foreground">{t.productSettings.formTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.productSettings.formDescription}</p>
          </div>
          {authMissing && (
            <p className="text-sm text-muted-foreground">
              {t.productSettings.formSignInHint}{" "}
              <Link href="/sign-in" className="font-semibold text-brand underline-offset-4 hover:underline">
                {t.productSettings.signInCta}
              </Link>
            </p>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.productSettings.fields.name}</Label>
              <Input id="name" placeholder={t.productSettings.namePlaceholder} className={fieldClassName} {...register("name")} disabled={authMissing} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fuelType">{t.productSettings.fields.fuelType}</Label>
              <select
                id="fuelType"
                className={`w-full border border-border bg-card px-3 text-foreground shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${fieldClassName}`}
                {...register("fuelType")}
                disabled={authMissing}
              >
                {fuelTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.fuelType && <FieldError>{errors.fuelType.message}</FieldError>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {numberField("carbsGrams", t.productSettings.fields.carbs, "1")}
              {numberField("sodiumMg", t.productSettings.fields.sodium, "1")}
              {numberField("caloriesKcal", t.productSettings.fields.calories, "1")}
              {numberField("proteinGrams", t.productSettings.fields.protein, "0.1")}
              {numberField("fatGrams", t.productSettings.fields.fat, "0.1")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="productUrl">{t.productSettings.fields.productUrl}</Label>
              <Input
                id="productUrl"
                placeholder={t.productSettings.urlPlaceholder}
                className={fieldClassName}
                {...register("productUrl")}
                disabled={authMissing}
                inputMode="url"
              />
              {errors.productUrl && <FieldError>{errors.productUrl.message}</FieldError>}
            </div>

            {formError && <FieldError>{formError}</FieldError>}
            {formMessage && <p role="status" className="text-sm font-medium text-brand">{formMessage}</p>}

            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-semibold"
              disabled={authMissing || createProductMutation.isPending}
            >
              {createProductMutation.isPending ? t.productSettings.submitting : t.productSettings.submit}
            </Button>
          </form>
        </section>
      </div>

      {warningDraft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="zero-values-title"
            className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl"
          >
            <h2 id="zero-values-title" className="text-lg font-bold text-foreground">{t.productSettings.warning.title}</h2>
            <p className="text-sm text-muted-foreground">{t.productSettings.warning.description}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm font-medium text-foreground">
              {warningDraft.zeroFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => setWarningDraft(null)}>
                {t.productSettings.warning.back}
              </Button>
              <Button
                className="h-11 rounded-xl"
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

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-pace-semantic-danger">
      {children}
    </p>
  );
}

function FavoriteButton({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? "border-pace-semantic-warning bg-pace-semantic-warningSurface text-pace-semantic-warning"
          : "border-border text-muted-foreground hover:border-pace-semantic-warning hover:text-pace-semantic-warning"
      }`}
    >
      <StarIcon filled={selected} className="h-4 w-4" />
    </button>
  );
}

function ProductThumb({ product, locale }: { product: FuelProduct; locale: "fr" | "en" }) {
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
      {isVerifiedProduct(product) ? <VerifiedProductBadge locale={locale} className="absolute right-0.5 top-0.5 h-5 w-5" /> : null}
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote product images, not optimized by Next.
        <img src={product.imageUrl} alt="" width={44} height={44} loading="lazy" className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className="text-xs font-semibold uppercase text-muted-foreground">{product.name.slice(0, 1)}</span>
      )}
    </div>
  );
}
