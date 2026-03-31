import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { PlanFormValues, PlanProduct, PlanTarget } from './contracts';

type Args = {
  values: PlanFormValues;
};

export function usePlanProducts({ values }: Args) {
  const [productMap, setProductMap] = useState<Record<string, PlanProduct>>({});
  const [allProducts, setAllProducts] = useState<PlanProduct[]>([]);
  const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(new Set());
  const [productsLoading, setProductsLoading] = useState(true);
  const [pickerTarget, setPickerTarget] = useState<PlanTarget | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [
        {
          data: { user },
        },
        productsResult,
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('products')
          .select('id, name, fuel_type, carbs_g, sodium_mg, calories_kcal')
          .eq('is_live', true)
          .eq('is_archived', false)
          .order('name'),
      ]);

      if (cancelled) return;

      const products = (productsResult.data ?? []) as PlanProduct[];
      setAllProducts(products);
      setProductMap(
        products.reduce<Record<string, PlanProduct>>((map, product) => {
          map[product.id] = product;
          return map;
        }, {}),
      );

      if (user) {
        const { data: favoriteRows } = await supabase
          .from('user_favorite_products')
          .select('product_id')
          .eq('user_id', user.id);

        if (!cancelled && favoriteRows) {
          setFavoriteProductIds(new Set((favoriteRows as Array<{ product_id: string }>).map((row) => row.product_id)));
        }
      }

      if (!cancelled) setProductsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const pickerSearchLower = pickerSearch.trim().toLowerCase();
  const filteredAllProducts = useMemo(
    () =>
      allProducts.filter(
        (product) => pickerSearchLower === '' || product.name.toLowerCase().includes(pickerSearchLower),
      ),
    [allProducts, pickerSearchLower],
  );
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
    filteredAllProducts,
    pickerFavorites,
    currentSupplyIds,
    openPicker,
  };
}
