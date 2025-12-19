"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { readStoredSession } from "../../lib/auth-storage";
import { MAX_SELECTED_PRODUCTS } from "../../lib/product-preferences";
import { fuelProductSchema, type FuelProduct } from "../../lib/product-types";
import { useProductSelection } from "../hooks/useProductSelection";
import { useI18n } from "../i18n-provider";

const productListSchema = z.object({ products: z.array(fuelProductSchema) });
const productDetailSchema = z.object({ product: fuelProductSchema });
const baseButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300";
const outlineButtonClass = "border border-emerald-300 text-emerald-100 hover:bg-emerald-950/60";
const primaryButtonClass = "bg-emerald-400 text-slate-950 hover:bg-emerald-300";

export default function SettingsPage() {
  const { t } = useI18n();
  const [session, setSession] = useState(() => readStoredSession());
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const { selectedProducts, toggleProduct } = useProductSelection();

  useEffect(() => {
    setSession(readStoredSession());
  }, []);

  useEffect(() => {
    if (selectedProducts.length === 0) {
      setSelectionMessage(null);
      return;
    }
    setSelectionMessage(t.productSettings.selectionCount.replace("{count}", selectedProducts.length.toString()));
  }, [selectedProducts, t.productSettings.selectionCount]);

  const productFormSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t.racePlanner.validation.required),
        carbsGrams: z.coerce.number().positive(t.racePlanner.validation.targetIntake),
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
      t.racePlanner.validation.nonNegative,
      t.racePlanner.validation.required,
      t.racePlanner.validation.targetIntake,
    ]
  );

  type ProductFormValues = z.infer<typeof productFormSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      carbsGrams: 25,
      sodiumMg: 85,
      caloriesKcal: 100,
      proteinGrams: 0,
      fatGrams: 0,
      productUrl: "",
    },
  });

  const productsQuery = useQuery({
    queryKey: ["products", session?.accessToken],
    enabled: Boolean(session?.accessToken),
    queryFn: async () => {
      if (!session?.accessToken) {
        throw new Error(t.productSettings.errors.missingSession);
      }

      const response = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.productSettings.errors.loadFailed;
        throw new Error(message);
      }

      const parsed = productListSchema.safeParse(data);

      if (!parsed.success) {
        throw new Error(t.productSettings.errors.loadFailed);
      }

      return parsed.data.products;
    },
  });

  const productLoadError =
    productsQuery.error instanceof Error
      ? productsQuery.error.message
      : productsQuery.error
        ? t.productSettings.errors.loadFailed
        : null;

  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const createProductMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!session?.accessToken) {
        throw new Error(t.productSettings.errors.missingSession);
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
      void productsQuery.refetch();
      reset();
      toggleProduct(product);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.productSettings.errors.createFailed;
      setFormError(message);
      setFormMessage(null);
    },
  });

  const handleToggle = (product: FuelProduct) => {
    setSelectionError(null);
    const result = toggleProduct(product);
    if (!result.updated && result.reason === "limit") {
      setSelectionError(t.productSettings.errors.selectionLimit);
    }
  };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setFormMessage(null);
    return createProductMutation.mutate(values);
  });

  const authMissing = !session?.accessToken;
  const productList = productsQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">{t.productSettings.title}</h1>
          <p className="text-sm text-slate-300">{t.productSettings.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/race-planner"
            className={`${baseButtonClass} ${outlineButtonClass} border-emerald-300/50 text-emerald-50 hover:border-emerald-200`}
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
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg text-slate-50">{t.productSettings.listTitle}</CardTitle>
              <p className="text-sm text-slate-400">
                {t.productSettings.selectionHelp.replace("{count}", MAX_SELECTED_PRODUCTS.toString())}
              </p>
            </div>
            <Button variant="outline" onClick={() => productsQuery.refetch()} disabled={productsQuery.status === "pending"}>
              {t.productSettings.actions.refresh}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {authMissing && (
              <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
                {t.productSettings.authRequired}
              </p>
            )}

            {selectionMessage && (
              <p className="text-sm font-medium text-emerald-200">{selectionMessage}</p>
            )}
            {selectionError && <p className="text-sm text-red-300">{selectionError}</p>}

            {productsQuery.isLoading && (
              <p className="text-sm text-slate-400">{t.productSettings.loading}</p>
            )}

            {productLoadError && <p className="text-sm text-red-300">{productLoadError}</p>}

            {!productsQuery.isLoading && productList.length === 0 && (
              <p className="text-sm text-slate-400">{t.productSettings.empty}</p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {productList.map((product) => {
                const isSelected = selectedProducts.some((item) => item.id === product.id);
                return (
                  <div
                    key={product.id}
                    className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-50">{product.name}</p>
                        {product.productUrl && (
                          <Link
                            href={product.productUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-xs text-emerald-200 underline-offset-4 hover:underline"
                          >
                            {product.productUrl}
                          </Link>
                        )}
                      </div>
                      <Button
                        variant={isSelected ? "ghost" : "outline"}
                        className={`${isSelected ? "text-emerald-200" : ""} h-9 px-3 text-sm`}
                        onClick={() => handleToggle(product)}
                        disabled={authMissing}
                      >
                        {isSelected ? t.productSettings.actions.deselect : t.productSettings.actions.select}
                      </Button>
                    </div>
                    <div className="text-sm text-slate-300">
                      <p>
                        {t.productSettings.fields.carbs}: <span className="font-semibold">{product.carbsGrams} g</span>
                      </p>
                      <p>
                        {t.productSettings.fields.sodium}:{" "}
                        <span className="font-semibold">{product.sodiumMg} mg</span>
                      </p>
                      <p>
                        {t.productSettings.fields.calories}:{" "}
                        <span className="font-semibold">{product.caloriesKcal}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg text-slate-50">{t.productSettings.formTitle}</CardTitle>
            <p className="text-sm text-slate-400">{t.productSettings.formDescription}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.productSettings.fields.name}</Label>
                <Input id="name" placeholder="Gel, boisson, barre..." {...register("name")} disabled={authMissing} />
                {errors.name && <p className="text-sm text-red-300">{errors.name.message}</p>}
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
                  {errors.carbsGrams && <p className="text-sm text-red-300">{errors.carbsGrams.message}</p>}
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
                  {errors.sodiumMg && <p className="text-sm text-red-300">{errors.sodiumMg.message}</p>}
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
                  {errors.caloriesKcal && <p className="text-sm text-red-300">{errors.caloriesKcal.message}</p>}
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
                  {errors.proteinGrams && <p className="text-sm text-red-300">{errors.proteinGrams.message}</p>}
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
                  {errors.fatGrams && <p className="text-sm text-red-300">{errors.fatGrams.message}</p>}
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
                {errors.productUrl && <p className="text-sm text-red-300">{errors.productUrl.message}</p>}
              </div>

              {formError && <p className="text-sm text-red-300">{formError}</p>}
              {formMessage && <p className="text-sm text-emerald-200">{formMessage}</p>}

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
    </div>
  );
}
