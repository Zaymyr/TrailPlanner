import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { Colors } from '../constants/colors';

type RaceRow = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  location_text: string | null;
  is_public: boolean;
  created_by: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (race: RaceRow) => void;
  userId?: string | null;
};

export function RaceSelector({ visible, onClose, onSelect, userId }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchRaces = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('races')
        .select('id, name, distance_km, elevation_gain_m, location_text, is_public, created_by')
        .eq('is_live', true)
        .order('name');

      if (!error && data) {
        setRaces(data as RaceRow[]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setSearch('');
      fetchRaces();
    }
  }, [visible, fetchRaces]);

  const filtered = search.trim()
    ? races.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    : races;

  const myRaces = filtered.filter((r) => !r.is_public && r.created_by === userId);
  const publicRaces = filtered.filter((r) => r.is_public);

  const sections: Array<{ title: string; data: RaceRow[] }> = [];
  if (myRaces.length > 0) sections.push({ title: t.races.myRaces, data: myRaces });
  if (publicRaces.length > 0) sections.push({ title: t.races.publicRaces, data: publicRaces });

  const flatData: Array<{ type: 'header'; title: string } | { type: 'item'; race: RaceRow }> = [];
  for (const section of sections) {
    flatData.push({ type: 'header', title: section.title });
    for (const race of section.data) {
      flatData.push({ type: 'item', race });
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t.planForm.selectRaceTitle}</Text>
          <Text style={styles.subtitle}>{t.planForm.selectRaceSubtitle}</Text>

          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t.common.search + '…'}
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />

          {loading ? (
            <ActivityIndicator color={Colors.brandPrimary} style={{ marginVertical: 24 }} />
          ) : flatData.length === 0 ? (
            <Text style={styles.emptyText}>{t.races.noRaces}</Text>
          ) : (
            <FlatList
              data={flatData}
              keyExtractor={(item, i) =>
                item.type === 'header' ? `h-${i}` : item.race.id
              }
              style={styles.list}
              renderItem={({ item }) => {
                if (item.type === 'header') {
                  return <Text style={styles.sectionHeader}>{item.title}</Text>;
                }
                const race = item.race;
                return (
                  <TouchableOpacity
                    style={styles.raceCard}
                    onPress={() => {
                      onSelect(race);
                      onClose();
                    }}
                  >
                    <View style={styles.raceInfo}>
                      <Text style={styles.raceName}>{race.name}</Text>
                      <Text style={styles.raceMeta}>
                        {race.distance_km} km · D+ {race.elevation_gain_m}m
                        {race.location_text ? ` · ${race.location_text}` : ''}
                      </Text>
                    </View>
                    {!race.is_public && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{t.races.myBadge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Create new race */}
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              onClose();
              router.push('/(app)/race/new');
            }}
          >
            <Text style={styles.createButtonText}>+ {t.races.newRace}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginBottom: 16 },
  searchInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  list: { maxHeight: 400 },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginVertical: 24 },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingVertical: 8,
  },
  raceCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  raceInfo: { flex: 1, marginRight: 8 },
  raceName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  raceMeta: { color: Colors.textSecondary, fontSize: 13 },
  badge: {
    backgroundColor: Colors.brandSurface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: Colors.brandPrimary, fontSize: 11, fontWeight: '700' },
  createButton: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
  },
  createButtonText: { color: Colors.brandPrimary, fontSize: 15, fontWeight: '600' },
});
