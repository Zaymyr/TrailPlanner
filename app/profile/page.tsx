"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { fetchUserProfile, updateUserProfile } from "../../lib/profile-client";
import { MAX_SELECTED_PRODUCTS, mapProductToSelection } from "../../lib/product-preferences";
import { fuelProductSchema, type FuelProduct } from "../../lib/product-types";
import { useProductSelection } from "../hooks/useProductSelection";
import { useVerifiedSession } from "../hooks/useVerifiedSession";
import { useI18n } from "../i18n-provider";

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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { session, isLoading: isSessionLoading } = useVerifiedSession();
  const { replaceSelection } = useProductSelection();
  const [favoriteProducts, setFavoriteProducts] = useState<FuelProduct[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      setFavoriteError(null);
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

  const favoriteIds = useMemo(() => new Set(favoriteProducts.map((product) => product.id)), [favoriteProducts]);

  const handleFavoriteToggle = (product: FuelProduct) => {
    setFavoriteError(null);
    setSaveMessage(null);
    setSaveError(null);

    setFavoriteProducts((current) => {
      const exists = current.some((item) => item.id === product.id);
      if (exists) {
        return current.filter((item) => item.id !== product.id);
      }

      if (current.length >= MAX_SELECTED_PRODUCTS) {
        setFavoriteError(t.profile.favorites.limit);
        return current;
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
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-slate-950/80 px-4 py-10 backdrop-blur">
      <div className="w-full max-w-5xl space-y-4 rounded-lg border border-emerald-300/30 bg-slate-950 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-50">{t.profile.favorites.dialog.title}</p>
            <p className="text-sm text-slate-400">{t.profile.favorites.subtitle}</p>
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
          <p className="text-xs text-slate-400">
            {favoriteProducts.length}/{MAX_SELECTED_PRODUCTS} {t.profile.favorites.selectedLabel.toLowerCase()}
          </p>
        </div>

        {productsQuery.isLoading ? (
          <p className="text-sm text-slate-400">{t.productSettings.loading}</p>
        ) : null}

        {productsQuery.error ? (
          <p className="text-sm text-red-300">{t.profile.error}</p>
        ) : null}

        {!productsQuery.isLoading && filteredProducts.length === 0 ? (
          <p className="text-sm text-slate-400">{t.productSettings.empty}</p>
        ) : null}

        {filteredProducts.length > 0 ? (
          <Table containerClassName="max-h-[420px] overflow-y-auto">
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>{t.profile.favorites.table.name}</TableHead>
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
                    <TableCell className="font-semibold text-slate-50">{product.name}</TableCell>
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
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Trailplanner</p>
        <h2 className="text-2xl font-semibold text-slate-50">{t.profile.title}</h2>
        <p className="text-sm text-slate-300">{t.profile.description}</p>
      </div>

      {!isSessionLoading && authMissing ? (
        <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
          {t.profile.authRequired}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-50">{t.profile.basics.title}</CardTitle>
            <p className="text-sm text-slate-400">{t.profile.basics.subtitle}</p>
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
              <p className="text-xs text-slate-400">{t.profile.basics.waterBagHelper}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg text-slate-50">{t.profile.favorites.title}</CardTitle>
              <p className="text-sm text-slate-400">{t.profile.favorites.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400">
                {favoriteProducts.length}/{MAX_SELECTED_PRODUCTS} {t.profile.favorites.selectedLabel.toLowerCase()}
              </p>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(true)} disabled={authMissing}>
                {t.profile.favorites.add}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {favoriteError ? <p className="text-sm text-red-300">{favoriteError}</p> : null}
            {profileQuery.isLoading ? (
              <p className="text-sm text-slate-400">{t.productSettings.loading}</p>
            ) : null}
            {favoriteProducts.length === 0 ? (
              <p className="text-sm text-slate-400">{t.profile.favorites.empty}</p>
            ) : (
              <div className="space-y-2">
                {favoriteProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                  >
                    <div>
                      <p className="font-semibold text-slate-50">{product.name}</p>
                      <p className="text-xs text-slate-400">
                        {t.racePlanner.sections.gels.nutrition
                          .replace("{carbs}", product.carbsGrams.toString())
                          .replace("{sodium}", product.sodiumMg.toString())}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
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

        {saveError ? <p className="text-sm text-red-300">{saveError}</p> : null}
        {saveMessage ? <p className="text-sm text-emerald-300">{saveMessage}</p> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={authMissing || saveProfileMutation.isPending}>
            {saveProfileMutation.isPending ? t.profile.saving : t.profile.save}
          </Button>
        </div>
      </form>

      {isDialogOpen ? dialogContent : null}
    </div>
  );
}
