import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import {
  FREE_FAVORITE_LIMIT,
  parseNonNegativeDecimalInput,
} from '../components/nutrition/nutritionConstants';
import type {
  CreateProductResponse,
  FavoriteRow,
  FuelType,
  ProductImageDraft,
  Product,
} from '../components/nutrition/types';
import { usePremium } from '../hooks/usePremium';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { WEB_API_BASE_URL } from '../lib/webApi';

export function useNutritionScreen() {
  const { t } = useI18n();
  const { isPremium } = usePremium();
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [fuelFilter, setFuelFilter] = useState<FuelType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoritesExpanded, setFavoritesExpanded] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFuelType, setNewFuelType] = useState<FuelType>('gel');
  const [newCarbsG, setNewCarbsG] = useState('');
  const [newSodiumMg, setNewSodiumMg] = useState('');
  const [newCaloriesKcal, setNewCaloriesKcal] = useState('');
  const [newImageDraft, setNewImageDraft] = useState<ProductImageDraft | null>(null);
  const [showFavoriteLimitModal, setShowFavoriteLimitModal] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    const token = sessionData?.session?.access_token ?? null;
    if (!uid) return;

    setUserId(uid);
    setAccessToken(token);

    const [favoritesResult, productsResult] = await Promise.all([
      supabase
        .from('user_favorite_products')
        .select('product_id, products(id, name, image_url, fuel_type, carbs_g, sodium_mg, calories_kcal, created_by)')
        .eq('user_id', uid),
      supabase
        .from('products')
        .select('id, name, image_url, fuel_type, carbs_g, sodium_mg, calories_kcal, created_by')
        .or(`is_live.eq.true,created_by.eq.${uid}`)
        .eq('is_archived', false)
        .order('name'),
    ]);

    if (favoritesResult.error) {
      setError(favoritesResult.error.message);
    } else {
      const nextFavorites = (favoritesResult.data as any[]).filter(
        (favorite) => favorite.products,
      ) as FavoriteRow[];
      setFavorites(nextFavorites);
      setFavoriteIds(new Set(nextFavorites.map((favorite) => favorite.product_id)));
    }

    if (productsResult.error) {
      setError(productsResult.error.message);
    } else {
      setProducts((productsResult.data as Product[]) ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const toggleFavorite = useCallback(
    async (productId: string, productOverride?: Product) => {
      if (!userId) return;

      if (favoriteIds.has(productId)) {
        const { error: deleteError } = await supabase
          .from('user_favorite_products')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId);

        if (!deleteError) {
          setFavoriteIds((current) => {
            const next = new Set(current);
            next.delete(productId);
            return next;
          });
          setFavorites((current) => current.filter((favorite) => favorite.product_id !== productId));
        }
        return;
      }

      if (!isPremium && favoriteIds.size >= FREE_FAVORITE_LIMIT) {
        setShowFavoriteLimitModal(true);
        return;
      }

      const { error: insertError } = await supabase
        .from('user_favorite_products')
        .insert({ user_id: userId, product_id: productId });

      if (!insertError) {
        const product = productOverride ?? products.find((entry) => entry.id === productId);
        if (product) {
          setFavoriteIds((current) => new Set([...current, productId]));
          setFavorites((current) => [...current, { product_id: productId, products: product }]);
        }
      }
    },
    [favoriteIds, isPremium, products, userId],
  );

  const resetCreateForm = useCallback(() => {
    setNewName('');
    setNewFuelType('gel');
    setNewCarbsG('');
    setNewSodiumMg('');
    setNewCaloriesKcal('');
    setNewImageDraft(null);
  }, []);

  const pickNewImage = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*'],
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const extension = asset.name?.split('.').pop()?.toLowerCase();
    const fallbackMimeType =
      extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : extension === 'avif'
            ? 'image/avif'
            : extension === 'jpg' || extension === 'jpeg'
              ? 'image/jpeg'
              : '';
    const mimeType = asset.mimeType ?? fallbackMimeType;

    if (!mimeType.startsWith('image/')) {
      Alert.alert('Format invalide', 'Choisis une image JPEG, PNG, WebP ou AVIF.');
      return;
    }

    if ((asset.size ?? 0) > 5 * 1024 * 1024) {
      Alert.alert('Image trop lourde', "L'image doit faire moins de 5 Mo.");
      return;
    }

    setNewImageDraft({
      uri: asset.uri,
      name: asset.name ?? `product-${Date.now()}.jpg`,
      mimeType,
      size: asset.size ?? null,
    });
  }, []);

  const clearNewImage = useCallback(() => {
    setNewImageDraft(null);
  }, []);

  const handleCreateProduct = useCallback(async () => {
    if (!newName.trim()) {
      Alert.alert('Champ requis', 'Le nom du produit est obligatoire.');
      return;
    }

    const carbsGrams = parseNonNegativeDecimalInput(newCarbsG);
    const sodiumMg = parseNonNegativeDecimalInput(newSodiumMg);
    const caloriesKcal = parseNonNegativeDecimalInput(newCaloriesKcal);

    if (carbsGrams === null || sodiumMg === null || caloriesKcal === null) {
      Alert.alert('Erreur', 'Entre des valeurs valides, positives ou nulles, pour la nutrition.');
      return;
    }

    if (!WEB_API_BASE_URL) {
      Alert.alert('Erreur', 'Configuration manquante. Contacte le support.');
      return;
    }

    if (!accessToken) {
      Alert.alert('Erreur', 'Session invalide. Reconnecte-toi puis recommence.');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${WEB_API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          fuelType: newFuelType,
          carbsGrams,
          sodiumMg,
          caloriesKcal,
          proteinGrams: 0,
          fatGrams: 0,
        }),
      });

      const body = (await response.json().catch(() => null)) as CreateProductResponse | null;

      if (!response.ok) {
        throw new Error(body?.message ?? body?.error ?? `Erreur ${response.status}`);
      }

      if (!body?.product) {
        throw new Error('Impossible de créer le produit.');
      }

      let uploadedImageUrl: string | null = null;
      let imageUploadWarning: string | null = null;

      if (newImageDraft) {
        try {
          const formData = new FormData();
          formData.append(
            'image',
            {
              uri: newImageDraft.uri,
              name: newImageDraft.name,
              type: newImageDraft.mimeType,
            } as any,
          );

          const imageResponse = await fetch(`${WEB_API_BASE_URL}/api/products/${body.product.id}/image`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
          });

          const imageBody = (await imageResponse.json().catch(() => null)) as
            | { imageUrl?: string | null; message?: string }
            | null;

          if (!imageResponse.ok) {
            imageUploadWarning =
              imageBody?.message ?? "Le produit a ete cree, mais l'image n'a pas pu etre envoyee.";
          } else {
            uploadedImageUrl = imageBody?.imageUrl ?? null;
          }
        } catch {
          imageUploadWarning = "Le produit a ete cree, mais l'image n'a pas pu etre envoyee.";
        }
      }

      const createdProduct: Product = {
        id: body.product.id,
        name: body.product.name,
        image_url: uploadedImageUrl ?? body.product.imageUrl ?? null,
        fuel_type: body.product.fuelType,
        carbs_g: body.product.carbsGrams,
        sodium_mg: body.product.sodiumMg,
        calories_kcal: body.product.caloriesKcal,
        created_by: body.product.createdBy ?? userId,
      };

      setProducts((current) =>
        [...current, createdProduct].sort((left, right) => left.name.localeCompare(right.name)),
      );
      await toggleFavorite(createdProduct.id, createdProduct);
      resetCreateForm();
      setShowCreateModal(false);

      if (imageUploadWarning) {
        Alert.alert('Image non ajoutee', imageUploadWarning);
      }
    } catch (createError: any) {
      Alert.alert('Erreur', createError.message ?? 'Impossible de créer le produit.');
    } finally {
      setCreating(false);
    }
  }, [
    accessToken,
    newCaloriesKcal,
    newCarbsG,
    newFuelType,
    newImageDraft,
    newName,
    newSodiumMg,
    resetCreateForm,
    toggleFavorite,
    userId,
  ]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory = fuelFilter === 'all' || product.fuel_type === fuelFilter;
        const matchesSearch =
          catalogSearch.trim() === '' ||
          product.name.toLowerCase().includes(catalogSearch.trim().toLowerCase());
        return matchesCategory && matchesSearch;
      }),
    [catalogSearch, fuelFilter, products],
  );

  const handleCancelCreateProduct = useCallback(() => {
    resetCreateForm();
    setShowCreateModal(false);
  }, [resetCreateForm]);

  const favoriteLimitBannerLabel = t.nutrition.favoritesLimitBanner.replace(
    '{count}',
    String(FREE_FAVORITE_LIMIT),
  );
  const favoriteLimitMessage = t.nutrition.favoriteLimitMessage.replace(
    '{count}',
    String(FREE_FAVORITE_LIMIT),
  );

  return {
    t,
    isPremium,
    loading,
    error,
    userId,
    favorites,
    products,
    favoriteIds,
    fuelFilter,
    favoritesExpanded,
    catalogSearch,
    showCreateModal,
    creating,
    newName,
    newFuelType,
    newCarbsG,
    newSodiumMg,
    newCaloriesKcal,
    newImageDraft,
    showFavoriteLimitModal,
    filteredProducts,
    favoriteLimitBannerLabel,
    favoriteLimitMessage,
    toggleFavorite,
    setFuelFilter,
    setFavoritesExpanded,
    setCatalogSearch,
    setShowCreateModal,
    setNewName,
    setNewFuelType,
    setNewCarbsG,
    setNewSodiumMg,
    setNewCaloriesKcal,
    setShowFavoriteLimitModal,
    pickNewImage,
    clearNewImage,
    handleCreateProduct,
    handleCancelCreateProduct,
  };
}
