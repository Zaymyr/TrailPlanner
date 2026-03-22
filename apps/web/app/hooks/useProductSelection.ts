"use client";

import { useCallback, useEffect, useState } from "react";

import {
  mapProductToSelection,
  persistSelectedProducts,
  readSelectedProducts,
  type StoredProductPreference,
} from "../../lib/product-preferences";
import type { FuelProduct } from "../../lib/product-types";

export type ToggleResult = { updated: boolean; reason?: "limit" };

export const useProductSelection = (favoriteLimit: number = Number.POSITIVE_INFINITY) => {
  const [selectedProducts, setSelectedProducts] = useState<StoredProductPreference[]>([]);

  useEffect(() => {
    setSelectedProducts(readSelectedProducts());
  }, []);

  const replaceSelection = useCallback((products: StoredProductPreference[]) => {
    setSelectedProducts(products);
    persistSelectedProducts(products);
  }, []);

  const toggleProduct = useCallback(
    (product: FuelProduct): ToggleResult => {
      let result: ToggleResult = { updated: false };

      setSelectedProducts((current) => {
        const existing = current.find((item) => item.id === product.id);
        if (existing) {
          const next = current.filter((item) => item.id !== product.id);
          persistSelectedProducts(next);
          result = { updated: true };
          return next;
        }

        if (current.length >= favoriteLimit) {
          result = { updated: false, reason: "limit" };
          return current;
        }

        const next = [...current, mapProductToSelection(product)];
        persistSelectedProducts(next);
        result = { updated: true };
        return next;
      });

      return result;
    },
    [favoriteLimit]
  );

  return {
    selectedProducts,
    replaceSelection,
    toggleProduct,
  };
};
