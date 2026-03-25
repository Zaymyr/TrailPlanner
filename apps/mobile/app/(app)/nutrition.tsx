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

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';
const FREE_FAVORITE_LIMIT = 3;

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
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [fuelFilter, setFuelFilter] = useState<FuelType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create product form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFuelType, setNewFuelType] = useState<FuelType>('gel');
  const [newCarbsG, setNewCarbsG] = useState('');
  const [newSodiumMg, setNewSodiumMg] = useState('');
  const [newCaloriesKcal, setNewCaloriesKcal] = useState('');

  const fetchData = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    const token = sessionData?.session?.access_token ?? null;
    if (!uid) return;
    setUserId(uid);
    setAccessToken(token);

    const [favsResult, productsResult, subResult] = await Promise.all([
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
      supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', uid)
        .eq('status', 'active')
        .maybeSingle(),
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

    if (!subResult.error && subResult.data) {
      setIsPremium(true);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleFavorite(productId: string) {
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
        Alert.alert(
          'Limite atteinte',
          `Les utilisateurs gratuits peuvent avoir ${FREE_FAVORITE_LIMIT} favoris. Passez en Premium pour des favoris illimités.`,
          [{ text: 'OK' }],
        );
        return;
      }

      // Add
      const { error: err } = await supabase
        .from('user_favorite_products')
        .insert({ user_id: userId, product_id: productId });

      if (!err) {
        const product = products.find((p) => p.id === productId);
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

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Erreur ${res.status}`);
      }

      const created: Product = await res.json();
      // Append to products list and auto-favorite
      setProducts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      await toggleFavorite(created.id);
      resetCreateForm();
      setShowCreateModal(false);
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de créer le produit.');
    } finally {
      setCreating(false);
    }
  }

  const filteredProducts = fuelFilter === 'all'
    ? products
    : products.filter((p) => p.fuel_type === fuelFilter);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
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
      <Text style={styles.sectionTitle}>Mes favoris</Text>

      {!isPremium && (
        <View style={styles.limitBanner}>
          <Text style={styles.limitBannerText}>
            {favoriteIds.size}/{FREE_FAVORITE_LIMIT} favoris · Passez en Premium pour des favoris illimités
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

      {/* Catalogue produits */}
      <View style={styles.catalogHeader}>
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Catalogue produits</Text>
        {isPremium ? (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createButtonText}>+ Mon produit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.premiumTag}>
            <Text style={styles.premiumTagText}>Premium</Text>
          </View>
        )}
      </View>

      {!isPremium && (
        <View style={styles.premiumBanner}>
          <Text style={styles.premiumBannerText}>
            ⚡ La création de produits personnalisés est réservée aux abonnés Premium.
          </Text>
        </View>
      )}

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
              placeholderTextColor="#475569"
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
                  placeholderTextColor="#475569"
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
                  placeholderTextColor="#475569"
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
                  placeholderTextColor="#475569"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, creating && styles.submitButtonDisabled]}
              onPress={handleCreateProduct}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#0f172a" />
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
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
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
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  limitBannerText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
  premiumBanner: {
    backgroundColor: '#1c1003',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#92400e',
  },
  premiumBannerText: {
    color: '#fbbf24',
    fontSize: 13,
  },
  createButton: {
    backgroundColor: '#14532d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22c55e',
    marginBottom: 4,
  },
  createButtonText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '700',
  },
  premiumTag: {
    backgroundColor: '#1c1003',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#92400e',
    marginBottom: 4,
  },
  premiumTagText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyFavorites: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginBottom: 8,
  },
  emptyFavText: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  productCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  productType: {
    fontSize: 12,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  myProductTag: {
    color: '#22c55e',
    textTransform: 'none',
    letterSpacing: 0,
  },
  productStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  favButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favButtonActive: {
    backgroundColor: '#14532d',
  },
  favButtonText: {
    fontSize: 20,
    color: '#475569',
  },
  favButtonTextActive: {
    color: '#22c55e',
  },
  removeFavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#14532d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFavText: {
    fontSize: 20,
    color: '#22c55e',
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterContent: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#14532d',
    borderColor: '#22c55e',
  },
  filterChipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#22c55e',
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
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
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
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
});
