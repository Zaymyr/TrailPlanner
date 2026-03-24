import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type FuelType = 'gel' | 'drink_mix' | 'electrolyte' | 'capsule' | 'bar' | 'real_food' | 'other';

type Product = {
  id: string;
  name: string;
  fuel_type: FuelType;
  carbs_g: number | null;
  sodium_mg: number | null;
  calories_kcal: number | null;
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
  'all', 'gel', 'drink_mix', 'electrolyte', 'bar', 'real_food', 'other',
];

export default function NutritionScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [fuelFilter, setFuelFilter] = useState<FuelType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return;
    setUserId(uid);

    const [favsResult, productsResult] = await Promise.all([
      supabase
        .from('user_favorite_products')
        .select('product_id, products(id, name, fuel_type, carbs_g, sodium_mg, calories_kcal)')
        .eq('user_id', uid),
      supabase
        .from('products')
        .select('id, name, fuel_type, carbs_g, sodium_mg, calories_kcal')
        .eq('is_live', true)
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
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Catalogue produits</Text>

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
});
