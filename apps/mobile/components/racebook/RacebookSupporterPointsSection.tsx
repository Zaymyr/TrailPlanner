import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import type { RacebookSupporterPoint } from '../../lib/racebook';
import { buildSupporterDirectionsUrl } from '../../lib/racebookSupporterPoints';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

export function RacebookSupporterPointsSection({
  points,
  locale,
  onOpenUrl,
}: {
  points: RacebookSupporterPoint[];
  locale: 'fr' | 'en';
  onOpenUrl: (url: string, action: 'directions' | 'plan') => void;
}) {
  return (
    <View style={styles.list}>
      {points.map((point, index) => {
        const directionsUrl = buildSupporterDirectionsUrl(point);
        return (
          <View key={point.id} style={styles.row}>
            <View style={styles.rail}>
              <View style={styles.badge}><Text style={styles.badgeText}>S{index + 1}</Text></View>
              {index < points.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{point.name}</Text>
                <DataText style={styles.km}>{point.km.toLocaleString(locale, { maximumFractionDigits: 1 })} km</DataText>
              </View>
              <View style={styles.chips}>
                {point.encouragementAllowed ? <View style={styles.chip}><Text style={styles.chipText}>{locale === 'fr' ? 'Encouragement' : 'Cheering'}</Text></View> : null}
                {point.assistanceAllowed ? <View style={styles.chip}><Text style={styles.chipText}>{locale === 'fr' ? 'Ravitaillement' : 'Crew assistance'}</Text></View> : null}
              </View>
              {point.accessLabel ? <Text style={styles.access}>{point.accessLabel}</Text> : null}
              {point.accessNote ? <Text style={styles.note}>{point.accessNote}</Text> : null}
              <View style={styles.actions}>
                <Pressable accessibilityRole="link" onPress={() => onOpenUrl(directionsUrl, 'directions')} style={styles.primaryAction}>
                  <Ionicons name="navigate-outline" size={16} color={Colors.textOnBrand} />
                  <Text style={styles.primaryActionText}>{locale === 'fr' ? 'S\u2019y rendre' : 'Directions'}</Text>
                </Pressable>
                {point.planUrl ? (
                  <Pressable accessibilityRole="link" onPress={() => onOpenUrl(point.planUrl!, 'plan')} style={styles.secondaryAction}>
                    <Ionicons name="map-outline" size={16} color={Colors.brandPrimary} />
                    <Text style={styles.secondaryActionText}>{locale === 'fr' ? 'Voir le plan' : 'View map'}</Text>
                  </Pressable>
                ) : null}
              </View>
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
  badgeText: { color: Colors.textOnBrand, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  line: { flex: 1, width: 2, minHeight: 18, backgroundColor: Colors.brandBorder },
  card: { flex: 1, marginLeft: 8, marginBottom: 14, gap: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 14, backgroundColor: Colors.surface },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  km: { color: Colors.brandPrimary, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, backgroundColor: Colors.brandSurface, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { color: Colors.brandPrimary, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  access: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  note: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 22, backgroundColor: Colors.brandPrimary, paddingHorizontal: 14 },
  primaryActionText: { color: Colors.textOnBrand, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  secondaryAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 22, borderWidth: 1, borderColor: Colors.brandBorder, paddingHorizontal: 14 },
  secondaryActionText: { color: Colors.brandPrimary, fontSize: 13, lineHeight: 17, fontWeight: '800' },
});
