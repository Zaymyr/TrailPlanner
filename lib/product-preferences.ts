"use client";

import { z } from "zod";

import type { FuelProduct } from "./product-types";

export const MAX_SELECTED_PRODUCTS = 3;

const STORAGE_KEY = "trailplanner.selectedProducts";

const storedProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  sku: z.string().optional(),
  productUrl: z.string().url().optional().nullable(),
  carbsGrams: z.number(),
  sodiumMg: z.number().optional(),
  caloriesKcal: z.number().optional(),
});

export type StoredProductPreference = z.infer<typeof storedProductSchema>;

const storedSelectionSchema = z.array(storedProductSchema).max(MAX_SELECTED_PRODUCTS);

export const readSelectedProducts = (): StoredProductPreference[] => {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    const validated = storedSelectionSchema.safeParse(parsed);
    if (!validated.success) {
      return [];
    }
    return validated.data;
  } catch (error) {
    console.error("Unable to read stored product preferences", error);
    return [];
  }
};

export const persistSelectedProducts = (products: StoredProductPreference[]) => {
  if (typeof window === "undefined") return;

  const next = storedSelectionSchema.safeParse(products);

  if (!next.success) {
    console.error("Invalid product selection, skipping persistence", next.error.flatten().fieldErrors);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.data));
};

export const mapProductToSelection = (product: FuelProduct): StoredProductPreference => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  sku: product.sku,
  productUrl: product.productUrl,
  carbsGrams: product.carbsGrams,
  sodiumMg: product.sodiumMg,
  caloriesKcal: product.caloriesKcal,
});
