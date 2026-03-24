import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type PlanRow = {
  id: string;
  name: string;
  updated_at: string;
  planner_values: {
    raceDistanceKm?: number;
    elevationGain?: number;
    paceMinutes?: number;
    paceSeconds?: number;
    speedKph?: number;
    paceType?: 'pace' | 'speed';
  };
};

function estimateDuration(pv: PlanRow['planner_values']): string | null {
  const dist = pv.raceDistanceKm;
  if (!dist) return null;

  let totalMinutes: number;
  if (pv.paceType === 'speed' && pv.speedKph && pv.speedKph > 0) {
    totalMinutes = (dist / pv.speedKph) * 60;
  } else if (pv.paceMinutes != null) {
    const secPerKm = (pv.paceMinutes ?? 0) * 60 + (pv.paceSeconds ?? 0);
    totalMinutes = (secPerKm * dist) / 60;
  } else {
    return null;
  }

  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

export default function PlansScreen() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuPlanId, setMenuPlanId] = useState<string | null>(null);
  const router = useRouter();

  const fetchPlans = useCallback(async () => {
    let cancelled = false;
    const { data, error: err } = await supabase
      .from('race_plans')
      .select('id, name, updated_at, planner_values')
      .order('updated_at', { ascending: false });

    if (cancelled) return;
    if (err) { setError(err.message); }
    else if (data) setPlans(data as PlanRow[]);
    setLoading(false);
    setRefreshing(false);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  async function handleDelete(planId: string) {
    setMenuPlanId(null);
    Alert.alert(
      'Supprimer ce plan ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const { error: err } = await supabase
              .from('race_plans')
              .delete()
              .eq('id', planId);
            if (err) {
              Alert.alert('Erreur', err.message);
            } else {
              setPlans((prev) => prev.filter((p) => p.id !== planId));
            }
          },
        },
      ]
    );
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

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setError(null); setLoading(true); fetchPlans(); }}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedPlan = plans.find((p) => p.id === menuPlanId);

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, plans.length === 0 && styles.listEmpty]}
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏔️</Text>
            <Text style={styles.emptyTitle}>Aucun plan pour l'instant</Text>
            <Text style={styles.emptySubtitle}>
              Crée ton premier plan de course et arrête de bonker.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(app)/plan/new')}
            >
              <Text style={styles.emptyButtonText}>Créer mon premier plan</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const duration = estimateDuration(item.planner_values);
          return (
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.planName}>{item.name}</Text>
                <View style={styles.meta}>
                  {item.planner_values?.raceDistanceKm != null && (
                    <Text style={styles.metaText}>
                      {item.planner_values.raceDistanceKm} km
                    </Text>
                  )}
                  {item.planner_values?.elevationGain != null && (
                    <Text style={styles.metaText}>
                      {' · '}D+ {item.planner_values.elevationGain}m
                    </Text>
                  )}
                  {duration && (
                    <Text style={styles.metaText}>{' · '}{duration}</Text>
                  )}
                  <Text style={styles.metaDate}>
                    {' · '}{formatDate(item.updated_at)}
                  </Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => setMenuPlanId(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.menuButtonText}>⋯</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={() => router.push(`/(app)/race/${item.id}`)}
                >
                  <Text style={styles.startButtonText}>▶ Démarrer</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/plan/new')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Context menu modal */}
      <Modal
        visible={menuPlanId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPlanId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuPlanId(null)}>
          <View style={styles.menuSheet}>
            {selectedPlan && (
              <Text style={styles.menuTitle} numberOfLines={1}>
                {selectedPlan.name}
              </Text>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuPlanId(null);
                router.push(`/(app)/plan/${menuPlanId}/edit`);
              }}
            >
              <Text style={styles.menuItemText}>✏️  Modifier</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => menuPlanId && handleDelete(menuPlanId)}
            >
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                🗑️  Supprimer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuCancel]}
              onPress={() => setMenuPlanId(null)}
            >
              <Text style={styles.menuCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
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
    gap: 12,
    paddingBottom: 100,
  },
  listEmpty: {
    flex: 1,
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
  cardActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  menuButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  menuButtonText: {
    color: '#94a3b8',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  fabText: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
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
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  // Modal / context menu
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  menuTitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  menuItemText: {
    fontSize: 17,
    color: '#f1f5f9',
  },
  menuItemDanger: {
    color: '#ef4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  menuCancel: {
    marginTop: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 17,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
