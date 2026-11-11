import { useCallback, useEffect, useState } from 'react';
import { colors, radius, spacing } from '@pace-yourself/design-system';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';

import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { Button } from './themed/Button';
import { Field } from './themed/Field';
import { SheetHeader } from './themed/SheetHeader';
import { Text } from './themed/Text';

type RaceRow = { id: string; name: string; distance_km: number; elevation_gain_m: number | null; location_text: string | null };
type SelectableRaceRow = RaceRow & { elevation_gain_m: number };
type Props = { visible: boolean; onClose: () => void; onSelect: (race: SelectableRaceRow) => void; userId?: string | null };

export function RaceSelector({ visible, onClose, onSelect }: Props) {
  const { t } = useI18n();
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [search, setSearch] = useState('');

  const fetchRaces = useCallback(async () => {
    setLoading(true);
    setHasLoadError(false);
    try {
      const { data, error } = await supabase.from('races').select('id, name, distance_km, elevation_gain_m, location_text').eq('is_live', true).eq('is_public', true).order('name');
      if (error) throw error;
      setRaces((data ?? []) as RaceRow[]);
    } catch {
      setHasLoadError(true);
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

  const filtered = search.trim() ? races.filter((race) => race.name.toLowerCase().includes(search.trim().toLowerCase())) : races;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable accessible={false} style={styles.overlay} onPress={onClose}>
        <Pressable accessibilityViewIsModal style={styles.sheet} onPress={() => {}}>
          <SheetHeader
            closeLabel={t.common.close}
            onClose={onClose}
            style={styles.header}
            subtitle={t.planForm.selectRaceSubtitle}
            title={t.planForm.selectRaceTitle}
          />
          <Field accessibilityLabel={t.common.search} autoFocus containerStyle={styles.searchField} onChangeText={setSearch} placeholder={`${t.common.search}…`} value={search} variant="search" />

          {loading ? <ActivityIndicator color={colors.brand.forest} style={styles.loader} /> : hasLoadError ? (
            <View style={styles.feedbackState}>
              <Text style={styles.errorText}>{t.catalog.loadError}</Text>
              <Button onPress={() => void fetchRaces()} variant="secondary">{t.common.retry}</Button>
            </View>
          ) : filtered.length === 0 ? <Text style={styles.emptyText}>{t.races.noRaces}</Text> : (
            <FlatList
              data={filtered}
              keyExtractor={(race) => race.id}
              style={styles.list}
              renderItem={({ item: race }) => {
                const canSelectRace = race.elevation_gain_m !== null;
                return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !canSelectRace }} style={[styles.raceCard, !canSelectRace && styles.raceCardDisabled]} disabled={!canSelectRace} activeOpacity={canSelectRace ? 0.7 : 1} onPress={() => { if (canSelectRace) { onSelect(race as SelectableRaceRow); onClose(); } }}>
                  <View style={styles.raceInfo}>
                    <Text style={styles.raceName}>{race.name}</Text>
                    <Text style={styles.raceMeta}>{race.distance_km} km · {race.elevation_gain_m === null ? t.planForm.elevationMissing : `D+ ${race.elevation_gain_m}m`}{race.location_text ? ` · ${race.location_text}` : ''}</Text>
                  </View>
                </TouchableOpacity>;
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(31,36,16,0.42)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface.cream, borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[10], maxHeight: '85%' },
  header: { marginBottom: spacing[4] },
  searchField: { marginBottom: spacing[3] },
  list: { maxHeight: 400 }, loader: { marginVertical: spacing[6] }, feedbackState: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
  errorText: { color: colors.text.secondary, textAlign: 'center', fontSize: 15, lineHeight: 21 }, emptyText: { color: colors.text.secondary, textAlign: 'center', marginVertical: spacing[6] },
  raceCard: { minHeight: 68, backgroundColor: colors.surface.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border.subtle, padding: spacing[3], marginBottom: spacing[2], flexDirection: 'row', alignItems: 'center' },
  raceCardDisabled: { backgroundColor: colors.surface.sandLight, opacity: 0.62 }, raceInfo: { flex: 1 },
  raceName: { color: colors.text.primary, fontSize: 15, lineHeight: 20, fontWeight: '700', marginBottom: 2 }, raceMeta: { color: colors.text.secondary, fontSize: 13, lineHeight: 18 },
});
