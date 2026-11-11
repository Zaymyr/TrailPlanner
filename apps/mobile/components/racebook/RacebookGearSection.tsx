import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Colors } from '../../constants/colors';
import { getRacebookGearItemKey, type RacebookGearGroupKey } from '../../lib/racebookGearChecklist';
import { Card } from '../themed/Card';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { StampMark } from '../themed/trail/StampMark';

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
/** Above this many items the trail keeps only its start dot and finish marker. */
const MAX_PROGRESS_DOTS = 12;

/**
 * Static progress drawn as a trail: dashed path, one dot per item (or just
 * start and finish when the list is long), solid leg up to the last checked
 * item, square finish marker. No animation.
 */
function GearProgressTrail({ checked, total }: { checked: number; total: number }) {
  const compact = total > MAX_PROGRESS_DOTS;
  const markerCount = compact ? 2 : total;
  const complete = total > 0 && checked >= total;
  const fraction = compact
    ? checked / total
    : total <= 1 ? (checked > 0 ? 1 : 0) : Math.max(0, checked - 1) / (total - 1);

  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.trail}>
      <View style={styles.trailTrack}>
        <Svg accessible={false} height={2} pointerEvents="none" width="100%">
          <Line stroke={Colors.borderStrong} strokeDasharray={[4, 3]} strokeWidth={2} x1="0" x2="100%" y1="1" y2="1" />
        </Svg>
        {fraction > 0 ? <View style={[styles.trailLeg, { width: `${Math.min(1, fraction) * 100}%` }]} /> : null}
      </View>
      {Array.from({ length: markerCount }, (_, index) => {
        const isFinish = index === markerCount - 1;
        const filled = compact
          ? (isFinish ? complete : checked > 0)
          : index < checked;
        return (
          <View
            key={index}
            style={[
              isFinish ? styles.trailFinish : styles.trailDot,
              filled ? styles.trailMarkerFilled : null,
            ]}
          />
        );
      })}
    </View>
  );
}

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
      style={({ pressed }) => [styles.gearRow, pending ? styles.gearRowPending : null, pressed ? styles.gearRowPressed : null]}
    >
      <StampMark checked={checked} variationKey={itemKey} />
      <Text numberOfLines={2} style={[styles.gearLabel, checked ? styles.gearLabelChecked : null]}>
        {item.label}
      </Text>
      <WeatherIcons copy={copy} item={item} />
      {checked ? (
        <DataText accessible={false} size="xs" weight="semibold" style={styles.stampedLabel}>
          {copy.checkedLabel.toLocaleUpperCase()}
        </DataText>
      ) : null}
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
  const progressText = copy.progressLabel.replace('{checked}', String(checkedCount)).replace('{total}', String(totalItems));
  // "{checked}/{total} prêts" -> big mono count, then the rest as a spaced caption.
  const [progressBefore, progressAfter = ''] = copy.progressLabel.split('{checked}');

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
        <View
          accessible
          accessibilityLabel={progressText}
          style={[styles.progress, checklistComplete ? styles.progressComplete : null]}
        >
          <View style={styles.progressCount}>
            {progressBefore ? (
              <DataText size="xs" weight="semibold" style={styles.progressCaption}>
                {progressBefore.replace('{total}', String(totalItems)).toLocaleUpperCase()}
              </DataText>
            ) : null}
            <DataText size="xl" weight="bold" style={styles.progressNumber}>{checkedCount}</DataText>
            <DataText size="xs" weight="semibold" style={styles.progressCaption}>
              {progressAfter.replace('{total}', String(totalItems)).replace('/', '/ ').toLocaleUpperCase()}
            </DataText>
          </View>
          <GearProgressTrail checked={checkedCount} total={totalItems} />
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
  progress: { gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  progressComplete: { borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface },
  progressCount: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  progressNumber: { color: Colors.textPrimary },
  progressCaption: { color: Colors.textSecondary, letterSpacing: 1.6 },
  trail: { minHeight: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Dot centres sit 6pt from each end (12pt dots), so the path spans between them.
  trailTrack: { position: 'absolute', left: 6, right: 6, top: 7, height: 2 },
  trailLeg: { position: 'absolute', left: 0, top: 0, height: 2, backgroundColor: Colors.brandPrimary },
  trailDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  trailFinish: { width: 16, height: 16, borderRadius: 3, borderWidth: 2, borderColor: Colors.brandPrimary, backgroundColor: Colors.surface },
  trailMarkerFilled: { borderColor: Colors.brandPrimary, backgroundColor: Colors.brandPrimary },
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
  groupTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  groupList: {},
  gearRow: {
    minHeight: 44,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 4,
  },
  gearRowPressed: { opacity: 0.72 },
  gearRowPending: { opacity: 0.6 },
  gearLabel: { flex: 1, color: Colors.textPrimary, fontSize: 16, fontWeight: '600', lineHeight: 21 },
  gearLabelChecked: { color: Colors.textSecondary },
  stampedLabel: { color: Colors.brandPrimary, fontSize: 10, letterSpacing: 1.4 },
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
