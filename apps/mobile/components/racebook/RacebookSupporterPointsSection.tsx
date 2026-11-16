import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { formatDistance, formatDistanceRange } from '../../lib/displayFormat';
import { useI18n } from '../../lib/i18n';
import type { SupporterGuideStop } from '../../lib/supporterGuide';
import { DataText } from '../themed/DataText';
import { StatusPill } from '../themed/StatusPill';
import { Text } from '../themed/Text';
import { TrailRail } from '../themed/TrailRail';

/** One place of the Livret supporter course line (aid station and/or supporter points). */
export type RacebookSupporterStop = SupporterGuideStop & {
  /** Already formatted, e.g. "15:00" or "sam. 01:00". */
  cutoffLabel: string | null;
  /** The last-runner cutoff has passed (race day). */
  closed: boolean;
  /** Start: "06:00" or "SAS 1 14:00 · SAS 2 14:05". */
  startTimesLabel?: string | null;
  /** Finish: formatted expected first arrivals. */
  expectedMenLabel?: string | null;
  expectedWomenLabel?: string | null;
};

const ACCESS_TONE = { allowed: 'success', restricted: 'warning', forbidden: 'danger' } as const;

function directionsUrl(stop: SupporterGuideStop): string | null {
  if (stop.mapsUrl) return stop.mapsUrl;
  if (stop.latitude !== null && stop.longitude !== null && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`;
  }
  return null;
}

/**
 * Kilometre-ordered supporter line: one card per place. A ravito and the
 * cheering point next to it share a card, so supporters read « where to go »
 * once, with every role (ravito, encourager, assistance) as chips.
 */
export function RacebookSupporterPointsSection({
  stops,
  locale,
  onOpenUrl,
}: {
  stops: RacebookSupporterStop[];
  locale: 'fr' | 'en';
  onOpenUrl: (url: string, action: 'directions' | 'plan') => void;
}) {
  const { t } = useI18n();
  const accessLabel = {
    allowed: t.supporterGuide.supportersAllowed,
    restricted: t.supporterGuide.supportersRestricted,
    forbidden: t.supporterGuide.supportersForbidden,
  };
  let supporterIndex = 0;

  return (
    <View style={styles.list}>
      {stops.map((stop, index) => {
        const isLast = index === stops.length - 1;
        const isEndpoint = stop.endpoint === 'start' || stop.endpoint === 'finish';
        const isSupporterPlace = !isEndpoint && (stop.encouragementAllowed || stop.assistanceAllowed);
        if (isSupporterPlace) supporterIndex += 1;
        const url = directionsUrl(stop);
        const roles = [
          stop.aidStation && !stop.isFinish ? t.supporterGuide.aidStation : null,
          stop.encouragementAllowed ? t.catalog.racebookSupporterEncouragement : null,
          stop.assistanceAllowed || stop.services.runnerAssistance ? t.catalog.racebookAidAssistance : null,
        ].filter((value): value is string => Boolean(value));
        const services = [
          stop.services.water ? t.catalog.racebookAidWater : null,
          stop.services.food ? t.catalog.racebookAidFood : null,
          ...stop.services.amenities,
        ].filter((value): value is string => Boolean(value));
        const showAccessLabel = Boolean(
          stop.accessLabel && stop.accessLabel.trim().toLocaleLowerCase(locale) !== stop.name.trim().toLocaleLowerCase(locale),
        );

        return (
          <View key={stop.id} style={[styles.row, stop.closed && styles.closedRow]}>
            <View style={styles.rail}>
              {stop.endpoint === 'start' ? (
                <View style={styles.badge}><Ionicons name="play" size={15} color={Colors.textOnBrand} /></View>
              ) : stop.isFinish ? (
                <View style={[styles.badge, stop.endpoint === 'finish' ? null : styles.outlineBadge]}>
                  <Ionicons name={stop.endpoint === 'finish' ? 'flag' : 'flag-outline'} size={16} color={stop.endpoint === 'finish' ? Colors.textOnBrand : Colors.brandPrimary} />
                </View>
              ) : isSupporterPlace ? (
                <View style={styles.badge}><Text style={styles.badgeText}>S{supporterIndex}</Text></View>
              ) : (
                <View style={[styles.badge, styles.outlineBadge]}><Ionicons name="water-outline" size={16} color={Colors.brandPrimary} /></View>
              )}
              {!isLast ? <TrailRail color={Colors.brandPrimary} style={styles.line} /> : null}
            </View>
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <View style={styles.titleContent}>
                  {stop.endpoint === 'start' ? <Text style={styles.kicker}>{t.supporterGuide.kindStart}</Text> : null}
                  {stop.isFinish ? <Text style={styles.kicker}>{t.supporterGuide.finish}</Text> : null}
                  {stop.name ? <Text numberOfLines={2} style={styles.title}>{stop.name}</Text> : null}
                </View>
                <View style={styles.titleActions}>
                  <DataText style={styles.km}>
                    {stop.kmMax !== null ? formatDistanceRange(stop.km, stop.kmMax, locale) : formatDistance(stop.km, locale)}
                  </DataText>
                  {stop.planUrl ? (
                    <Pressable
                      accessibilityLabel={t.catalog.racebookSupporterViewMap}
                      accessibilityRole="link"
                      onPress={() => onOpenUrl(stop.planUrl!, 'plan')}
                      style={({ pressed }) => [styles.mapAction, styles.secondaryMapAction, pressed ? styles.actionPressed : null]}
                    >
                      <Ionicons name="map-outline" size={18} color={Colors.brandPrimary} />
                    </Pressable>
                  ) : null}
                  {url ? (
                    <Pressable
                      accessibilityLabel={`${t.catalog.racebookSupporterOpenDirections} - ${stop.name}`}
                      accessibilityRole="link"
                      onPress={() => onOpenUrl(url, 'directions')}
                      style={({ pressed }) => [styles.mapAction, pressed ? styles.actionPressed : null]}
                    >
                      <Ionicons name="navigate-outline" size={18} color={Colors.textOnBrand} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {roles.length > 0 || stop.closed ? (
                <View style={styles.chips}>
                  {stop.closed ? <StatusPill label={t.supporterGuide.closed} tone="neutral" /> : null}
                  {roles.map((role) => (
                    <View key={role} style={styles.chip}><Text style={styles.chipText}>{role}</Text></View>
                  ))}
                </View>
              ) : null}
              {stop.supportersAccess ? (
                <StatusPill label={accessLabel[stop.supportersAccess]} tone={ACCESS_TONE[stop.supportersAccess]} />
              ) : null}
              {services.length > 0 ? <Text style={styles.services}>{services.join(' · ')}</Text> : null}
              {stop.startTimesLabel || stop.expectedMenLabel || stop.expectedWomenLabel ? (
                <View style={styles.facts}>
                  {stop.startTimesLabel ? (
                    <View style={styles.fact}>
                      <Ionicons name="flag-outline" size={15} color={Colors.textSecondary} />
                      <Text style={styles.factText}>{t.supporterGuide.kindStart}</Text>
                      <DataText style={styles.factValue}>{stop.startTimesLabel}</DataText>
                    </View>
                  ) : null}
                  {stop.expectedMenLabel ? (
                    <View style={styles.fact}>
                      <Ionicons name="stopwatch-outline" size={15} color={Colors.textSecondary} />
                      <Text style={styles.factText}>{`${t.supporterGuide.kindArrivalEstimate} · ${t.supporterGuide.firstMan}`}</Text>
                      <DataText style={styles.factValue}>{stop.expectedMenLabel}</DataText>
                    </View>
                  ) : null}
                  {stop.expectedWomenLabel ? (
                    <View style={styles.fact}>
                      <Ionicons name="stopwatch-outline" size={15} color={Colors.textSecondary} />
                      <Text style={styles.factText}>{`${t.supporterGuide.kindArrivalEstimate} · ${t.supporterGuide.firstWoman}`}</Text>
                      <DataText style={styles.factValue}>{stop.expectedWomenLabel}</DataText>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {stop.cutoffLabel || stop.maxStopMinutes ? (
                <View style={styles.facts}>
                  {stop.cutoffLabel ? (
                    <View style={styles.fact}>
                      <Ionicons name="time-outline" size={15} color={Colors.textSecondary} />
                      <Text style={styles.factText}>{t.supporterGuide.lastRunner}</Text>
                      <DataText style={styles.factValue}>{stop.cutoffLabel}</DataText>
                    </View>
                  ) : null}
                  {stop.maxStopMinutes ? (
                    <View style={styles.fact}>
                      <Ionicons name="hourglass-outline" size={15} color={Colors.textSecondary} />
                      <Text style={styles.factText}>{t.supporterGuide.maxStop.replace('{minutes}', String(stop.maxStopMinutes))}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {showAccessLabel ? <Text style={styles.access}>{stop.accessLabel}</Text> : null}
              {stop.accessNote ? <Text style={styles.note}>{stop.accessNote}</Text> : null}
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
  closedRow: { opacity: 0.55 },
  rail: { width: 42, alignItems: 'center' },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandPrimary },
  outlineBadge: { borderWidth: 1.5, borderColor: Colors.brandPrimary, backgroundColor: Colors.brandSurface },
  badgeText: { color: Colors.textOnBrand, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  line: { flex: 1, minHeight: 18, opacity: 0.5 },
  card: { flex: 1, minHeight: 72, marginLeft: 8, marginBottom: 12, justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 12, backgroundColor: Colors.surface },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleContent: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 2 },
  kicker: { color: Colors.textSecondary, fontSize: 11, lineHeight: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { flexShrink: 1, color: Colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  km: { color: Colors.brandPrimary, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  titleActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { borderRadius: 999, backgroundColor: Colors.brandSurface, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { color: Colors.brandPrimary, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  services: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
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
