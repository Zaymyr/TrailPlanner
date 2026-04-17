"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { fuelTypeValues } from "../../../lib/fuel-types";
import { useI18n } from "../../i18n-provider";
import {
  adminProductSchema,
  adminProductImportRequestSchema,
  adminProductImportResponseSchema,
  basePillClass,
  EditProductFormValues,
  editProductFormSchema,
  formatDate,
} from "./admin-types";

const importExampleJson = JSON.stringify(
  [
    {
      name: "Maurten Gel 100",
      brand: "Maurten",
      slug: "maurten-gel-100",
      sku: "MAURTEN-GEL-100",
      fuelType: "gel",
      caloriesKcal: 100,
      carbsGrams: 25,
      sodiumMg: 85,
      productUrl: "https://example.com/maurten-gel-100",
      imageUrl: "https://example.com/images/maurten-gel-100.png",
    },
    {
      name: "Precision Fuel PF 30 Gel",
      brand: "Precision Fuel & Hydration",
      slug: "precision-fuel-pf-30-gel",
      sku: "PRECISION-FUEL-PF-30-GEL",
      fuelType: "gel",
      caloriesKcal: 120,
      carbsGrams: 30,
      sodiumMg: 0,
    },
  ],
  null,
  2
);

export function AdminProductsTab({ accessToken }: { accessToken: string | null }) {
  const { t } = useI18n();
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importJson, setImportJson] = useState("");
  const [archiveSharedCatalog, setArchiveSharedCatalog] = useState(true);
  const [editProduct, setEditProduct] = useState<z.infer<typeof adminProductSchema> | null>(null);

  const editForm = useForm<EditProductFormValues>({
    resolver: zodResolver(editProductFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      sku: "",
      productUrl: "",
      fuelType: "other",
      caloriesKcal: 0,
      carbsGrams: 0,
      sodiumMg: 0,
      proteinGrams: 0,
      fatGrams: 0,
    },
  });

  useEffect(() => {
    editForm.reset({
      name: editProduct?.name ?? "",
      slug: editProduct?.slug ?? "",
      sku: editProduct?.sku ?? "",
      productUrl: editProduct?.productUrl ?? "",
      fuelType: (fuelTypeValues as readonly string[]).includes(editProduct?.fuelType ?? "") ? (editProduct?.fuelType as EditProductFormValues["fuelType"]) : "other",
      caloriesKcal: editProduct?.caloriesKcal ?? 0,
      carbsGrams: editProduct?.carbsGrams ?? 0,
      sodiumMg: editProduct?.sodiumMg ?? 0,
      proteinGrams: editProduct?.proteinGrams ?? 0,
      fatGrams: editProduct?.fatGrams ?? 0,
    });
  }, [editProduct, editForm]);

  const productsQuery = useQuery({
    queryKey: ["admin", "products", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error(t.admin.products.loadError);

      const response = await fetch("/api/admin/products", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.products.loadError;
        throw new Error(message);
      }

      const parsed = z.object({ products: z.array(adminProductSchema) }).safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.products.loadError);
      }

      return parsed.data.products;
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (payload: { id: string; isLive?: boolean; isArchived?: boolean }) => {
      if (!accessToken) throw new Error(t.admin.products.messages.error);

      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.products.messages.error;
        throw new Error(message);
      }

      const parsed = z.object({ product: adminProductSchema }).safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.products.messages.error);
      }

      return parsed.data.product;
    },
    onSuccess: () => {
      setProductError(null);
      setProductMessage(t.admin.products.messages.updated);
      void productsQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.products.messages.error;
      setProductError(message);
      setProductMessage(null);
    },
  });

  const importProductsMutation = useMutation({
    mutationFn: async () => {
      setImportMessage(null);
      setImportError(null);

      if (!accessToken) throw new Error(t.admin.products.messages.error);
      if (!importJson.trim()) throw new Error(t.admin.products.import.invalidJson);

      let rawInput: unknown;

      try {
        rawInput = JSON.parse(importJson);
      } catch {
        throw new Error(t.admin.products.import.invalidJson);
      }

      const parsedInput = adminProductImportRequestSchema.safeParse(rawInput);

      if (!parsedInput.success) {
        throw new Error(t.admin.products.import.invalidJson);
      }

      const payload = Array.isArray(parsedInput.data)
        ? {
            action: "importCatalog" as const,
            archiveSharedCatalog,
            products: parsedInput.data,
          }
        : {
            action: "importCatalog" as const,
            archiveSharedCatalog: parsedInput.data.archiveSharedCatalog ?? archiveSharedCatalog,
            products: parsedInput.data.products,
          };

      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.products.messages.error;
        throw new Error(message);
      }

      const parsedResponse = adminProductImportResponseSchema.safeParse(data);

      if (!parsedResponse.success) {
        throw new Error(t.admin.products.messages.error);
      }

      return parsedResponse.data;
    },
    onSuccess: (data) => {
      setImportError(null);
      setImportMessage(t.admin.products.import.success.replace("{count}", String(data.importedCount)));
      void productsQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.products.messages.error;
      setImportError(message);
      setImportMessage(null);
    },
  });

  const editProductMutation = useMutation({
    mutationFn: async (payload: { id: string } & EditProductFormValues) => {
      if (!accessToken) throw new Error(t.admin.products.messages.error);

      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: payload.id,
          name: payload.name,
          slug: payload.slug,
          sku: payload.sku || undefined,
          productUrl: payload.productUrl || undefined,
          fuelType: payload.fuelType,
          caloriesKcal: payload.caloriesKcal,
          carbsGrams: payload.carbsGrams,
          sodiumMg: payload.sodiumMg,
          proteinGrams: payload.proteinGrams,
          fatGrams: payload.fatGrams,
        }),
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.admin.products.messages.error;
        throw new Error(message);
      }

      const parsed = z.object({ product: adminProductSchema }).safeParse(data);

      if (!parsed.success) {
        throw new Error(t.admin.products.messages.error);
      }

      return parsed.data.product;
    },
    onSuccess: () => {
      setProductError(null);
      setProductMessage(t.admin.products.messages.updated);
      setEditProduct(null);
      void productsQuery.refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.admin.products.messages.error;
      setProductError(message);
      setProductMessage(null);
    },
  });

  const isLoading = productsQuery.isLoading;
  const productRows = productsQuery.data ?? [];

  const renderStatusPill = (product: z.infer<typeof adminProductSchema>) => {
    if (product.isArchived) {
      return (
        <span className={`${basePillClass} bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-100`}>
          {t.admin.products.status.archived}
        </span>
      );
    }
    if (product.isLive) {
      return (
        <span className={`${basePillClass} bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200`}>
          {t.admin.products.status.live}
        </span>
      );
    }
    return (
      <span className={`${basePillClass} bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200`}>
        {t.admin.products.status.draft}
      </span>
    );
  };

  const handleEditSubmit = editForm.handleSubmit((values) => {
    if (!editProduct) return;
    editProductMutation.mutate({ id: editProduct.id, ...values });
  });

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.admin.products.import.title}</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t.admin.products.import.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {t.admin.products.import.sharedOnlyNote}
            </p>

            {importMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-200">{importMessage}</p> : null}
            {importError ? <p className="text-sm text-red-600 dark:text-red-300">{importError}</p> : null}

            <div className="space-y-2">
              <Label htmlFor="admin-products-import-json">{t.admin.products.import.label}</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.admin.products.import.formatHint}</p>
              <textarea
                id="admin-products-import-json"
                className="min-h-[280px] w-full rounded-md border border-input bg-background px-3 py-3 font-mono text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                value={importJson}
                onChange={(event) => setImportJson(event.target.value)}
                placeholder={t.admin.products.import.placeholder}
                spellCheck={false}
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border border-input"
                checked={archiveSharedCatalog}
                onChange={(event) => setArchiveSharedCatalog(event.target.checked)}
              />
              <span>{t.admin.products.import.archiveSharedLabel}</span>
            </label>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setImportJson(importExampleJson);
                  setImportError(null);
                }}
                disabled={importProductsMutation.isPending}
              >
                {t.admin.products.import.loadExample}
              </Button>
              <Button
                type="button"
                onClick={() => importProductsMutation.mutate()}
                disabled={importProductsMutation.isPending || !importJson.trim()}
              >
                {importProductsMutation.isPending
                  ? t.admin.products.import.submitting
                  : t.admin.products.import.submit}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.admin.products.title}</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t.admin.products.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {productMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-200">{productMessage}</p> : null}
            {productError || productsQuery.error ? (
              <p className="text-sm text-red-600 dark:text-red-300">
                {productError ??
                  (productsQuery.error instanceof Error
                    ? productsQuery.error.message
                    : t.admin.products.loadError)}
              </p>
            ) : null}

            {isLoading && productRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.access.checking}</p>
            ) : null}

            {!isLoading && productRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.admin.products.empty}</p>
            ) : null}

            {productRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.products.table.name}</TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.products.table.status}</TableHead>
                    <TableHead className="text-slate-600 dark:text-slate-300">{t.admin.products.table.updated}</TableHead>
                    <TableHead className="text-right text-slate-600 dark:text-slate-300">
                      {t.admin.products.table.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productRows.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-50">
                        {product.name}
                      </TableCell>
                      <TableCell>{renderStatusPill(product)}</TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        {formatDate(product.updatedAt)}
                      </TableCell>
                      <TableCell className="flex justify-end gap-2">
                        <Button
                          className="h-9 px-3 text-sm"
                          variant="outline"
                          disabled={updateProductMutation.isPending || editProductMutation.isPending}
                          onClick={() => setEditProduct(product)}
                        >
                          {t.admin.products.actions.edit}
                        </Button>
                        <Button
                          className="h-9 px-3 text-sm"
                          variant="outline"
                          disabled={updateProductMutation.isPending}
                          onClick={() =>
                            updateProductMutation.mutate({
                              id: product.id,
                              isLive: true,
                              isArchived: false,
                            })
                          }
                        >
                          {t.admin.products.actions.setLive}
                        </Button>
                        <Button
                          className="h-9 px-3 text-sm"
                          variant="outline"
                          disabled={updateProductMutation.isPending}
                          onClick={() =>
                            updateProductMutation.mutate({
                              id: product.id,
                              isLive: false,
                              isArchived: false,
                            })
                          }
                        >
                          {t.admin.products.actions.setDraft}
                        </Button>
                        <Button
                          className="h-9 px-3 text-sm"
                          variant="outline"
                          disabled={updateProductMutation.isPending}
                          onClick={() =>
                            updateProductMutation.mutate({
                              id: product.id,
                              isArchived: !product.isArchived,
                              isLive: product.isArchived ? product.isLive : false,
                            })
                          }
                        >
                          {product.isArchived ? t.admin.products.actions.restore : t.admin.products.actions.archive}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={editProduct !== null}
        onOpenChange={(open) => {
          if (!open) setEditProduct(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.admin.products.editDialog.title}</DialogTitle>
            <DialogDescription>{editProduct?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-product-name">{t.admin.products.editDialog.name}</Label>
              <Input id="edit-product-name" {...editForm.register("name")} />
              {editForm.formState.errors.name ? (
                <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-product-slug">{t.admin.products.editDialog.slug}</Label>
              <Input id="edit-product-slug" {...editForm.register("slug")} />
              {editForm.formState.errors.slug ? (
                <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.slug.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-product-sku">{t.admin.products.editDialog.sku}</Label>
              <Input id="edit-product-sku" {...editForm.register("sku")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-product-url">{t.admin.products.editDialog.productUrl}</Label>
              <Input id="edit-product-url" type="url" {...editForm.register("productUrl")} />
              {editForm.formState.errors.productUrl ? (
                <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.productUrl.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-product-fuel-type">{t.admin.products.editDialog.fuelType}</Label>
              <select
                id="edit-product-fuel-type"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                {...editForm.register("fuelType")}
              >
                {fuelTypeValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-product-calories">{t.admin.products.editDialog.caloriesKcal}</Label>
                <Input id="edit-product-calories" type="number" min="0" {...editForm.register("caloriesKcal")} />
                {editForm.formState.errors.caloriesKcal ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.caloriesKcal.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-carbs">{t.admin.products.editDialog.carbsGrams}</Label>
                <Input id="edit-product-carbs" type="number" min="0" {...editForm.register("carbsGrams")} />
                {editForm.formState.errors.carbsGrams ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.carbsGrams.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-sodium">{t.admin.products.editDialog.sodiumMg}</Label>
                <Input id="edit-product-sodium" type="number" min="0" {...editForm.register("sodiumMg")} />
                {editForm.formState.errors.sodiumMg ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.sodiumMg.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-protein">{t.admin.products.editDialog.proteinGrams}</Label>
                <Input id="edit-product-protein" type="number" min="0" {...editForm.register("proteinGrams")} />
                {editForm.formState.errors.proteinGrams ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.proteinGrams.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-fat">{t.admin.products.editDialog.fatGrams}</Label>
                <Input id="edit-product-fat" type="number" min="0" {...editForm.register("fatGrams")} />
                {editForm.formState.errors.fatGrams ? (
                  <p className="text-xs text-red-600 dark:text-red-300">{editForm.formState.errors.fatGrams.message}</p>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditProduct(null)}
              >
                {t.admin.products.editDialog.cancel}
              </Button>
              <Button type="submit" disabled={editProductMutation.isPending}>
                {editProductMutation.isPending
                  ? t.admin.products.editDialog.saving
                  : t.admin.products.editDialog.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
