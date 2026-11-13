"use client";

import { useCallback, useEffect, useState } from "react";

import {
  mapProductToSelection,
  persistSelectedProducts,
  readSelectedProducts,
  type StoredProductPreference,
} from "../../lib/product-preferences";
import type { FuelProduct } from "../../lib/product-types";

export type ToggleResult = { updated: boolean };

export const useProductSelection = () => {
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
