import Ionicons from '@expo/vector-icons/Ionicons';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { Card } from '../themed/Card';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

export type RacebookBibPickupDayGroup = {
  key: string;
  label: string;
  timeRanges: string[];
};

export type RacebookBibPickupLocationGroup = {
  key: string;
  location: string;
  locationDetails?: string | null;
  actionUrl: string | null;
  days: RacebookBibPickupDayGroup[];
};

export type RacebookBibSectionCopy = {
  whereAndWhenTitle: string;
  documentsTitle: string;
  rulesTitle: string;
  emptyMessage: string;
  openMapsLabel: string;
  scheduleLabel: string;
};

type RacebookBibSectionProps = {
  locationGroups: RacebookBibPickupLocationGroup[];
  fallbackSchedule: string | null;
  requiredDocuments: string | null;
  rules: string[];
  theme: ResolvedRacebookTheme;
  copy: RacebookBibSectionCopy;
  onOpenMap: (location: string) => void;
  onOpenUrl: (url: string) => void;
};

function LocationPickup({
  group,
  theme,
  openMapsLabel,
  onOpenMap,
  onOpenUrl,
}: {
  group: RacebookBibPickupLocationGroup;
  theme: ResolvedRacebookTheme;
  openMapsLabel: string;
  onOpenMap: (location: string) => void;
  onOpenUrl: (url: string) => void;
}) {
  return (
    <View style={styles.locationPickup}>
      <View style={styles.locationHeader}>
        <View style={[styles.locationIcon, { backgroundColor: theme.accentSurfaceColor, borderColor: theme.accentBorderColor }]}>
          <Ionicons name="location-outline" size={18} color={theme.accentGraphicColor} />
        </View>
        <View style={styles.locationContent}>
          <Text numberOfLines={2} style={styles.locationName}>{group.location}</Text>
          {group.locationDetails ? <Text style={styles.locationDetails}>{group.locationDetails}</Text> : null}
        </View>
        {group.actionUrl ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${openMapsLabel} - ${group.location}`}
            hitSlop={4}
            onPress={() => {
              onOpenMap(group.key);
              onOpenUrl(group.actionUrl!);
            }}
            style={({ pressed }) => [
              styles.mapsAction,
              { borderColor: theme.accentBorderColor, backgroundColor: theme.accentSurfaceColor },
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons name="navigate-outline" size={18} color={theme.accentGraphicColor} />
          </Pressable>
        ) : null}
      </View>

      {group.days.length > 0 ? (
        <View style={styles.dayList}>
          {group.days.map((day) => (
            <View key={`${group.key}-${day.key}`} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{day.label}</Text>
              {day.timeRanges.length > 0 ? (
                <View accessibilityLabel={`${day.label}: ${day.timeRanges.join(', ')}`} style={styles.timeList}>
                  {day.timeRanges.map((timeRange, index) => (
                    <DataText key={`${day.key}-${timeRange}-${index}`} style={styles.timeValue}>
                      {timeRange}
                    </DataText>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function RacebookBibSection({
  locationGroups,
  fallbackSchedule,
  requiredDocuments,
  rules,
  theme,
  copy,
  onOpenMap,
  onOpenUrl,
}: RacebookBibSectionProps) {
  const hasStructuredSchedule = locationGroups.some((group) => group.days.length > 0);
  const hasContent = locationGroups.length > 0 || Boolean(fallbackSchedule) || Boolean(requiredDocuments) || rules.length > 0;

  if (!hasContent) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyText}>{copy.emptyMessage}</Text>
      </Card>
    );
  }

  return (
    <View style={styles.section}>
      {locationGroups.length > 0 || fallbackSchedule ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{copy.whereAndWhenTitle}</Text>
          {locationGroups.length > 0 ? (
            <View style={styles.locationList}>
              {locationGroups.map((group, index) => (
                <View key={group.key} style={index > 0 ? styles.locationDivider : undefined}>
                  <LocationPickup
                    group={group}
                    theme={theme}
                    openMapsLabel={copy.openMapsLabel}
                    onOpenMap={onOpenMap}
                    onOpenUrl={onOpenUrl}
                  />
                </View>
              ))}
            </View>
          ) : null}
          {!hasStructuredSchedule && fallbackSchedule ? (
            <View style={styles.fallbackSchedule}>
              <Ionicons color={theme.primaryColor} name="time-outline" size={17} />
              <Text style={styles.fallbackScheduleLabel}>{copy.scheduleLabel}</Text>
              <DataText style={styles.fallbackScheduleValue}>{fallbackSchedule}</DataText>
            </View>
          ) : null}
        </Card>
      ) : null}

      {requiredDocuments ? (
        <Card style={styles.card}>
          <View style={styles.documentHeader}>
            <View style={[styles.documentIcon, { backgroundColor: theme.accentSurfaceColor }]}>
              <Ionicons name="document-text-outline" size={18} color={theme.accentGraphicColor} />
            </View>
            <Text style={styles.sectionTitle}>{copy.documentsTitle}</Text>
          </View>
          <Text style={styles.documentText}>{requiredDocuments}</Text>
        </Card>
      ) : null}

      {rules.length > 0 ? (
        <View accessible accessibilityLabel={`${copy.rulesTitle}: ${rules.join(', ')}`} style={styles.rulesBlock}>
          <Ionicons name="information-circle-outline" size={19} color={Colors.textSecondary} />
          <View style={styles.rulesContent}>
            <Text style={styles.rulesTitle}>{copy.rulesTitle}</Text>
            <View style={styles.rulesList}>
              {rules.map((rule, index) => (
                <View key={`${rule}-${index}`} style={styles.ruleRow}>
                  <View style={[styles.ruleDot, { backgroundColor: theme.primaryColor }]} />
                  <Text style={styles.ruleText}>{rule}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  card: { gap: 14 },
  emptyCard: { padding: 16 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  locationList: { gap: 0 },
  locationDivider: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  locationPickup: { gap: 12 },
  locationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  locationIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1 },
  locationContent: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2 },
  locationName: { color: Colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  locationDetails: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  mapsAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  pressed: { opacity: 0.7 },
  dayList: { marginLeft: 46, gap: 9 },
  dayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: Colors.border },
  dayLabel: { flex: 1, minWidth: 0, color: Colors.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  timeList: { alignItems: 'flex-end', gap: 3 },
  timeValue: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  fallbackSchedule: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  fallbackScheduleLabel: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  fallbackScheduleValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  documentHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  documentIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  documentText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  rulesBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 14, borderRadius: 16, backgroundColor: Colors.surfaceSecondary },
  rulesContent: { flex: 1, gap: 7 },
  rulesTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  rulesList: { gap: 5 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ruleDot: { width: 5, height: 5, marginTop: 7, borderRadius: 3 },
  ruleText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
});
