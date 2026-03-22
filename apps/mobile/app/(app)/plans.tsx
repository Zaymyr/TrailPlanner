import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type PlanRow = {
  id: string;
  name: string;
  updated_at: string;
  planner_values: {
    raceDistanceKm?: number;
    elevationGain?: number;
  };
};

export default function PlansScreen() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchPlans = useCallback(async () => {
    const { data } = await supabase
      .from('race_plans')
      .select('id, name, updated_at, planner_values')
      .order('updated_at', { ascending: false });

    if (data) setPlans(data as PlanRow[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mes plans',
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logout}>Déconnexion</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPlans();
            }}
            tintColor="#22c55e"
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>Aucun plan trouvé</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.planName}>{item.name}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>
                  {item.planner_values?.raceDistanceKm ?? '?'} km
                </Text>
                {item.planner_values?.elevationGain != null && (
                  <Text style={styles.metaText}>
                    {' · '}D+ {item.planner_values.elevationGain}m
                  </Text>
                )}
                <Text style={styles.metaDate}>
                  {' · '}
                  {formatDate(item.updated_at)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => router.push(`/(app)/race/${item.id}`)}
            >
              <Text style={styles.startButtonText}>▶ Démarrer</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  planName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  metaDate: {
    fontSize: 14,
    color: '#475569',
  },
  startButton: {
    backgroundColor: '#14532d',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 15,
  },
  logout: {
    color: '#94a3b8',
    fontSize: 15,
  },
  emptyText: {
    color: '#475569',
    fontSize: 16,
  },
});
