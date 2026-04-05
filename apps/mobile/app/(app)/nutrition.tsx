import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { usePremium } from '../../hooks/usePremium';
import { useI18n } from '../../lib/i18n';
import { PremiumUpsellModal } from '../../components/premium/PremiumUpsellModal';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';
const FREE_FAVORITE_LIMIT = 2;

type FuelType = 'gel' | 'drink_mix' | 'electrolyte' | 'capsule' | 'bar' | 'real_food' | 'other';

type Product = {
  id: string;
  name: string;
  fuel_type: FuelType;
  carbs_g: number | null;
  sodium_mg: number | null;
  calories_kcal: number | null;
  created_by?: string | null;
};

type FavoriteRow = {
  product_id: string;
  products: Product;
};

type CreateProductResponse = {
  product?: {
    id: string;
    name: string;
    fuelType: FuelType;
    carbsGrams: number;
    sodiumMg: number;
    caloriesKcal: number;
    createdBy?: string | null;
  };
  message?: string;
  error?: string;
};

const FUEL_TYPE_LABELS: Record<FuelType | 'all', string> = {
  all: 'Tous',
  gel: 'Gel',
  drink_mix: 'Boisson',
  electrolyte: 'Électrolyte',
  capsule: 'Capsule',
  bar: 'Barre',
  real_food: 'Aliment',
  other: 'Autre',
};

const FUEL_FILTERS: Array<FuelType | 'all'> = [
  'all', 'gel', 'drink_mix', 'electrolyte', 'capsule', 'bar', 'real_food', 'other',
];

const FUEL_TYPE_OPTIONS: FuelType[] = [
  'gel', 'drink_mix', 'electrolyte', 'capsule', 'bar', 'real_food', 'other',
];

export default function NutritionScreen() {
  const { t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { isPremium } = usePremium();
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [fuelFilter, setFuelFilter] = useState<FuelType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoritesExpanded, setFavoritesExpanded] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Create product form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFuelType, setNewFuelType] = useState<FuelType>('gel');
  const [newCarbsG, setNewCarbsG] = useState('');
  const [newSodiumMg, setNewSodiumMg] = useState('');
  const [newCaloriesKcal, setNewCaloriesKcal] = useState('');
  const [showFavoriteLimitModal, setShowFavoriteLimitModal] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    const token = sessionData?.session?.access_token ?? null;
    if (!uid) return;
    setUserId(uid);
    setAccessToken(token);

    const [favsResult, productsResult] = await Promise.all([
      supabase
        .from('user_favorite_products')
        .select('product_id, products(id, name, fuel_type, carbs_g, sodium_mg, calories_kcal, created_by)')
        .eq('user_id', uid),
      supabase
        .from('products')
        .select('id, name, fuel_type, carbs_g, sodium_mg, calories_kcal, created_by')
        .or(`is_live.eq.true,created_by.eq.${uid}`)
        .eq('is_archived', false)
        .order('name'),
    ]);

    if (favsResult.error) {
      setError(favsResult.error.message);
    } else {
      const favs = (favsResult.data as any[]).filter((f) => f.products) as FavoriteRow[];
      setFavorites(favs);
      setFavoriteIds(new Set(favs.map((f) => f.product_id)));
    }

    if (productsResult.error) {
      setError(productsResult.error.message);
    } else {
      setProducts((productsResult.data as Product[]) ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleFavorite(productId: string, productOverride?: Product) {
    if (!userId) return;

    if (favoriteIds.has(productId)) {
      // Remove
      const { error: err } = await supabase
        .from('user_favorite_products')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (!err) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        setFavorites((prev) => prev.filter((f) => f.product_id !== productId));
      }
    } else {
      // Check free tier limit before adding
      if (!isPremium && favoriteIds.size >= FREE_FAVORITE_LIMIT) {
        setShowFavoriteLimitModal(true);
        return;
      }

      // Add
      const { error: err } = await supabase
        .from('user_favorite_products')
        .insert({ user_id: userId, product_id: productId });

      if (!err) {
        const product = productOverride ?? products.find((p) => p.id === productId);
        if (product) {
          setFavoriteIds((prev) => new Set([...prev, productId]));
          setFavorites((prev) => [...prev, { product_id: productId, products: product }]);
        }
      }
    }
  }

  function resetCreateForm() {
    setNewName('');
    setNewFuelType('gel');
    setNewCarbsG('');
    setNewSodiumMg('');
    setNewCaloriesKcal('');
  }

  async function handleCreateProduct() {
    if (!newName.trim()) {
      Alert.alert('Champ requis', 'Le nom du produit est obligatoire.');
      return;
    }

    if (!WEB_URL) {
      Alert.alert('Erreur', 'Configuration manquante. Contacte le support.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${WEB_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          fuelType: newFuelType,
          carbsGrams: parseFloat(newCarbsG) || 0,
          sodiumMg: parseFloat(newSodiumMg) || 0,
          caloriesKcal: parseFloat(newCaloriesKcal) || 0,
        }),
      });

      const body = (await res.json().catch(() => null)) as CreateProductResponse | null;

      if (!res.ok) {
        throw new Error(body?.message ?? body?.error ?? `Erreur ${res.status}`);
      }

      if (!body?.product) {
        throw new Error('Impossible de creer le produit.');
      }

      const created: Product = {
        id: body.product.id,
        name: body.product.name,
        fuel_type: body.product.fuelType,
        carbs_g: body.product.carbsGrams,
        sodium_mg: body.product.sodiumMg,
        calories_kcal: body.product.caloriesKcal,
        created_by: body.product.createdBy ?? userId,
      };

      // Append to products list and auto-favorite
      setProducts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      await toggleFavorite(created.id, created);
      resetCreateForm();
      setShowCreateModal(false);
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de créer le produit.');
    } finally {
      setCreating(false);
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesCategory = fuelFilter === 'all' || p.fuel_type === fuelFilter;
    const matchesSearch =
      catalogSearch.trim() === '' ||
      p.name.toLowerCase().includes(catalogSearch.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mes favoris */}
      <TouchableOpacity
        style={styles.favoritesToggleRow}
        onPress={() => setFavoritesExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Mes favoris</Text>
        <Text style={styles.favoritesChevron}>{favoritesExpanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {favoritesExpanded && (
        <>
          {!isPremium && (
            <View style={styles.limitBanner}>
              <Text style={styles.limitBannerText}>
                {t.nutrition.favoritesLimitBanner.replace('{count}', String(FREE_FAVORITE_LIMIT))}
              </Text>
            </View>
          )}

          {favorites.length === 0 ? (
            <View style={styles.emptyFavorites}>
              <Text style={styles.emptyFavText}>
                Aucun favori. Ajoute des produits depuis le catalogue ci-dessous.
              </Text>
            </View>
          ) : (
            favorites.map((fav) => (
              <View key={fav.product_id} style={styles.productCard}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{fav.products.name}</Text>
                  <Text style={styles.productType}>
                    {FUEL_TYPE_LABELS[fav.products.fuel_type] ?? fav.products.fuel_type}
                  </Text>
                  <View style={styles.productStats}>
                    {fav.products.carbs_g != null && (
                      <Text style={styles.statText}>{fav.products.carbs_g}g glucides</Text>
                    )}
                    {fav.products.sodium_mg != null && (
                      <Text style={styles.statText}> · {fav.products.sodium_mg}mg sodium</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.removeFavButton}
                  onPress={() => toggleFavorite(fav.product_id)}
                >
                  <Text style={styles.removeFavText}>★</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </>
      )}

      {/* Catalogue produits */}
      <View style={styles.catalogHeader}>
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Catalogue produits</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>+ Mon produit</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.catalogSearchInput}
        value={catalogSearch}
        onChangeText={setCatalogSearch}
        placeholder="🔍 Rechercher un produit..."
        placeholderTextColor={Colors.textMuted}
      />

      {/* Filtre par type */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FUEL_FILTERS.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterChip, fuelFilter === type && styles.filterChipActive]}
            onPress={() => setFuelFilter(type)}
          >
            <Text
              style={[styles.filterChipText, fuelFilter === type && styles.filterChipTextActive]}
            >
              {FUEL_TYPE_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredProducts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyFavText}>Aucun produit dans cette catégorie.</Text>
        </View>
      ) : (
        filteredProducts.map((product) => {
          const isFav = favoriteIds.has(product.id);
          return (
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productType}>
                  {FUEL_TYPE_LABELS[product.fuel_type] ?? product.fuel_type}
                  {product.created_by === userId && (
                    <Text style={styles.myProductTag}> · Mon produit</Text>
                  )}
                </Text>
                <View style={styles.productStats}>
                  {product.carbs_g != null && (
                    <Text style={styles.statText}>{product.carbs_g}g glucides</Text>
                  )}
                  {product.sodium_mg != null && (
                    <Text style={styles.statText}> · {product.sodium_mg}mg sodium</Text>
                  )}
                  {product.calories_kcal != null && (
                    <Text style={styles.statText}> · {product.calories_kcal} kcal</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.favButton, isFav && styles.favButtonActive]}
                onPress={() => toggleFavorite(product.id)}
              >
                <Text style={[styles.favButtonText, isFav && styles.favButtonTextActive]}>
                  {isFav ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* Create product modal */}
      <PremiumUpsellModal
        visible={showFavoriteLimitModal}
        title={t.plans.freeAccessTitle}
        message={t.nutrition.favoriteLimitMessage.replace('{count}', String(FREE_FAVORITE_LIMIT))}
        onClose={() => setShowFavoriteLimitModal(false)}
      />

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowCreateModal(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Créer un produit</Text>

            <Text style={styles.inputLabel}>Nom *</Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Ex : Gel Maurten 100"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContent}
            >
              {FUEL_TYPE_OPTIONS.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterChip, newFuelType === type && styles.filterChipActive]}
                  onPress={() => setNewFuelType(type)}
                >
                  <Text style={[styles.filterChipText, newFuelType === type && styles.filterChipTextActive]}>
                    {FUEL_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.numericRow}>
              <View style={styles.numericField}>
                <Text style={styles.inputLabel}>Glucides (g)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newCarbsG}
                  onChangeText={setNewCarbsG}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={styles.numericField}>
                <Text style={styles.inputLabel}>Sodium (mg)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newSodiumMg}
                  onChangeText={setNewSodiumMg}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={styles.numericField}>
                <Text style={styles.inputLabel}>Kcal</Text>
                <TextInput
                  style={styles.textInput}
                  value={newCaloriesKcal}
                  onChangeText={setNewCaloriesKcal}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, creating && styles.submitButtonDisabled]}
              onPress={handleCreateProduct}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={Colors.textOnBrand} />
              ) : (
                <Text style={styles.submitButtonText}>Créer et ajouter aux favoris</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { resetCreateForm(); setShowCreateModal(false); }}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 15,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.brandPrimary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 8,
  },
  limitBanner: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  limitBannerText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
    marginBottom: 4,
  },
  createButtonText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyFavorites: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 8,
  },
  emptyFavText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  productCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  productType: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  myProductTag: {
    color: Colors.brandPrimary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  productStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  favButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favButtonActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  favButtonText: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  favButtonTextActive: {
    color: Colors.textOnBrand,
  },
  removeFavButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: Colors.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFavText: {
    fontSize: 18,
    color: Colors.textOnBrand,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterContent: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  filterChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.textOnBrand,
  },
  favoritesToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  favoritesChevron: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  catalogSearchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  // Modal styles
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: Colors.surfaceSecondary,
    color: Colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  numericRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  numericField: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: Colors.textOnBrand,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
