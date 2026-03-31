import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  SafeAreaView,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { Colors } from '../../constants/colors';
import { usePremium } from '../../hooks/usePremium';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type PickerRace = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  thumbnail_url?: string | null;
};

type PickerEventGroup = {
  id: string;
  name: string;
  location: string | null;
  race_date: string | null;
  thumbnail_url?: string | null;
  races: PickerRace[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatEventDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getRacePickerLabel(raceName: string, eventName: string): string {
  const cleaned = raceName.replace(eventName, '').replace(/[\s\-–—·]+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned : raceName;
}

function getPickerEventImageUrl(event: Pick<PickerEventGroup, 'thumbnail_url' | 'races'>): string | null {
  return event.thumbnail_url ?? event.races.find((race) => race.thumbnail_url)?.thumbnail_url ?? null;
}

const FREE_PLAN_LIMIT = 1;

// ─── Race Picker sub-components ───────────────────────────────────────────────

function PickerRaceCard({
  race,
  eventName,
  flex,
  onSelect,
}: {
  race: PickerRace;
  eventName: string;
  flex?: boolean;
  onSelect: (race: PickerRace) => void;
}) {
  const label = getRacePickerLabel(race.name, eventName);
  return (
    <View style={[pStyles.raceCard, flex ? { flex: 1 } : pStyles.raceCardFixed]}>
      <Text style={pStyles.raceLabel} numberOfLines={2}>{label}</Text>
      <Text style={pStyles.raceStats}>{race.distance_km} km{'  '}D+{race.elevation_gain_m}m</Text>
      <TouchableOpacity style={pStyles.selectBtn} onPress={() => onSelect(race)}>
        <Text style={pStyles.selectBtnText}>Sélectionner</Text>
      </TouchableOpacity>
    </View>
  );
}

function PersonalPickerCard({
  race,
  flex,
  onSelect,
}: {
  race: PickerRace;
  flex?: boolean;
  onSelect: (race: PickerRace) => void;
}) {
  return (
    <View style={[pStyles.raceCard, flex ? { flex: 1 } : pStyles.raceCardFixed]}>
      <Text style={pStyles.raceLabel} numberOfLines={2}>{race.name}</Text>
      <Text style={pStyles.raceStats}>{race.distance_km} km{'  '}D+{race.elevation_gain_m}m</Text>
      <TouchableOpacity style={pStyles.selectBtn} onPress={() => onSelect(race)}>
        <Text style={pStyles.selectBtnText}>Sélectionner</Text>
      </TouchableOpacity>
    </View>
  );
}

function PersonalPickerSection({ races, onSelect }: { races: PickerRace[]; onSelect: (race: PickerRace) => void }) {
  const useFlex = races.length <= 2;
  return (
    <View style={[pStyles.eventCard, pStyles.personalCard]}>
      <View style={pStyles.eventHeader}>
        <Text style={pStyles.eventHeaderEmoji}>🗺️</Text>
        <View style={{ flex: 1 }}>
          <Text style={pStyles.eventName}>Mes courses</Text>
        </View>
      </View>
      <View style={pStyles.divider} />
      {useFlex ? (
        <View style={pStyles.racesRow}>
          {races.map((r) => <PersonalPickerCard key={r.id} race={r} flex onSelect={onSelect} />)}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pStyles.racesScrollContent}>
          {races.map((r) => <PersonalPickerCard key={r.id} race={r} onSelect={onSelect} />)}
        </ScrollView>
      )}
    </View>
  );
}

function EventPickerCard({ event, onSelect }: { event: PickerEventGroup; onSelect: (race: PickerRace) => void }) {
  const dateStr = formatEventDate(event.race_date);
  const headerMeta = [event.location, dateStr].filter(Boolean).join(' · ');
  const useFlex = event.races.length <= 2;
  const eventImageUrl = getPickerEventImageUrl(event);
  return (
    <View style={[pStyles.eventCard, eventImageUrl ? pStyles.eventCardWithImage : null]}>
      {eventImageUrl ? (
        <ImageBackground
          source={{ uri: eventImageUrl }}
          imageStyle={pStyles.eventCardImage}
          style={pStyles.eventCardImageFill}
        >
          <View style={pStyles.eventCardImageOverlay} />
        </ImageBackground>
      ) : null}
      <View style={pStyles.eventHeader}>
        <Text style={pStyles.eventHeaderEmoji}>🏔️</Text>
        <View style={{ flex: 1 }}>
          <Text style={pStyles.eventName}>{event.name}</Text>
          {headerMeta ? <Text style={pStyles.eventMeta}>{headerMeta}</Text> : null}
        </View>
      </View>
      <View style={pStyles.divider} />
      {useFlex ? (
        <View style={pStyles.racesRow}>
          {event.races.map((r) => (
            <PickerRaceCard key={r.id} race={r} eventName={event.name} flex onSelect={onSelect} />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pStyles.racesScrollContent}>
          {event.races.map((r) => (
            <PickerRaceCard key={r.id} race={r} eventName={event.name} onSelect={onSelect} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlansScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { isPremium } = usePremium();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [raceOwnership, setRaceOwnership] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Race picker modal state
  const [showRacePicker, setShowRacePicker] = useState(false);
  const [pickerEvents, setPickerEvents] = useState<PickerEventGroup[]>([]);
  const [pickerPersonal, setPickerPersonal] = useState<PickerRace[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const fetchData = useCallback(async () => {
    let cancelled = false;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id ?? null;
    if (!cancelled) setUserId(uid);

    const [planResult] = await Promise.all([
      supabase
        .from('race_plans')
        .select('id, name, updated_at, race_id, planner_values, races(name)')
        .order('updated_at', { ascending: false }),
    ]);

    if (cancelled) return;

    if (planResult.error) {
      setError(planResult.error.message);
    } else if (planResult.data) {
      setPlans(planResult.data as PlanRow[]);

      const raceIds = [...new Set((planResult.data as PlanRow[]).filter((p) => p.race_id).map((p) => p.race_id!))];
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

  async function openRacePicker() {
    if (!isPremium && plans.length >= FREE_PLAN_LIMIT) {
      Alert.alert(
        'Limite atteinte',
        `Les utilisateurs gratuits peuvent créer ${FREE_PLAN_LIMIT} plan. Passez en Premium pour des plans illimités.`,
        [{ text: 'OK' }],
      );
      return;
    }
    setShowRacePicker(true);
    setPickerLoading(true);
    try {
      const uid = userId;
      const [eventsResult, orphansResult, personalResult] = await Promise.all([
        supabase
          .from('race_events')
          .select('id, name, location, race_date, thumbnail_url, races(id, name, distance_km, elevation_gain_m, thumbnail_url)')
          .eq('is_live', true)
          .order('name'),
        supabase
          .from('races')
          .select('id, name, distance_km, elevation_gain_m, thumbnail_url')
          .eq('is_live', true)
          .is('event_id', null),
        uid
          ? supabase
              .from('races')
              .select('id, name, distance_km, elevation_gain_m, thumbnail_url')
              .eq('is_public', false)
              .eq('created_by', uid)
          : Promise.resolve({ data: [] as PickerRace[], error: null }),
      ]);

      const groups: PickerEventGroup[] = (eventsResult.data ?? []) as PickerEventGroup[];
      const orphans = (orphansResult.data ?? []) as PickerRace[];
      if (orphans.length > 0) {
        groups.push({ id: '__orphans__', name: 'Autres courses', location: null, race_date: null, races: orphans });
      }
      setPickerEvents(groups);
      setPickerPersonal(((personalResult as any).data ?? []) as PickerRace[]);
    } finally {
      setPickerLoading(false);
    }
  }

  function handlePickRace(race: PickerRace) {
    setShowRacePicker(false);
    router.push({ pathname: '/(app)/plan/new', params: { raceId: race.id, raceName: race.name } });
  }

  function handleCreatePlan(raceId: string) {
    router.push({ pathname: '/(app)/plan/new', params: { raceId } });
  }

  const handleDelete = (planId: string) => {
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

    for (const [key, planList] of Object.entries(grouped)) {
      if (key === '__orphan__') continue;
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.brandPrimary} size="large" /></View>;
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
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <SectionList
        sections={sections.map((s) => ({ ...s, key: s.raceId ?? '__orphan__' }))}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, sections.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            tintColor={Colors.brandPrimary}
          />
        }
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏔️</Text>
            <Text style={styles.emptyTitle}>{t.plans.empty}</Text>
            <Text style={styles.emptySubtitle}>{t.plans.emptySubtitle}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openRacePicker}>
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
              {section.raceId && (
                <TouchableOpacity
                  style={styles.addPlanBtn}
                  onPress={() => handleCreatePlan(section.raceId!)}
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
            return <Text style={styles.orphanWarning}>{t.plans.noRaceWarning}</Text>;
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
                <View style={styles.cardIconActions}>
                  <TouchableOpacity
                    onPress={() => router.push(`/(app)/plan/${item.id}/edit` as any)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="create-outline" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
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

      {/* FAB → race picker */}
      <TouchableOpacity style={styles.fab} onPress={openRacePicker} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── Race Picker Modal ── */}
      <Modal
        visible={showRacePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRacePicker(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          {/* Header */}
          <View style={pStyles.header}>
            <Text style={pStyles.headerTitle}>Choisir une course</Text>
            <TouchableOpacity
              onPress={() => setShowRacePicker(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Create new race shortcut */}
          <TouchableOpacity
            style={pStyles.newRaceRow}
            onPress={() => { setShowRacePicker(false); router.push('/(app)/race/new'); }}
          >
            <Ionicons name="add-circle-outline" size={18} color={Colors.brandPrimary} />
            <Text style={pStyles.newRaceText}>Créer une nouvelle course</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Body */}
          {pickerLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color={Colors.brandPrimary} size="large" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={pStyles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {pickerPersonal.length > 0 && (
                <PersonalPickerSection races={pickerPersonal} onSelect={handlePickRace} />
              )}

              {pickerEvents.map((event) => (
                <EventPickerCard key={event.id} event={event} onSelect={handlePickRace} />
              ))}

              {pickerPersonal.length === 0 && pickerEvents.length === 0 && (
                <View style={pStyles.emptyPicker}>
                  <Text style={pStyles.emptyPickerIcon}>🏁</Text>
                  <Text style={pStyles.emptyPickerText}>Aucune course disponible</Text>
                  <Text style={pStyles.emptyPickerSub}>Créez votre première course avec le bouton ci-dessus.</Text>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ─── Plans screen styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 24 },
  errorText: { color: Colors.danger, fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryButton: { backgroundColor: Colors.surface, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryButtonText: { color: Colors.textPrimary, fontSize: 15 },
  list: { padding: 16, gap: 4, paddingBottom: 100 },
  listEmpty: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: Colors.background,
  },
  sectionCollapseIcon: { color: Colors.brandPrimary, fontSize: 11, width: 14 },
  sectionTitle: { color: Colors.brandPrimary, fontSize: 15, fontWeight: '600', flex: 1 },
  editRaceText: { color: Colors.textSecondary, fontSize: 12 },
  addPlanBtn: {
    backgroundColor: Colors.surface,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addPlanBtnText: { color: Colors.brandPrimary, fontSize: 18, fontWeight: '700', lineHeight: 22 },
  orphanWarning: { color: Colors.warning, fontSize: 12, paddingHorizontal: 4, paddingBottom: 8 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginLeft: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: { flex: 1, marginRight: 12 },
  planName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: Colors.textSecondary },
  metaDate: { fontSize: 13, color: Colors.textMuted },
  cardActions: { alignItems: 'flex-end', gap: 8 },
  cardIconActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6 },
  startButton: { backgroundColor: Colors.brandPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  startButtonText: { color: Colors.textOnBrand, fontWeight: '700', fontSize: 13 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.brandPrimary, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: Colors.brandPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  fabText: { color: Colors.textOnBrand, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 64 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  emptyButton: { backgroundColor: Colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyButtonText: { color: Colors.textOnBrand, fontSize: 16, fontWeight: '700' },
});

// ─── Race Picker Modal styles ─────────────────────────────────────────────────

const pStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  newRaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  newRaceText: { flex: 1, fontSize: 15, color: Colors.brandPrimary, fontWeight: '600' },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  // Event cards — same structure as catalog.tsx
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  eventCardWithImage: {
    overflow: 'hidden',
  },
  eventCardImageFill: {
    ...StyleSheet.absoluteFillObject,
  },
  eventCardImage: {
    borderRadius: 16,
  },
  eventCardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  personalCard: {
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventHeaderEmoji: { fontSize: 22, lineHeight: 26 },
  eventName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  eventMeta: { fontSize: 13, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  racesRow: { flexDirection: 'row', gap: 10 },
  racesScrollContent: { flexDirection: 'row', gap: 10 },
  raceCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    minWidth: 140,
  },
  raceCardFixed: { width: 150 },
  raceLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  raceStats: { fontSize: 12, color: Colors.textSecondary },
  selectBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
    marginTop: 8,
  },
  selectBtnText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '600' },
  emptyPicker: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyPickerIcon: { fontSize: 48, marginBottom: 12 },
  emptyPickerText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyPickerSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
