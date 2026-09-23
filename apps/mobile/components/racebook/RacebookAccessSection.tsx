import Ionicons from '@expo/vector-icons/Ionicons';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '../themed/Card';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

export type RacebookAccessLocation = {
  key: string;
  label: string;
  value: string;
  actionUrl: string | null;
};

export type RacebookAccessTransport = {
  key: 'parking' | 'shuttles';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  schedule?: string | null;
};

export type RacebookAccessPresentation = {
  locations: RacebookAccessLocation[];
  priorityItems: { label: string; value: string }[];
  transportItems: RacebookAccessTransport[];
  generalMapUrl: string | null;
  hasContent: boolean;
};

type RacebookAccessSectionProps = {
  presentation: RacebookAccessPresentation | null;
  expanded: Record<RacebookAccessTransport['key'], boolean>;
  theme: ResolvedRacebookTheme;
  copy: {
    accessTitle: string;
    emptyMessage: string;
    essentialTitle: string;
    locationsTitle: string;
    gettingThereTitle: string;
    openMapsLabel: string;
    openGeneralMapLabel: string;
    showDetailsLabel: string;
    hideDetailsLabel: string;
    scheduleLabel: string;
  };
  onOpenMap: (location: string) => void;
  onOpenUrl: (url: string) => void;
  onToggleTransport: (key: RacebookAccessTransport['key']) => void;
};

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function PriorityCard({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <View style={styles.priorityCard}>
      <View style={styles.priorityHeader}>
        <View style={styles.priorityIcon}>
          <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
        </View>
        <Text style={styles.priorityTitle}>{title}</Text>
      </View>
      <View style={styles.priorityList}>
        {items.map((item, index) => (
          <View key={item.label} style={[styles.priorityItem, index > 0 ? styles.priorityItemBorder : null]}>
            <Text style={styles.priorityLabel}>{item.label}</Text>
            <Text style={styles.priorityText}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LocationsCard({
  title,
  locations,
  generalMapUrl,
  openMapsLabel,
  openGeneralMapLabel,
  onOpenMap,
  onOpenUrl,
  theme,
}: {
  title: string;
  locations: RacebookAccessLocation[];
  generalMapUrl: string | null;
  openMapsLabel: string;
  openGeneralMapLabel: string;
  onOpenMap: (location: string) => void;
  onOpenUrl: (url: string) => void;
  theme: ResolvedRacebookTheme;
}) {
  return (
    <SectionCard title={title}>
      <View style={styles.locationList}>
        {locations.map((location, index) => (
          <View key={location.key} style={[styles.locationItem, index > 0 ? styles.locationItemBorder : null]}>
            <View style={[styles.locationIcon, { backgroundColor: theme.primarySurfaceColor }]}>
              <Ionicons name="location-outline" size={18} color={theme.primaryColor} />
            </View>
            <View style={styles.locationContent}>
              <Text style={styles.locationLabel}>{location.label}</Text>
              <Text style={styles.locationValue}>{location.value}</Text>
              {location.actionUrl ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${openMapsLabel} - ${location.label}`}
                  onPress={() => {
                    onOpenMap(location.key);
                    onOpenUrl(location.actionUrl!);
                  }}
                  style={({ pressed }) => [styles.mapAction, pressed ? styles.actionPressed : null]}
                >
                  <Ionicons name="navigate-outline" size={15} color={theme.primaryColor} />
                  <Text style={[styles.mapActionText, { color: theme.primaryColor }]}>{openMapsLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      {generalMapUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={openGeneralMapLabel}
          onPress={() => {
            onOpenMap('general');
            onOpenUrl(generalMapUrl);
          }}
          style={({ pressed }) => [
            styles.generalMapAction,
            { backgroundColor: theme.primarySurfaceColor, borderColor: theme.primaryBorderColor },
            pressed ? styles.actionPressed : null,
          ]}
        >
          <Ionicons name="map-outline" size={17} color={theme.primaryColor} />
          <Text style={[styles.generalMapActionText, { color: theme.primaryColor }]}>{openGeneralMapLabel}</Text>
        </Pressable>
      ) : null}
    </SectionCard>
  );
}

function TransportCard({
  title,
  items,
  expanded,
  onToggle,
  showDetailsLabel,
  hideDetailsLabel,
  scheduleLabel,
  theme,
}: {
  title: string;
  items: RacebookAccessTransport[];
  expanded: Record<RacebookAccessTransport['key'], boolean>;
  onToggle: (key: RacebookAccessTransport['key']) => void;
  showDetailsLabel: string;
  hideDetailsLabel: string;
  scheduleLabel: string;
  theme: ResolvedRacebookTheme;
}) {
  return (
    <SectionCard title={title}>
      <View style={styles.transportList}>
        {items.map((item, index) => {
          const isExpanded = expanded[item.key];
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
              accessibilityLabel={`${item.title} - ${isExpanded ? hideDetailsLabel : showDetailsLabel}`}
              onPress={() => onToggle(item.key)}
              style={({ pressed }) => [
                styles.transportItem,
                index > 0 ? styles.transportItemBorder : null,
                pressed ? styles.actionPressed : null,
              ]}
            >
              <View style={styles.transportHeader}>
                <View style={[styles.transportIcon, { backgroundColor: theme.primarySurfaceColor }]}>
                  <Ionicons name={item.icon} size={18} color={theme.primaryColor} />
                </View>
                <View style={styles.transportHeading}>
                  <Text style={styles.transportTitle}>{item.title}</Text>
                  <Text style={styles.transportHint}>{isExpanded ? hideDetailsLabel : showDetailsLabel}</Text>
                </View>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
              </View>
              <Text numberOfLines={isExpanded ? undefined : 2} style={styles.transportText}>{item.description}</Text>
              {isExpanded && item.schedule ? (
                <View style={[styles.scheduleRow, { backgroundColor: theme.accentSurfaceColor, borderColor: theme.accentBorderColor }]}>
                  <Ionicons name="time-outline" size={16} color={theme.accentColor} />
                  <View style={styles.scheduleContent}>
                    <Text style={[styles.scheduleLabel, { color: theme.primaryColor }]}>{scheduleLabel}</Text>
                    <Text style={styles.scheduleText}>{item.schedule}</Text>
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </SectionCard>
  );
}

export function RacebookAccessSection({
  presentation,
  expanded,
  theme,
  copy,
  onOpenMap,
  onOpenUrl,
  onToggleTransport,
}: RacebookAccessSectionProps) {
  if (!presentation?.hasContent) {
    return (
      <SectionCard title={copy.accessTitle}>
        <Text style={styles.emptyText}>{copy.emptyMessage}</Text>
      </SectionCard>
    );
  }

  return (
    <>
      {presentation.priorityItems.length > 0 ? (
        <PriorityCard title={copy.essentialTitle} items={presentation.priorityItems} />
      ) : null}
      {presentation.locations.length > 0 || presentation.generalMapUrl ? (
        <LocationsCard
          title={copy.locationsTitle}
          locations={presentation.locations}
          generalMapUrl={presentation.generalMapUrl}
          openMapsLabel={copy.openMapsLabel}
          openGeneralMapLabel={copy.openGeneralMapLabel}
          onOpenMap={onOpenMap}
          onOpenUrl={onOpenUrl}
          theme={theme}
        />
      ) : null}
      {presentation.transportItems.length > 0 ? (
        <TransportCard
          title={copy.gettingThereTitle}
          items={presentation.transportItems}
          expanded={expanded}
          onToggle={onToggleTransport}
          showDetailsLabel={copy.showDetailsLabel}
          hideDetailsLabel={copy.hideDetailsLabel}
          scheduleLabel={copy.scheduleLabel}
          theme={theme}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionCard: { gap: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  emptyText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  priorityCard: { gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#E7C97A', backgroundColor: Colors.warningSurface },
  priorityHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  priorityIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#FFF8E7' },
  priorityTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  priorityList: { gap: 12 },
  priorityItem: { gap: 4 },
  priorityItemBorder: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E7C97A' },
  priorityLabel: { color: '#8A4B08', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  priorityText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  locationList: { gap: 0 },
  locationItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  locationItemBorder: { marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  locationIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: Colors.brandSurface },
  locationContent: { flex: 1, gap: 4 },
  locationLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  locationValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  mapAction: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, paddingHorizontal: 12, borderRadius: 22, backgroundColor: Colors.brandSurface },
  mapActionText: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '800' },
  generalMapAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, backgroundColor: Colors.brandSurface },
  generalMapActionText: { color: Colors.textOnBrand, fontSize: 14, fontWeight: '800' },
  actionPressed: { opacity: 0.72 },
  transportList: { gap: 0 },
  transportItem: { gap: 10, paddingVertical: 4 },
  transportItemBorder: { marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  transportHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  transportIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: Colors.brandSurface },
  transportHeading: { flex: 1, gap: 1 },
  transportTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  transportHint: { color: Colors.textSecondary, fontSize: 11 },
  transportText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  scheduleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, backgroundColor: Colors.brandSurface },
  scheduleContent: { flex: 1, gap: 2 },
  scheduleLabel: { color: Colors.brandPrimary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  scheduleText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
});
