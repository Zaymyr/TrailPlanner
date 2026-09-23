import Ionicons from '@expo/vector-icons/Ionicons';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';
import { StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { Card } from '../themed/Card';
import { Text } from '../themed/Text';

export type RacebookGearItem = {
  id: string | null;
  label: string;
  cold: boolean;
  heat: boolean;
  note: string | null;
};

export type RacebookGearSectionCopy = {
  requiredTitle: string;
  recommendedTitle: string;
  weatherTitle: string;
  emptyMessage: string;
  coldWeather: string;
  hotWeather: string;
};

export type RacebookGearSectionProps = {
  requiredItems: RacebookGearItem[];
  recommendedItems: RacebookGearItem[];
  weatherItems: RacebookGearItem[];
  notes: string[];
  theme: ResolvedRacebookTheme;
  copy: RacebookGearSectionCopy;
};

function WeatherIcons({ item, copy }: { item: RacebookGearItem; copy: RacebookGearSectionCopy }) {
  if (!item.cold && !item.heat) return null;

  return (
    <View style={styles.weatherIcons}>
      {item.cold ? (
        <View accessible accessibilityLabel={copy.coldWeather} style={[styles.weatherIcon, styles.coldIcon]}>
          <Ionicons color="#2474A6" name="snow-outline" size={14} />
        </View>
      ) : null}
      {item.heat ? (
        <View accessible accessibilityLabel={copy.hotWeather} style={[styles.weatherIcon, styles.heatIcon]}>
          <Ionicons color="#B45309" name="sunny-outline" size={14} />
        </View>
      ) : null}
    </View>
  );
}

function GearRow({ item, copy, theme }: { item: RacebookGearItem; copy: RacebookGearSectionCopy; theme: ResolvedRacebookTheme }) {
  return (
    <View
      accessible
      accessibilityLabel={[item.label, item.cold ? copy.coldWeather : null, item.heat ? copy.hotWeather : null]
        .filter(Boolean)
        .join(', ')}
      style={styles.gearRow}
    >
      <View style={[styles.itemMarker, { backgroundColor: theme.primaryColor }]} />
      <Text numberOfLines={2} style={styles.gearLabel}>
        {item.label}
      </Text>
      <WeatherIcons copy={copy} item={item} />
    </View>
  );
}

function GearGroup({
  title,
  items,
  copy,
  theme,
}: {
  title: string;
  items: RacebookGearItem[];
  copy: RacebookGearSectionCopy;
  theme: ResolvedRacebookTheme;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.primaryColor }]}>{title}</Text>
      <View style={styles.groupList}>
        {items.map((item, index) => (
          <GearRow
            copy={copy}
            item={item}
            key={item.id ?? `${item.label}-${index}`}
            theme={theme}
          />
        ))}
      </View>
    </View>
  );
}

export function RacebookGearSection({
  requiredItems,
  recommendedItems,
  weatherItems,
  notes,
  theme,
  copy,
}: RacebookGearSectionProps) {
  const hasItems = requiredItems.length + recommendedItems.length + weatherItems.length > 0;

  if (!hasItems && notes.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyText}>{copy.emptyMessage}</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <GearGroup copy={copy} items={requiredItems} theme={theme} title={copy.requiredTitle} />
      <GearGroup copy={copy} items={recommendedItems} theme={theme} title={copy.recommendedTitle} />
      <GearGroup copy={copy} items={weatherItems} theme={theme} title={copy.weatherTitle} />

      {notes.length > 0 ? (
        <View style={styles.noteBlock}>
          <Ionicons color={Colors.textSecondary} name="information-circle-outline" size={18} />
          <View style={styles.noteContent}>
            {notes.map((note, index) => (
              <Text key={`${note}-${index}`} style={styles.noteText}>
                {note}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 18 },
  emptyCard: { padding: 16 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  group: { gap: 8 },
  groupTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  groupList: { borderTopWidth: 1, borderTopColor: Colors.border },
  gearRow: {
    minHeight: 44,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemMarker: { width: 7, height: 7, marginHorizontal: 8, borderRadius: 4 },
  gearLabel: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  weatherIcons: { flexDirection: 'row', gap: 4 },
  weatherIcon: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  coldIcon: { backgroundColor: '#E7F3FA' },
  heatIcon: { backgroundColor: '#FFF3DE' },
  noteBlock: {
    padding: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
  },
  noteContent: { flex: 1, gap: 4 },
  noteText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
});
