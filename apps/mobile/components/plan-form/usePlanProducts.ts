import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { PlanFormValues, PlanProduct, PlanTarget } from './contracts';

export type PlanProductsBootstrap = {
  allProducts: PlanProduct[];
  favoriteProductIds: Set<string>;
};

type Args = {
  values: PlanFormValues;
  initialData?: PlanProductsBootstrap | null;
};

function buildProductMap(products: PlanProduct[]) {
  return products.reduce<Record<string, PlanProduct>>((map, product) => {
    map[product.id] = product;
    return map;
  }, {});
}

export async function loadPlanProductsBootstrap(userId: string | null | undefined): Promise<PlanProductsBootstrap> {
  const [productsResult, favoriteRowsResult] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, fuel_type, carbs_g, sodium_mg, calories_kcal')
      .eq('is_live', true)
      .eq('is_archived', false)
      .order('name'),
    userId
      ? supabase
          .from('user_favorite_products')
          .select('product_id')
          .eq('user_id', userId)
      : Promise.resolve({ data: [] as Array<{ product_id: string }> }),
  ]);

  return {
    allProducts: (productsResult.data ?? []) as PlanProduct[],
    favoriteProductIds: new Set(
      ((favoriteRowsResult.data ?? []) as Array<{ product_id: string }>).map((row) => row.product_id),
    ),
  };
}

export function usePlanProducts({ values, initialData }: Args) {
  const [productMap, setProductMap] = useState<Record<string, PlanProduct>>(() =>
    buildProductMap(initialData?.allProducts ?? []),
  );
  const [allProducts, setAllProducts] = useState<PlanProduct[]>(() => initialData?.allProducts ?? []);
  const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(
    () => new Set(initialData?.favoriteProductIds ?? []),
  );
  const [productsLoading, setProductsLoading] = useState(!initialData);
  const [pickerTarget, setPickerTarget] = useState<PlanTarget | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSort, setPickerSort] = useState<'name' | 'carbs' | 'sodium'>('name');

  useEffect(() => {
    let cancelled = false;

    if (initialData) {
      setAllProducts(initialData.allProducts);
      setProductMap(buildProductMap(initialData.allProducts));
      setFavoriteProductIds(new Set(initialData.favoriteProductIds));
      setProductsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const nextData = await loadPlanProductsBootstrap(user?.id ?? null);

      if (cancelled) return;

      setAllProducts(nextData.allProducts);
      setProductMap(buildProductMap(nextData.allProducts));
      setFavoriteProductIds(new Set(nextData.favoriteProductIds));
      setProductsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  const pickerSearchLower = pickerSearch.trim().toLowerCase();
  const filteredAllProducts = useMemo(() => {
    const filtered = allProducts.filter(
      (product) => pickerSearchLower === '' || product.name.toLowerCase().includes(pickerSearchLower),
    );

    return [...filtered].sort((left, right) => {
      if (pickerSort === 'carbs') {
        const leftCarbs = left.carbs_g ?? 0;
        const rightCarbs = right.carbs_g ?? 0;
        if (rightCarbs !== leftCarbs) return rightCarbs - leftCarbs;
      }

      if (pickerSort === 'sodium') {
        const leftSodium = left.sodium_mg ?? 0;
        const rightSodium = right.sodium_mg ?? 0;
        if (rightSodium !== leftSodium) return rightSodium - leftSodium;
      }

      return left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' });
    });
  }, [allProducts, pickerSearchLower, pickerSort]);
  const pickerFavorites = useMemo(
    () => filteredAllProducts.filter((product) => favoriteProductIds.has(product.id)),
    [favoriteProductIds, filteredAllProducts],
  );
  const currentSupplyIds = useMemo(
    () =>
      pickerTarget !== null
        ? new Set(
            (pickerTarget === 'start' ? values.startSupplies ?? [] : values.aidStations[pickerTarget]?.supplies ?? []).map(
              (supply) => supply.productId,
            ),
          )
        : new Set<string>(),
    [pickerTarget, values.aidStations, values.startSupplies],
  );

  const openPicker = (target: PlanTarget) => {
    setPickerSearch('');
    setPickerSort('name');
    setPickerTarget(target);
  };

  return {
    productMap,
    allProducts,
    favoriteProductIds,
    setFavoriteProductIds,
    productsLoading,
    pickerTarget,
    setPickerTarget,
    pickerSearch,
    setPickerSearch,
    pickerSort,
    setPickerSort,
    filteredAllProducts,
    pickerFavorites,
    currentSupplyIds,
    openPicker,
  };
}
