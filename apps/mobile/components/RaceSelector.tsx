import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { Text } from './themed/Text';

type RaceRow = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number | null;
  location_text: string | null;
};

type SelectableRaceRow = RaceRow & { elevation_gain_m: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (race: SelectableRaceRow) => void;
  userId?: string | null;
};

export function RaceSelector({ visible, onClose, onSelect }: Props) {
  const { t } = useI18n();
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchRaces = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('races')
        .select('id, name, distance_km, elevation_gain_m, location_text')
        .eq('is_live', true)
        .eq('is_public', true)
        .order('name');

      if (error) throw error;
      setRaces((data ?? []) as RaceRow[]);
    } catch {
      setRaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setSearch('');
      void fetchRaces();
    }
  }, [visible, fetchRaces]);

  const filtered = search.trim()
    ? races.filter((race) => race.name.toLowerCase().includes(search.trim().toLowerCase()))
    : races;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable accessible={false} style={styles.overlay} onPress={onClose}>
        <Pressable accessibilityViewIsModal style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>{t.planForm.selectRaceTitle}</Text>
          <Text style={styles.subtitle}>{t.planForm.selectRaceSubtitle}</Text>

          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={`${t.common.search}…`}
            placeholderTextColor="#475569"
            autoFocus
          />

          {loading ? (
            <ActivityIndicator color="#22c55e" style={{ marginVertical: 24 }} />
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>{t.races.noRaces}</Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(race) => race.id}
              style={styles.list}
              renderItem={({ item: race }) => {
                const canSelectRace = race.elevation_gain_m !== null;
                return (
                  <TouchableOpacity
                    style={styles.raceCard}
                    disabled={!canSelectRace}
                    activeOpacity={canSelectRace ? 0.7 : 1}
                    onPress={() => {
                      if (!canSelectRace) return;
                      onSelect(race as SelectableRaceRow);
                      onClose();
                    }}
                  >
                    <View style={styles.raceInfo}>
                      <Text style={styles.raceName}>{race.name}</Text>
                      <Text style={styles.raceMeta}>
                        {race.distance_km} km · {race.elevation_gain_m === null ? 'D+ non renseigné' : `D+ ${race.elevation_gain_m}m`}
                        {race.location_text ? ` · ${race.location_text}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
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
    backgroundColor: '#0f172a',
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
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 16 },
  searchInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#f1f5f9',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  list: { maxHeight: 400 },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginVertical: 24 },
  raceCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  raceInfo: { flex: 1 },
  raceName: { color: '#f1f5f9', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  raceMeta: { color: '#94a3b8', fontSize: 13 },
});
