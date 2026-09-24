import Ionicons from '@expo/vector-icons/Ionicons';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { getRacebookGearItemKey, type RacebookGearGroupKey } from '../../lib/racebookGearChecklist';
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
  checkedLabel: string;
  uncheckedLabel: string;
  progressLabel: string;
};

export type RacebookGearSectionProps = {
  requiredItems: RacebookGearItem[];
  recommendedItems: RacebookGearItem[];
  weatherItems: RacebookGearItem[];
  notes: string[];
  theme: ResolvedRacebookTheme;
  copy: RacebookGearSectionCopy;
  checkedItemKeys: ReadonlySet<string>;
  pendingItemKeys: ReadonlySet<string>;
  onToggleItem: (itemKey: string, checked: boolean) => void;
};

const EMPTY_ITEM_KEYS = new Set<string>();
const NOOP_TOGGLE = () => undefined;

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

function GearRow({
  item,
  itemKey,
  checked,
  pending,
  copy,
  theme,
  onToggle,
}: {
  item: RacebookGearItem;
  itemKey: string;
  checked: boolean;
  pending: boolean;
  copy: RacebookGearSectionCopy;
  theme: ResolvedRacebookTheme;
  onToggle: (itemKey: string, checked: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, busy: pending }}
      accessibilityLabel={[item.label, checked ? copy.checkedLabel : copy.uncheckedLabel, item.cold ? copy.coldWeather : null, item.heat ? copy.hotWeather : null]
        .filter(Boolean)
        .join(', ')}
      disabled={pending}
      onPress={() => onToggle(itemKey, !checked)}
      style={({ pressed }) => [styles.gearRow, checked ? { backgroundColor: theme.accentSurfaceColor } : null, pressed ? styles.gearRowPressed : null]}
    >
      <View style={[styles.checkBox, { borderColor: checked ? theme.accentBorderColor : Colors.border }, checked ? { backgroundColor: theme.accentGraphicColor } : null]}>
        {checked ? <Ionicons color={Colors.surface} name="checkmark" size={15} /> : null}
      </View>
      <Text numberOfLines={2} style={[styles.gearLabel, checked ? styles.gearLabelChecked : null]}>
        {item.label}
      </Text>
      <WeatherIcons copy={copy} item={item} />
    </Pressable>
  );
}

function GearGroup({
  title,
  items,
  copy,
  theme,
  groupKey,
  checkedItemKeys,
  pendingItemKeys,
  onToggleItem,
}: {
  title: string;
  items: RacebookGearItem[];
  copy: RacebookGearSectionCopy;
  theme: ResolvedRacebookTheme;
  groupKey: RacebookGearGroupKey;
  checkedItemKeys: ReadonlySet<string>;
  pendingItemKeys: ReadonlySet<string>;
  onToggleItem: (itemKey: string, checked: boolean) => void;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.accentForegroundColor }]}>{title}</Text>
      <View style={styles.groupList}>
        {items.map((item, index) => {
          const itemKey = getRacebookGearItemKey(groupKey, item);
          return (
            <GearRow
              checked={checkedItemKeys.has(itemKey)}
              copy={copy}
              item={item}
              itemKey={itemKey}
              key={item.id ?? `${item.label}-${index}`}
              onToggle={onToggleItem}
              pending={pendingItemKeys.has(itemKey)}
              theme={theme}
            />
          );
        })}
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
  checkedItemKeys = EMPTY_ITEM_KEYS,
  pendingItemKeys = EMPTY_ITEM_KEYS,
  onToggleItem = NOOP_TOGGLE,
}: RacebookGearSectionProps) {
  const hasItems = requiredItems.length + recommendedItems.length + weatherItems.length > 0;
  const totalItems = requiredItems.length + recommendedItems.length + weatherItems.length;
  const allItemKeys = [
    ...requiredItems.map((item) => getRacebookGearItemKey('required', item)),
    ...recommendedItems.map((item) => getRacebookGearItemKey('recommended', item)),
    ...weatherItems.map((item) => getRacebookGearItemKey('weather', item)),
  ];
  const checkedCount = allItemKeys.filter((itemKey) => checkedItemKeys.has(itemKey)).length;

  if (!hasItems && notes.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyText}>{copy.emptyMessage}</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      {totalItems > 0 ? (
        <View style={[styles.progress, { backgroundColor: theme.accentSurfaceColor, borderColor: theme.accentBorderColor }]}>
          <View style={[styles.progressIcon, { backgroundColor: theme.accentGraphicColor }]}>
            <Ionicons color={Colors.surface} name={checkedCount === totalItems ? 'checkmark-done' : 'checkmark'} size={17} />
          </View>
          <Text style={[styles.progressText, { color: theme.accentForegroundColor }]}>
            {copy.progressLabel.replace('{checked}', String(checkedCount)).replace('{total}', String(totalItems))}
          </Text>
        </View>
      ) : null}
      <GearGroup checkedItemKeys={checkedItemKeys} copy={copy} groupKey="required" items={requiredItems} onToggleItem={onToggleItem} pendingItemKeys={pendingItemKeys} theme={theme} title={copy.requiredTitle} />
      <GearGroup checkedItemKeys={checkedItemKeys} copy={copy} groupKey="recommended" items={recommendedItems} onToggleItem={onToggleItem} pendingItemKeys={pendingItemKeys} theme={theme} title={copy.recommendedTitle} />
      <GearGroup checkedItemKeys={checkedItemKeys} copy={copy} groupKey="weather" items={weatherItems} onToggleItem={onToggleItem} pendingItemKeys={pendingItemKeys} theme={theme} title={copy.weatherTitle} />

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
  progress: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  progressIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  progressText: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '800' },
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
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  gearRowPressed: { opacity: 0.72 },
  checkBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 2 },
  gearLabel: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  gearLabelChecked: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
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
