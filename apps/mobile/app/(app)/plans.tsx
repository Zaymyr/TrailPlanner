import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  SectionList,
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
import { useI18n } from '../../lib/i18n';

type PlanRow = {
  id: string;
  name: string;
  updated_at: string;
  race_id: string | null;
  planner_values: {
    raceDistanceKm?: number;
    elevationGain?: number;
    paceMinutes?: number;
    paceSeconds?: number;
    speedKph?: number;
    paceType?: 'pace' | 'speed';
  };
  races?: { name: string } | null;
};

type RaceSection = {
  raceId: string | null;
  raceName: string;
  isOwned: boolean;
  isAdmin: boolean;
  data: PlanRow[];
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PlansScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [raceOwnership, setRaceOwnership] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuPlanId, setMenuPlanId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    let cancelled = false;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id ?? null;
    if (!cancelled) setUserId(uid);

    const { data: planData, error: planErr } = await supabase
      .from('race_plans')
      .select('id, name, updated_at, race_id, planner_values, races(name)')
      .order('updated_at', { ascending: false });

    if (cancelled) return;

    if (planErr) {
      setError(planErr.message);
    } else if (planData) {
      setPlans(planData as PlanRow[]);

      // Fetch ownership info for unique race IDs
      const raceIds = [...new Set(planData.filter((p) => p.race_id).map((p) => p.race_id!))] ;
      if (raceIds.length > 0 && uid) {
        const { data: racesData } = await supabase
          .from('races')
          .select('id, created_by')
          .in('id', raceIds);
        if (!cancelled && racesData) {
          const ownershipMap: Record<string, string | null> = {};
          for (const r of racesData) ownershipMap[r.id] = r.created_by ?? null;
          setRaceOwnership(ownershipMap);
        }
      }
    }

    if (!cancelled) {
      setLoading(false);
      setRefreshing(false);
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = (planId: string) => {
    setMenuPlanId(null);
    Alert.alert(t.plans.deleteTitle, t.plans.deleteMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          const { error: err } = await supabase.from('race_plans').delete().eq('id', planId);
          if (err) Alert.alert('Erreur', err.message);
          else setPlans((prev) => prev.filter((p) => p.id !== planId));
        },
      },
    ]);
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build sections
  const sections: RaceSection[] = (() => {
    const grouped: Record<string, PlanRow[]> = {};
    for (const plan of plans) {
      const key = plan.race_id ?? '__orphan__';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(plan);
    }

    const result: RaceSection[] = [];
    const seen = new Set<string>();

    for (const [key, planList] of Object.entries(grouped)) {
      if (key === '__orphan__') continue;
      seen.add(key);
      const raceName = planList[0]?.races?.name ?? 'Course inconnue';
      const createdBy = raceOwnership[key] ?? null;
      result.push({
        raceId: key,
        raceName,
        isOwned: createdBy === userId,
        isAdmin: !createdBy,
        data: planList,
      });
    }

    result.sort((a, b) => {
      if (a.isOwned && !b.isOwned) return -1;
      if (!a.isOwned && b.isOwned) return 1;
      return a.raceName.localeCompare(b.raceName);
    });

    const orphans = grouped['__orphan__'] ?? [];
    if (orphans.length > 0) {
      result.push({ raceId: null, raceName: t.plans.noRace, isOwned: false, isAdmin: false, data: orphans });
    }

    return result;
  })();

  const selectedPlan = plans.find((p) => p.id === menuPlanId);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#22c55e" size="large" /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setError(null); setLoading(true); fetchData(); }}>
          <Text style={styles.retryButtonText}>{t.common.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <SectionList
        sections={sections.map((s) => ({ ...s, key: s.raceId ?? '__orphan__' }))}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, sections.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor="#22c55e"
          />
        }
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏔️</Text>
            <Text style={styles.emptyTitle}>{t.plans.empty}</Text>
            <Text style={styles.emptySubtitle}>{t.plans.emptySubtitle}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(app)/race/new')}>
              <Text style={styles.emptyButtonText}>{t.plans.createFirst}</Text>
            </TouchableOpacity>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const key = section.raceId ?? '__orphan__';
          const isCollapsed = collapsedSections.has(key);
          return (
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(key)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionCollapseIcon}>{isCollapsed ? '▶' : '▼'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle} numberOfLines={1}>
                  📍 {section.raceName}
                </Text>
              </View>
              {section.isOwned && (
                <TouchableOpacity
                  onPress={() => router.push(`/(app)/race/${section.raceId}/edit` as any)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.editRaceText}>{t.races.editRace}</Text>
                </TouchableOpacity>
              )}
              {/* + new plan for this race */}
              {section.raceId && (
                <TouchableOpacity
                  style={styles.addPlanBtn}
                  onPress={() => router.push({ pathname: '/(app)/plan/new', params: { raceId: section.raceId! } })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.addPlanBtnText}>+</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
        renderSectionFooter={({ section }) => {
          const key = section.raceId ?? '__orphan__';
          const isCollapsed = collapsedSections.has(key);
          if (isCollapsed || section.data.length === 0) return null;
          if (section.raceId === null) {
            return (
              <Text style={styles.orphanWarning}>{t.plans.noRaceWarning}</Text>
            );
          }
          return null;
        }}
        renderItem={({ item, section }) => {
          const key = section.raceId ?? '__orphan__';
          if (collapsedSections.has(key)) return null;
          const duration = estimateDuration(item.planner_values);
          return (
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.planName}>{item.name}</Text>
                <View style={styles.meta}>
                  {item.planner_values?.raceDistanceKm != null && (
                    <Text style={styles.metaText}>{item.planner_values.raceDistanceKm} km</Text>
                  )}
                  {item.planner_values?.elevationGain != null && (
                    <Text style={styles.metaText}>{' · '}D+ {item.planner_values.elevationGain}m</Text>
                  )}
                  {duration && <Text style={styles.metaText}>{' · '}{duration}</Text>}
                  <Text style={styles.metaDate}>{' · '}{formatDate(item.updated_at)}</Text>
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
                  onPress={() => router.push(`/(app)/race/${item.id}` as any)}
                >
                  <Text style={styles.startButtonText}>{t.plans.startButton}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* FAB → new race */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/race/new')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Context menu */}
      <Modal
        visible={menuPlanId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPlanId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuPlanId(null)}>
          <View style={styles.menuSheet}>
            {selectedPlan && (
              <Text style={styles.menuTitle} numberOfLines={1}>{selectedPlan.name}</Text>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMenuPlanId(null); router.push(`/(app)/plan/${menuPlanId}/edit` as any); }}
            >
              <Text style={styles.menuItemText}>✏️  {t.plans.editButton}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => menuPlanId && handleDelete(menuPlanId)}
            >
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>🗑️  {t.plans.deleteButton}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuCancel]}
              onPress={() => setMenuPlanId(null)}
            >
              <Text style={styles.menuCancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 24 },
  errorText: { color: '#ef4444', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryButton: { backgroundColor: '#1e293b', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryButtonText: { color: '#f1f5f9', fontSize: 15 },
  list: { padding: 16, gap: 4, paddingBottom: 100 },
  listEmpty: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 10,
    marginTop: 8,
  },
  sectionCollapseIcon: { color: '#475569', fontSize: 11, width: 14 },
  sectionTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', flex: 1 },
  editRaceText: { color: '#94a3b8', fontSize: 12 },
  addPlanBtn: {
    backgroundColor: '#1e293b',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  addPlanBtnText: { color: '#22c55e', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  orphanWarning: { color: '#fbbf24', fontSize: 12, paddingHorizontal: 4, paddingBottom: 8 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginLeft: 22,
  },
  cardContent: { flex: 1, marginRight: 12 },
  planName: { fontSize: 15, fontWeight: '600', color: '#f1f5f9', marginBottom: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: '#94a3b8' },
  metaDate: { fontSize: 13, color: '#475569' },
  cardActions: { alignItems: 'flex-end', gap: 8 },
  menuButton: { paddingHorizontal: 8, paddingVertical: 2 },
  menuButtonText: { color: '#94a3b8', fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  startButton: { backgroundColor: '#14532d', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  startButtonText: { color: '#22c55e', fontWeight: '700', fontSize: 13 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#22c55e', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6,
  },
  fabText: { color: '#0f172a', fontSize: 28, fontWeight: '700', lineHeight: 32 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 64 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  emptyButton: { backgroundColor: '#22c55e', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyButtonText: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingTop: 8, paddingHorizontal: 8 },
  menuTitle: { color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  menuItem: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12 },
  menuItemText: { fontSize: 17, color: '#f1f5f9' },
  menuItemDanger: { color: '#ef4444' },
  menuDivider: { height: 1, backgroundColor: '#334155', marginHorizontal: 8 },
  menuCancel: { marginTop: 8, backgroundColor: '#334155', alignItems: 'center' },
  menuCancelText: { fontSize: 17, color: '#94a3b8', fontWeight: '600' },
});
