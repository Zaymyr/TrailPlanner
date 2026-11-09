import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

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
  decathlonTitle: string;
  decathlonDescription: string;
  decathlonAction: string;
  affiliateDisclosure: string;
};

export type RacebookGearSectionProps = {
  requiredItems: RacebookGearItem[];
  recommendedItems: RacebookGearItem[];
  weatherItems: RacebookGearItem[];
  notes: string[];
  copy: RacebookGearSectionCopy;
  checkedItemKeys: ReadonlySet<string>;
  pendingItemKeys: ReadonlySet<string>;
  onToggleItem: (itemKey: string, checked: boolean) => void;
  decathlonLink?: { isAffiliate: boolean } | null;
  /** Logo of an organizer partner replacing the default affiliate card. */
  decathlonLogoUrl?: string | null;
  onOpenDecathlonLink?: () => void;
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
  onToggle,
}: {
  item: RacebookGearItem;
  itemKey: string;
  checked: boolean;
  pending: boolean;
  copy: RacebookGearSectionCopy;
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
      style={({ pressed }) => [styles.gearRow, checked ? styles.gearRowChecked : null, pressed ? styles.gearRowPressed : null]}
    >
      <View style={[styles.checkBox, { borderColor: checked ? Colors.brandPrimary : Colors.border }, checked ? styles.checkBoxChecked : null]}>
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
  groupKey,
  checkedItemKeys,
  pendingItemKeys,
  onToggleItem,
}: {
  title: string;
  items: RacebookGearItem[];
  copy: RacebookGearSectionCopy;
  groupKey: RacebookGearGroupKey;
  checkedItemKeys: ReadonlySet<string>;
  pendingItemKeys: ReadonlySet<string>;
  onToggleItem: (itemKey: string, checked: boolean) => void;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
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
  copy,
  checkedItemKeys = EMPTY_ITEM_KEYS,
  pendingItemKeys = EMPTY_ITEM_KEYS,
  onToggleItem = NOOP_TOGGLE,
  decathlonLink = null,
  decathlonLogoUrl = null,
  onOpenDecathlonLink = NOOP_TOGGLE,
}: RacebookGearSectionProps) {
  const hasItems = requiredItems.length + recommendedItems.length + weatherItems.length > 0;
  const totalItems = requiredItems.length + recommendedItems.length + weatherItems.length;
  const allItemKeys = [
    ...requiredItems.map((item) => getRacebookGearItemKey('required', item)),
    ...recommendedItems.map((item) => getRacebookGearItemKey('recommended', item)),
    ...weatherItems.map((item) => getRacebookGearItemKey('weather', item)),
  ];
  const checkedCount = allItemKeys.filter((itemKey) => checkedItemKeys.has(itemKey)).length;
  const checklistComplete = totalItems > 0 && checkedCount === totalItems;

  if (!hasItems && notes.length === 0 && !decathlonLink) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyText}>{copy.emptyMessage}</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      {totalItems > 0 ? (
        <View style={[styles.progress, checklistComplete ? styles.progressComplete : null]}>
          <View style={[styles.progressIcon, checklistComplete ? styles.progressIconComplete : null]}>
            <Ionicons color={checklistComplete ? Colors.surface : Colors.textMuted} name={checklistComplete ? 'checkmark-done' : 'ellipse-outline'} size={17} />
          </View>
          <Text style={[styles.progressText, checklistComplete ? styles.progressTextComplete : null]}>
            {copy.progressLabel.replace('{checked}', String(checkedCount)).replace('{total}', String(totalItems))}
          </Text>
        </View>
      ) : null}
      <GearGroup checkedItemKeys={checkedItemKeys} copy={copy} groupKey="required" items={requiredItems} onToggleItem={onToggleItem} pendingItemKeys={pendingItemKeys} title={copy.requiredTitle} />
      <GearGroup checkedItemKeys={checkedItemKeys} copy={copy} groupKey="recommended" items={recommendedItems} onToggleItem={onToggleItem} pendingItemKeys={pendingItemKeys} title={copy.recommendedTitle} />
      <GearGroup checkedItemKeys={checkedItemKeys} copy={copy} groupKey="weather" items={weatherItems} onToggleItem={onToggleItem} pendingItemKeys={pendingItemKeys} title={copy.weatherTitle} />

      {decathlonLink ? (
        <>
          <Pressable
            accessibilityLabel={`${copy.decathlonAction} - ${copy.decathlonTitle}`}
            accessibilityRole="link"
            onPress={onOpenDecathlonLink}
            style={({ pressed }) => [styles.decathlonLink, pressed ? styles.gearRowPressed : null]}
          >
            {decathlonLogoUrl ? (
              <View style={styles.partnerLogoFrame}>
                <Image accessibilityIgnoresInvertColors resizeMode="contain" source={{ uri: decathlonLogoUrl }} style={styles.partnerLogo} />
              </View>
            ) : (
              <View style={styles.decathlonIcon}>
                <Ionicons color={Colors.textOnBrand} name="bag-handle-outline" size={20} />
              </View>
            )}
            <View style={styles.decathlonContent}>
              <Text style={styles.decathlonTitle}>{copy.decathlonTitle}</Text>
              <Text style={styles.decathlonDescription}>{copy.decathlonDescription}</Text>
              <Text style={styles.decathlonAction}>{copy.decathlonAction}</Text>
            </View>
            <Ionicons color={Colors.brandPrimary} name="chevron-forward" size={20} />
          </Pressable>
          {decathlonLink.isAffiliate ? <Text style={styles.disclosure}>{copy.affiliateDisclosure}</Text> : null}
        </>
      ) : null}

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
  progress: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  progressComplete: { borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface },
  progressIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  progressIconComplete: { borderColor: Colors.brandPrimary, backgroundColor: Colors.brandPrimary },
  progressText: { flex: 1, color: Colors.textSecondary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  progressTextComplete: { color: Colors.brandPrimary },
  decathlonLink: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface },
  partnerLogoFrame: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, padding: 4 },
  partnerLogo: { width: '100%', height: '100%' },
  decathlonIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Colors.brandPrimary },
  decathlonContent: { flex: 1, gap: 2 },
  decathlonTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  decathlonDescription: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  decathlonAction: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  disclosure: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: -12 },
  emptyCard: { padding: 16 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  group: { gap: 8 },
  groupTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
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
  gearRowChecked: { backgroundColor: Colors.brandSurface },
  checkBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 2 },
  checkBoxChecked: { backgroundColor: Colors.brandPrimary },
  gearLabel: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  gearLabelChecked: { color: Colors.textPrimary },
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
