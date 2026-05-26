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
  ProductEditDraft,
  ProductFavoriteUsage,
  ProductImageDraft,
  Product,
  UpdateProductResponse,
} from '../components/nutrition/types';
import { usePremium } from '../hooks/usePremium';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { WEB_API_BASE_URL } from '../lib/webApi';

function normalizeRoles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function resolveIsAdminFromAuthUser(
  user:
    | {
        app_metadata?: Record<string, unknown> | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) {
    return false;
  }

  const appMetadata = user.app_metadata ?? null;
  const roles = normalizeRoles(appMetadata?.roles);
  const role = (typeof appMetadata?.role === 'string' ? appMetadata.role : null) ?? roles[0] ?? null;

  return role === 'admin' || roles.includes('admin');
}

function productFromApiProduct(product: NonNullable<CreateProductResponse['product']>): Product {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand ?? null,
    image_url: product.imageUrl ?? null,
    fuel_type: product.fuelType,
    carbs_g: product.carbsGrams,
    sodium_mg: product.sodiumMg,
    calories_kcal: product.caloriesKcal,
    created_by: product.createdBy ?? null,
    is_official: product.isOfficial ?? false,
  };
}

const EMPTY_PRODUCT_FAVORITE_USAGE: ProductFavoriteUsage = {
  productId: null,
  count: null,
  error: null,
  loading: false,
};

type ProductFavoriteUsageResponse = {
  favoriteUsage?: {
    productId?: string;
    favoriteCount?: number;
  };
  message?: string;
  error?: string;
};

export function useNutritionScreen() {
  const { t } = useI18n();
  const { isPremium } = usePremium();
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductFavoriteUsage, setSelectedProductFavoriteUsage] =
    useState<ProductFavoriteUsage>(EMPTY_PRODUCT_FAVORITE_USAGE);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    const token = sessionData?.session?.access_token ?? null;
    setIsAdmin(resolveIsAdminFromAuthUser(sessionData?.session?.user));
    if (!uid) return;

    setUserId(uid);
    setAccessToken(token);

    const [favoritesResult, productsResult] = await Promise.all([
      supabase
        .from('user_favorite_products')
        .select('product_id, products(id, name, brand, image_url, fuel_type, carbs_g, sodium_mg, calories_kcal, created_by, is_official)')
        .eq('user_id', uid),
      supabase
        .from('products')
        .select('id, name, brand, image_url, fuel_type, carbs_g, sodium_mg, calories_kcal, created_by, is_official')
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

  const loadProductFavoriteUsage = useCallback(
    async (productId: string) => {
      if (!isAdmin) {
        setSelectedProductFavoriteUsage(EMPTY_PRODUCT_FAVORITE_USAGE);
        return;
      }

      if (!WEB_API_BASE_URL || !accessToken) {
        setSelectedProductFavoriteUsage({
          productId,
          count: null,
          error: 'Configuration ou session indisponible.',
          loading: false,
        });
        return;
      }

      setSelectedProductFavoriteUsage({
        productId,
        count: null,
        error: null,
        loading: true,
      });

      try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/products/${productId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const body = (await response.json().catch(() => null)) as ProductFavoriteUsageResponse | null;

        if (!response.ok) {
          throw new Error(body?.message ?? body?.error ?? 'Impossible de charger les favoris.');
        }

        const favoriteCount =
          typeof body?.favoriteUsage?.favoriteCount === 'number'
            ? body.favoriteUsage.favoriteCount
            : 0;
        setSelectedProductFavoriteUsage((current) =>
          current.productId === productId
            ? {
                productId,
                count: favoriteCount,
                error: null,
                loading: false,
              }
            : current,
        );
      } catch (usageError) {
        const message =
          usageError instanceof Error && usageError.message
            ? usageError.message
            : 'Impossible de charger les favoris.';
        setSelectedProductFavoriteUsage((current) =>
          current.productId === productId
            ? {
                productId,
                count: null,
                error: message,
                loading: false,
              }
            : current,
        );
      }
    },
    [accessToken, isAdmin],
  );

  useEffect(() => {
    if (!selectedProduct || !isAdmin) {
      setSelectedProductFavoriteUsage(EMPTY_PRODUCT_FAVORITE_USAGE);
      return;
    }

    void loadProductFavoriteUsage(selectedProduct.id);
  }, [isAdmin, loadProductFavoriteUsage, selectedProduct?.id]);

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
          setSelectedProductFavoriteUsage((current) =>
            current.productId === productId && current.count != null
              ? { ...current, count: Math.max(0, current.count - 1) }
              : current,
          );
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
          setSelectedProductFavoriteUsage((current) =>
            current.productId === productId && current.count != null
              ? { ...current, count: current.count + 1 }
              : current,
          );
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
              imageBody?.message ?? "Le produit a été créé, mais l'image n'a pas pu être envoyée.";
          } else {
            uploadedImageUrl = imageBody?.imageUrl ?? null;
          }
        } catch {
          imageUploadWarning = "Le produit a été créé, mais l'image n'a pas pu être envoyée.";
        }
      }

      const createdProduct: Product = {
        ...productFromApiProduct(body.product),
        image_url: uploadedImageUrl ?? body.product.imageUrl ?? null,
        created_by: body.product.createdBy ?? userId,
        is_official: body.product.isOfficial ?? false,
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
    () => {
      const normalizedSearch = catalogSearch.trim().toLowerCase();

      return products.filter((product) => {
        const matchesCategory = fuelFilter === 'all' || product.fuel_type === fuelFilter;
        const matchesSearch =
          normalizedSearch === '' ||
          product.name.toLowerCase().includes(normalizedSearch) ||
          (product.brand ?? '').toLowerCase().includes(normalizedSearch);
        return matchesCategory && matchesSearch;
      });
    },
    [catalogSearch, fuelFilter, products],
  );

  const handleCancelCreateProduct = useCallback(() => {
    resetCreateForm();
    setShowCreateModal(false);
  }, [resetCreateForm]);

  const openProductDetail = useCallback(
    (product: Product) => {
      setSelectedProduct(product);
      setSelectedProductFavoriteUsage(
        isAdmin
          ? {
              productId: product.id,
              count: null,
              error: null,
              loading: true,
            }
          : EMPTY_PRODUCT_FAVORITE_USAGE,
      );
    },
    [isAdmin],
  );

  const closeProductDetail = useCallback(() => {
    if (savingProduct || deletingProduct) return;
    setSelectedProduct(null);
    setSelectedProductFavoriteUsage(EMPTY_PRODUCT_FAVORITE_USAGE);
  }, [deletingProduct, savingProduct]);

  const handleUpdateSelectedProduct = useCallback(
    async (draft: ProductEditDraft) => {
      if (!selectedProduct) return false;

      if (!draft.name.trim()) {
        Alert.alert('Champ requis', 'Le nom du produit est obligatoire.');
        return false;
      }

      const carbsGrams = parseNonNegativeDecimalInput(draft.carbsG);
      const sodiumMg = parseNonNegativeDecimalInput(draft.sodiumMg);
      const caloriesKcal = parseNonNegativeDecimalInput(draft.caloriesKcal);

      if (carbsGrams === null || sodiumMg === null || caloriesKcal === null) {
        Alert.alert('Erreur', 'Entre des valeurs valides, positives ou nulles, pour la nutrition.');
        return false;
      }

      if (!WEB_API_BASE_URL) {
        Alert.alert('Erreur', 'Configuration manquante. Contacte le support.');
        return false;
      }

      if (!accessToken) {
        Alert.alert('Erreur', 'Session invalide. Reconnecte-toi puis recommence.');
        return false;
      }

      setSavingProduct(true);

      try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/products/${selectedProduct.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name: draft.name.trim(),
            brand: draft.brand.trim() || null,
            fuelType: draft.fuelType,
            carbsGrams,
            sodiumMg,
            caloriesKcal,
          }),
        });

        const body = (await response.json().catch(() => null)) as UpdateProductResponse | null;

        if (!response.ok || !body?.product) {
          throw new Error(body?.message ?? body?.error ?? 'Impossible de modifier le produit.');
        }

        let updatedProduct = productFromApiProduct(body.product);
        let imageUploadWarning: string | null = null;

        if (draft.imageDraft) {
          try {
            const formData = new FormData();
            formData.append(
              'image',
              {
                uri: draft.imageDraft.uri,
                name: draft.imageDraft.name,
                type: draft.imageDraft.mimeType,
              } as any,
            );

            const imageResponse = await fetch(`${WEB_API_BASE_URL}/api/products/${updatedProduct.id}/image`, {
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
                imageBody?.message ?? "Le produit a ete modifie, mais l'image n'a pas pu etre envoyee.";
            } else {
              updatedProduct = {
                ...updatedProduct,
                image_url: imageBody?.imageUrl ?? updatedProduct.image_url ?? null,
              };
            }
          } catch {
            imageUploadWarning = "Le produit a ete modifie, mais l'image n'a pas pu etre envoyee.";
          }
        }

        setProducts((current) =>
          current
            .map((product) => (product.id === updatedProduct.id ? updatedProduct : product))
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
        setFavorites((current) =>
          current.map((favorite) =>
            favorite.product_id === updatedProduct.id
              ? { ...favorite, products: updatedProduct }
              : favorite,
          ),
        );
        setSelectedProduct(updatedProduct);
        if (imageUploadWarning) {
          Alert.alert('Image non ajoutee', imageUploadWarning);
        }
        return true;
      } catch (updateError) {
        const message =
          updateError instanceof Error && updateError.message
            ? updateError.message
            : 'Impossible de modifier le produit.';
        Alert.alert('Erreur', message);
        return false;
      } finally {
        setSavingProduct(false);
      }
    },
    [accessToken, selectedProduct],
  );

  const performDeleteProduct = useCallback(
    async (product: Product) => {
      if (!WEB_API_BASE_URL) {
        Alert.alert('Erreur', 'Configuration manquante. Contacte le support.');
        return;
      }

      if (!accessToken) {
        Alert.alert('Erreur', 'Session invalide. Reconnecte-toi puis recommence.');
        return;
      }

      setDeletingProduct(true);

      try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/products/${product.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const body = (await response.json().catch(() => null)) as { message?: string } | null;

        if (!response.ok) {
          throw new Error(body?.message ?? 'Impossible de supprimer le produit.');
        }

        setProducts((current) => current.filter((entry) => entry.id !== product.id));
        setFavorites((current) => current.filter((favorite) => favorite.product_id !== product.id));
        setFavoriteIds((current) => {
          const next = new Set(current);
          next.delete(product.id);
          return next;
        });
        setSelectedProduct(null);
      } catch (deleteError) {
        const message =
          deleteError instanceof Error && deleteError.message
            ? deleteError.message
            : 'Impossible de supprimer le produit.';
        Alert.alert('Erreur', message);
      } finally {
        setDeletingProduct(false);
      }
    },
    [accessToken],
  );

  const handleDeleteSelectedProduct = useCallback(() => {
    if (!selectedProduct || deletingProduct) return;

    Alert.alert(
      'Supprimer le produit',
      'Ce produit sera retire du catalogue et des favoris. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void performDeleteProduct(selectedProduct);
          },
        },
      ],
    );
  }, [deletingProduct, performDeleteProduct, selectedProduct]);

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
    isAdmin,
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
    selectedProduct,
    selectedProductFavoriteUsage,
    savingProduct,
    deletingProduct,
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
    openProductDetail,
    closeProductDetail,
    handleUpdateSelectedProduct,
    handleDeleteSelectedProduct,
  };
}
