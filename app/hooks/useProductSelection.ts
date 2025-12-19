"use client";

import { useCallback, useEffect, useState } from "react";

import {
  mapProductToSelection,
  MAX_SELECTED_PRODUCTS,
  persistSelectedProducts,
  readSelectedProducts,
  type StoredProductPreference,
} from "../../lib/product-preferences";
import type { FuelProduct } from "../../lib/product-types";

type ToggleResult = { updated: boolean; reason?: "limit" };

export const useProductSelection = () => {
  const [selectedProducts, setSelectedProducts] = useState<StoredProductPreference[]>([]);

  useEffect(() => {
    setSelectedProducts(readSelectedProducts());
  }, []);

  const replaceSelection = useCallback((products: StoredProductPreference[]) => {
    setSelectedProducts(products.slice(0, MAX_SELECTED_PRODUCTS));
    persistSelectedProducts(products.slice(0, MAX_SELECTED_PRODUCTS));
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

        if (current.length >= MAX_SELECTED_PRODUCTS) {
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
    []
  );

  return {
    selectedProducts,
    replaceSelection,
    toggleProduct,
  };
};
