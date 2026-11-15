import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import type { RacebookSupporterPoint } from '../../lib/racebook';
import { useI18n } from '../../lib/i18n';
import { DataText } from '../themed/DataText';
import { StatusPill } from '../themed/StatusPill';
import { Text } from '../themed/Text';
import { TrailRail } from '../themed/TrailRail';
import { formatDistance } from '../../lib/displayFormat';

/** Aid station shown on the supporter course line (Livret accompagnateur). */
export type RacebookSupporterStation = {
  id: string;
  name: string;
  km: number;
  isFinish: boolean;
  supportersAccess: 'allowed' | 'restricted' | 'forbidden' | null;
  /** Already formatted, e.g. "15:00" or "sam. 01:00". */
  cutoffLabel: string | null;
  maxStopMinutes: number | null;
  services: string[];
};

type LineItem =
  | { kind: 'point'; key: string; km: number; point: RacebookSupporterPoint; index: number }
  | { kind: 'station'; key: string; km: number; station: RacebookSupporterStation };

const hasCoordinates = (point: Pick<RacebookSupporterPoint, 'latitude' | 'longitude'>) =>
  Number.isFinite(point.latitude) && Number.isFinite(point.longitude);

/** Organizer URL first, then coordinates; null when the point cannot be located. */
function resolveDirectionsUrl(point: Pick<RacebookSupporterPoint, 'googleMapsUrl' | 'latitude' | 'longitude'>) {
  if (point.googleMapsUrl) return point.googleMapsUrl;
  return hasCoordinates(point)
    ? `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`
    : null;
}

const ACCESS_TONE = { allowed: 'success', restricted: 'warning', forbidden: 'danger' } as const;

export function RacebookSupporterPointsSection({
  points,
  stations = [],
  locale,
  onOpenUrl,
}: {
  points: RacebookSupporterPoint[];
  /** Optional aid stations merged into the same kilometer-ordered line. */
  stations?: RacebookSupporterStation[];
  locale: 'fr' | 'en';
  onOpenUrl: (url: string, action: 'directions' | 'plan') => void;
}) {
  const { t } = useI18n();
  const items: LineItem[] = [
    ...points.map((point, index) => ({ kind: 'point' as const, key: `point-${point.id}`, km: point.km, point, index })),
    ...stations.map((station) => ({ kind: 'station' as const, key: `station-${station.id}`, km: station.km, station })),
  ].sort((left, right) => left.km - right.km || (left.kind === 'station' ? 1 : -1));
  const accessLabel = {
    allowed: t.supporterGuide.supportersAllowed,
    restricted: t.supporterGuide.supportersRestricted,
    forbidden: t.supporterGuide.supportersForbidden,
  };

  return (
    <View style={styles.list}>
      {items.map((item, itemIndex) => {
        const isLast = itemIndex === items.length - 1;
        if (item.kind === 'station') {
          const { station } = item;
          return (
            <View key={item.key} style={styles.row}>
              <View style={styles.rail}>
                <View style={[styles.badge, styles.stationBadge]}>
                  <Ionicons name={station.isFinish ? 'flag-outline' : 'water-outline'} size={16} color={Colors.brandPrimary} />
                </View>
                {!isLast ? <TrailRail color={Colors.brandPrimary} style={styles.line} /> : null}
              </View>
              <View style={[styles.card, styles.stationCard]}>
                <View style={styles.titleRow}>
                  <View style={styles.titleContent}>
                    <Text style={styles.kicker}>{station.isFinish ? t.supporterGuide.finish : t.supporterGuide.aidStation}</Text>
                    <Text numberOfLines={2} style={styles.title}>{station.name}</Text>
                  </View>
                  <DataText style={styles.km}>{formatDistance(station.km, locale)}</DataText>
                </View>
                {station.supportersAccess ? (
                  <StatusPill label={accessLabel[station.supportersAccess]} tone={ACCESS_TONE[station.supportersAccess]} />
                ) : null}
                {station.services.length > 0 ? (
                  <View style={styles.chips}>
                    {station.services.map((service) => (
                      <View key={service} style={styles.chip}><Text style={styles.chipText}>{service}</Text></View>
                    ))}
                  </View>
                ) : null}
                {station.cutoffLabel || station.maxStopMinutes ? (
                  <View style={styles.facts}>
                    {station.cutoffLabel ? (
                      <View style={styles.fact}>
                        <Ionicons name="time-outline" size={15} color={Colors.textSecondary} />
                        <Text style={styles.factText}>{t.supporterGuide.lastRunner}</Text>
                        <DataText style={styles.factValue}>{station.cutoffLabel}</DataText>
                      </View>
                    ) : null}
                    {station.maxStopMinutes ? (
                      <View style={styles.fact}>
                        <Ionicons name="hourglass-outline" size={15} color={Colors.textSecondary} />
                        <Text style={styles.factText}>{t.supporterGuide.maxStop.replace('{minutes}', String(station.maxStopMinutes))}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          );
        }

        const { point, index } = item;
        const directionsUrl = resolveDirectionsUrl(point);
        const normalizedName = point.name.trim().toLocaleLowerCase(locale);
        const pointAccessLabel = point.accessLabel?.trim();
        const showAccessLabel = Boolean(
          pointAccessLabel && pointAccessLabel.toLocaleLowerCase(locale) !== normalizedName,
        );
        return (
          <View key={item.key} style={styles.row}>
            <View style={styles.rail}>
              <View style={styles.badge}><Text style={styles.badgeText}>S{index + 1}</Text></View>
              {!isLast ? <TrailRail color={Colors.brandPrimary} style={styles.line} /> : null}
            </View>
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <View style={styles.titleContent}>
                  <Text numberOfLines={2} style={styles.title}>{point.name}</Text>
                  <View style={styles.chips}>
                    {point.encouragementAllowed ? <View style={styles.chip}><Text style={styles.chipText}>{t.catalog.racebookSupporterEncouragement}</Text></View> : null}
                    {point.assistanceAllowed ? <View style={styles.chip}><Text style={styles.chipText}>{t.catalog.racebookSupporterAssistance}</Text></View> : null}
                  </View>
                </View>
                <View style={styles.titleActions}>
                  <DataText style={styles.km}>{formatDistance(point.km, locale)}</DataText>
                  {point.planUrl ? (
                    <Pressable
                      accessibilityLabel={t.catalog.racebookSupporterViewMap}
                      accessibilityRole="link"
                      onPress={() => onOpenUrl(point.planUrl!, 'plan')}
                      style={({ pressed }) => [styles.mapAction, styles.secondaryMapAction, pressed ? styles.actionPressed : null]}
                    >
                      <Ionicons name="map-outline" size={18} color={Colors.brandPrimary} />
                    </Pressable>
                  ) : null}
                  {directionsUrl ? (
                    <Pressable
                      accessibilityLabel={t.catalog.racebookSupporterOpenDirections}
                      accessibilityRole="link"
                      onPress={() => onOpenUrl(directionsUrl, 'directions')}
                      style={({ pressed }) => [styles.mapAction, pressed ? styles.actionPressed : null]}
                    >
                      <Ionicons name="navigate-outline" size={18} color={Colors.textOnBrand} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {showAccessLabel ? <Text style={styles.access}>{pointAccessLabel}</Text> : null}
              {point.accessNote ? <Text style={styles.note}>{point.accessNote}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 42, alignItems: 'center' },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandPrimary },
  stationBadge: { borderWidth: 1.5, borderColor: Colors.brandPrimary, backgroundColor: Colors.brandSurface },
  badgeText: { color: Colors.textOnBrand, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  line: { flex: 1, minHeight: 18, opacity: 0.5 },
  card: { flex: 1, minHeight: 88, marginLeft: 8, marginBottom: 12, justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 12, backgroundColor: Colors.surface },
  stationCard: { minHeight: 72, backgroundColor: Colors.surfaceSecondary },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleContent: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 6 },
  kicker: { color: Colors.textSecondary, fontSize: 11, lineHeight: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { flexShrink: 1, color: Colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  km: { color: Colors.brandPrimary, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  titleActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, backgroundColor: Colors.brandSurface, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { color: Colors.brandPrimary, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  facts: { gap: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  factValue: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  access: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  note: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  mapAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: Colors.brandPrimary },
  secondaryMapAction: { borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.surface },
  actionPressed: { opacity: 0.64 },
});
