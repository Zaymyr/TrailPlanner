import Ionicons from '@expo/vector-icons/Ionicons';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { Card } from '../themed/Card';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

export type RacebookServiceCategory = 'restaurant' | 'accommodation' | 'recovery' | 'other';

export type RacebookServiceItem = {
  id: string;
  category: RacebookServiceCategory;
  name: string;
  description: string | null;
  address: string | null;
  distanceKm: number | null;
  directionsUrl: string | null;
  websiteUrl: string | null;
  phoneUrl: string | null;
};

export type RacebookLegacyServiceSection = {
  key: string;
  title: string;
  value: string;
};

export type RacebookServicesCopy = {
  emptyMessage: string;
  directionsLabel: string;
  websiteLabel: string;
  callLabel: string;
  categoryTitles: Record<RacebookServiceCategory, string>;
};

type RacebookServicesSectionProps = {
  services: RacebookServiceItem[];
  legacySections?: RacebookLegacyServiceSection[];
  theme: ResolvedRacebookTheme;
  copy: RacebookServicesCopy;
  onOpenUrl: (url: string, action: 'directions' | 'website' | 'phone', service: RacebookServiceItem) => void;
};

const categoryOrder: RacebookServiceCategory[] = ['restaurant', 'accommodation', 'recovery', 'other'];

const categoryIcons: Record<RacebookServiceCategory, keyof typeof Ionicons.glyphMap> = {
  restaurant: 'restaurant-outline',
  accommodation: 'bed-outline',
  recovery: 'heart-outline',
  other: 'information-circle-outline',
};

function formatDistance(distanceKm: number) {
  return `${distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1)} km`;
}

function ServiceAction({
  action,
  icon,
  label,
  service,
  url,
  onOpenUrl,
  theme,
}: {
  action: 'directions' | 'website' | 'phone';
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  service: RacebookServiceItem;
  url: string;
  onOpenUrl: RacebookServicesSectionProps['onOpenUrl'];
  theme: ResolvedRacebookTheme;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} - ${service.name}`}
      accessibilityRole="link"
      hitSlop={4}
      onPress={() => onOpenUrl(url, action, service)}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: theme.accentSurfaceColor,
          borderColor: theme.accentBorderColor,
        },
        pressed ? styles.actionPressed : null,
      ]}
    >
      <Ionicons color={theme.accentGraphicColor} name={icon} size={19} />
    </Pressable>
  );
}

function ServiceRow({
  service,
  theme,
  copy,
  onOpenUrl,
  showDivider,
}: {
  service: RacebookServiceItem;
  theme: ResolvedRacebookTheme;
  copy: RacebookServicesCopy;
  onOpenUrl: RacebookServicesSectionProps['onOpenUrl'];
  showDivider: boolean;
}) {
  return (
    <View style={[styles.serviceRow, showDivider ? styles.serviceRowDivider : null]}>
      <View style={styles.serviceMain}>
        <View style={styles.serviceHeading}>
          <Text numberOfLines={1} style={styles.serviceName}>{service.name}</Text>
          {service.distanceKm !== null ? (
            <DataText style={styles.distance}>{formatDistance(service.distanceKm)}</DataText>
          ) : null}
        </View>
        {service.address ? <Text numberOfLines={2} style={styles.address}>{service.address}</Text> : null}
        {service.description ? <Text numberOfLines={2} style={styles.description}>{service.description}</Text> : null}
      </View>
      {service.directionsUrl || service.websiteUrl || service.phoneUrl ? (
        <View style={styles.actions}>
          {service.directionsUrl ? (
            <ServiceAction
              action="directions"
              icon="navigate-outline"
              label={copy.directionsLabel}
              service={service}
              url={service.directionsUrl}
              onOpenUrl={onOpenUrl}
              theme={theme}
            />
          ) : null}
          {service.websiteUrl ? (
            <ServiceAction
              action="website"
              icon="globe-outline"
              label={copy.websiteLabel}
              service={service}
              url={service.websiteUrl}
              onOpenUrl={onOpenUrl}
              theme={theme}
            />
          ) : null}
          {service.phoneUrl ? (
            <ServiceAction
              action="phone"
              icon="call-outline"
              label={copy.callLabel}
              service={service}
              url={service.phoneUrl}
              onOpenUrl={onOpenUrl}
              theme={theme}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function RacebookServicesSection({
  services,
  legacySections = [],
  theme,
  copy,
  onOpenUrl,
}: RacebookServicesSectionProps) {
  const groupedServices = categoryOrder.map((category) => ({
    category,
    services: services.filter((service) => service.category === category),
  })).filter((group) => group.services.length > 0);

  if (groupedServices.length === 0 && legacySections.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyText}>{copy.emptyMessage}</Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {groupedServices.map((group) => (
        <Card key={group.category} style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <View style={[styles.categoryIcon, { backgroundColor: theme.accentSurfaceColor }]}>
              <Ionicons color={theme.accentGraphicColor} name={categoryIcons[group.category]} size={18} />
            </View>
            <Text style={styles.categoryTitle}>{copy.categoryTitles[group.category]}</Text>
          </View>
          <View>
            {group.services.map((service, index) => (
              <ServiceRow
                key={service.id}
                service={service}
                theme={theme}
                copy={copy}
                onOpenUrl={onOpenUrl}
                showDivider={index > 0}
              />
            ))}
          </View>
        </Card>
      ))}

      {legacySections.length > 0 ? (
        <Card style={styles.legacySections}>
          {legacySections.map((section, index) => (
            <View key={section.key} style={[styles.legacySection, index > 0 ? styles.legacySectionDivider : null]}>
              <Text style={styles.legacyTitle}>{section.title}</Text>
              <Text style={styles.legacyValue}>{section.value}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  emptyCard: { padding: 16 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  categoryCard: { gap: 10 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  categoryIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  categoryTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  serviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  serviceRowDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  serviceMain: { flex: 1, gap: 3 },
  serviceHeading: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  serviceName: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  distance: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  address: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  description: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  actionPressed: { opacity: 0.7 },
  legacySections: { paddingVertical: 2 },
  legacySection: { gap: 4, paddingVertical: 12 },
  legacySectionDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  legacyTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  legacyValue: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
