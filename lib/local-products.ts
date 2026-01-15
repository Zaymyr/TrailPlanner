import { z } from "zod";

import { fuelProductSchema, type FuelProduct } from "./product-types";

const STORAGE_KEY = "trailplanner.localProducts";
const storedProductsSchema = z.array(fuelProductSchema);

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const readLocalProducts = (): FuelProduct[] => {
  if (!isBrowser()) return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = storedProductsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch (error) {
    console.error("Unable to parse local products", error);
    return [];
  }
};

export const writeLocalProducts = (products: FuelProduct[]) => {
  if (!isBrowser()) return;

  const parsed = storedProductsSchema.safeParse(products);
  if (!parsed.success) {
    console.error("Invalid local products payload", parsed.error.flatten().fieldErrors);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data));
};

export const upsertLocalProduct = (product: FuelProduct) => {
  const existing = readLocalProducts();
  const next = [product, ...existing.filter((item) => item.id !== product.id)];
  writeLocalProducts(next);
};
