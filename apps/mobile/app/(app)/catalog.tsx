import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type CatalogRace = {
  id: string;
  name: string;
  location_text: string | null;
  distance_km: number;
  elevation_gain_m: number;
  thumbnail_url: string | null;
  race_date: string | null;
};

function formatRaceDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CatalogScreen() {
  const [races, setRaces] = useState<CatalogRace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function fetchRaces() {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('races')
        .select('id, name, location_text, distance_km, elevation_gain_m, thumbnail_url, race_date')
        .eq('is_live', true)
        .order('name');

      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else {
        setRaces((data as CatalogRace[]) ?? []);
      }
      setLoading(false);
      setRefreshing(false);
    })();
    return () => { cancelled = true; };
  }

  useEffect(() => {
    const cancel = fetchRaces();
    return cancel;
  }, []);

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
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => { setError(null); setLoading(true); fetchRaces(); }}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={races}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, races.length === 0 && styles.listEmpty]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchRaces(); }}
          tintColor="#22c55e"
        />
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏁</Text>
          <Text style={styles.emptyTitle}>Aucune course disponible</Text>
          <Text style={styles.emptySubtitle}>Le catalogue sera bientôt enrichi.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const raceDate = formatRaceDate(item.race_date);
        return (
          <View style={styles.card}>
            {item.thumbnail_url ? (
              <Image
                source={{ uri: item.thumbnail_url }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                <Text style={styles.thumbnailIcon}>🏔️</Text>
              </View>
            )}

            <View style={styles.cardBody}>
              <Text style={styles.raceName}>{item.name}</Text>

              {item.location_text && (
                <Text style={styles.raceLocation}>📍 {item.location_text}</Text>
              )}

              <View style={styles.statsRow}>
                <Text style={styles.statChip}>{item.distance_km} km</Text>
                <Text style={styles.statChip}>D+ {item.elevation_gain_m}m</Text>
                {raceDate && <Text style={styles.statChip}>{raceDate}</Text>}
              </View>

              <TouchableOpacity
                style={styles.createButton}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/plan/new',
                    params: { catalogRaceId: item.id },
                  })
                }
              >
                <Text style={styles.createButtonText}>+ Créer un plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#f1f5f9',
    fontSize: 15,
  },
  list: {
    padding: 16,
    gap: 16,
    backgroundColor: '#0f172a',
  },
  listEmpty: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 140,
  },
  thumbnailPlaceholder: {
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailIcon: {
    fontSize: 40,
  },
  cardBody: {
    padding: 16,
  },
  raceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  raceLocation: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#14532d',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  createButtonText: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '700',
  },
});
