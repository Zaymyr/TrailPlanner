import { useCallback, useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';
import { StatusBar } from 'expo-status-bar';
import { Animated, Modal, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { DataText } from '../themed/DataText';
import { Heading } from '../themed/Heading';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import { RacebookBrandLogo } from './RacebookSponsorExperience';

export const RACEBOOK_HERO_BODY_HEIGHT = 268;
export const RACEBOOK_HERO_COMPACT_BODY_HEIGHT = 60;

type SocialLink = {
  accessibilityLabel: string;
  action: string;
  icon: keyof typeof Ionicons.glyphMap;
  url: string;
};

type Props = {
  scrollY: Animated.Value;
  topInset: number;
  expandedBodyHeight?: number;
  eventName: string | null;
  raceName: string;
  imageUrl: string | null;
  logoUrl: string | null;
  dateLabel: string | null;
  locationLabel: string | null;
  participationLabel: string | null;
  participationIcon: keyof typeof Ionicons.glyphMap;
  startTimeLabel: string;
  startTimeValue: string | null;
  distanceLabel: string;
  elevationGainLabel: string;
  elevationLossLabel: string | null;
  elevationCaption: string;
  descentCaption: string;
  planDurationLabel: string | null;
  planDurationCaption: string;
  planPaceLabel: string | null;
  planPaceCaption: string;
  backLabel: string;
  linksLabel: string;
  closeLabel: string;
  theme: ResolvedRacebookTheme;
  socialLinks: SocialLink[];
  emergency: {
    label: string;
    name: string | null;
    phone: string;
    callLabel: string;
    accessibilityLabel: string;
  } | null;
  onBack: () => void;
  onCallEmergency?: () => void;
  onOpenLocation?: () => void;
  onOpenSocial: (url: string, action: string) => void;
  onExpandedBodyHeightChange?: (height: number) => void;
};

export function RacebookCollapsibleHero({
  scrollY,
  topInset,
  expandedBodyHeight = RACEBOOK_HERO_BODY_HEIGHT,
  eventName,
  raceName,
  imageUrl,
  logoUrl,
  dateLabel,
  locationLabel,
  participationLabel,
  participationIcon,
  startTimeLabel,
  startTimeValue,
  distanceLabel,
  elevationGainLabel,
  elevationLossLabel,
  elevationCaption,
  descentCaption,
  planDurationLabel,
  planDurationCaption,
  planPaceLabel,
  planPaceCaption,
  backLabel,
  linksLabel,
  closeLabel,
  theme,
  socialLinks,
  emergency,
  onBack,
  onCallEmergency,
  onOpenLocation,
  onOpenSocial,
  onExpandedBodyHeightChange,
}: Props) {
  const [isCompact, setIsCompact] = useState(false);
  const [linksVisible, setLinksVisible] = useState(false);
  const expandedHeight = topInset + expandedBodyHeight;
  const compactHeight = topInset + RACEBOOK_HERO_COMPACT_BODY_HEIGHT;
  const collapseDistance = expandedHeight - compactHeight;
  const heroHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [expandedHeight, compactHeight],
    extrapolate: 'clamp',
  });
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.58, collapseDistance * 0.82],
    outputRange: [1, 0.86, 0],
    extrapolate: 'clamp',
  });
  const compactOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.68, collapseDistance],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const compactActionCount = (socialLinks.length > 0 ? 1 : 0) + (isCompact && emergency && onCallEmergency ? 1 : 0);

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const nextCompact = value >= collapseDistance * 0.72;
      setIsCompact((current) => current === nextCompact ? current : nextCompact);
    });
    return () => scrollY.removeListener(listenerId);
  }, [collapseDistance, scrollY]);

  const handleExpandedLayout = useCallback((event: LayoutChangeEvent) => {
    onExpandedBodyHeightChange?.(Math.ceil(event.nativeEvent.layout.height - topInset));
  }, [onExpandedBodyHeightChange, topInset]);

  return (
    <Animated.View
      style={[
        styles.hero,
        {
          height: heroHeight,
          backgroundColor: theme.primaryColor,
        },
      ]}
    >
      <StatusBar style={theme.onPrimaryColor === '#FFFFFF' ? 'light' : 'dark'} />
      {imageUrl ? (
        <Animated.View style={[styles.heroImage, { top: topInset, opacity: expandedOpacity }]}>
          <Animated.Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.primaryColor, opacity: imageUrl ? 0.92 : 1 }]} />
      {imageUrl ? <Animated.View style={[StyleSheet.absoluteFill, styles.contrastVeil, { opacity: expandedOpacity }]} /> : null}

      <Pressable
        accessibilityLabel={backLabel}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, { top: topInset + 8 }, pressed && styles.pressed]}
        testID="racebook-back-to-catalog"
      >
        <Ionicons name="chevron-back" size={25} color={theme.onPrimaryColor} />
      </Pressable>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.compactContent,
          {
            top: topInset,
            right: 14 + compactActionCount * 48,
            height: RACEBOOK_HERO_COMPACT_BODY_HEIGHT,
            opacity: compactOpacity,
          },
        ]}
      >
        <View style={styles.compactTitleWrap}>
          <Text numberOfLines={1} style={[styles.compactTitle, { color: theme.onPrimaryColor }]}>{raceName}</Text>
          {(Boolean(eventName && eventName !== raceName) || Boolean(startTimeValue)) ? (
            <Text numberOfLines={1} style={[styles.compactKicker, { color: theme.onPrimaryColor }]}>
              {[
                eventName && eventName !== raceName ? eventName : null,
                startTimeValue ? `${startTimeLabel} ${startTimeValue}` : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
      </Animated.View>

      {socialLinks.length > 0 ? (
        <View style={[styles.persistentSocialActions, { top: topInset + 8 }]}>
          {isCompact && emergency && onCallEmergency ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={emergency.accessibilityLabel}
              onPress={onCallEmergency}
              style={({ pressed }) => [styles.socialAction, styles.compactEmergencyAction, pressed && styles.pressed]}
            >
              <Ionicons name="call" size={17} color={theme.onPrimaryColor} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={linksLabel}
            onPress={() => setLinksVisible(true)}
            style={({ pressed }) => [styles.socialAction, pressed && styles.pressed]}
          >
            <Ionicons name="link-outline" size={18} color={theme.onPrimaryColor} />
          </Pressable>
        </View>
      ) : isCompact && emergency && onCallEmergency ? (
        <View style={[styles.persistentSocialActions, { top: topInset + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={emergency.accessibilityLabel}
            onPress={onCallEmergency}
            style={({ pressed }) => [styles.socialAction, styles.compactEmergencyAction, pressed && styles.pressed]}
          >
            <Ionicons name="call" size={17} color={theme.onPrimaryColor} />
          </Pressable>
        </View>
      ) : null}

      <Animated.View
        onLayout={handleExpandedLayout}
        style={[styles.expandedContent, { paddingTop: topInset + 10, opacity: expandedOpacity }]}
      >
        <View style={[styles.topRow, { paddingRight: socialLinks.length > 0 ? 48 : 0 }]}>
          <View style={styles.heading}>
            {eventName && eventName !== raceName ? (
              <Text style={[styles.kicker, { color: theme.onPrimaryColor }]}>{eventName}</Text>
            ) : null}
            <Heading numberOfLines={2} variant="h1" style={[styles.title, { color: theme.onPrimaryColor }]}>{raceName}</Heading>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.metaGroup}>
            {dateLabel ? <Meta icon="calendar-outline" label={dateLabel} color={theme.onPrimaryColor} /> : null}
            {locationLabel && onOpenLocation ? (
              <Pressable accessibilityRole="link" onPress={onOpenLocation} style={({ pressed }) => [pressed && styles.pressed]}>
                <Meta icon="location-outline" label={locationLabel} color={theme.onPrimaryColor} underlined />
              </Pressable>
            ) : locationLabel ? <Meta icon="location-outline" label={locationLabel} color={theme.onPrimaryColor} /> : null}
            {participationLabel ? <Meta icon={participationIcon} label={participationLabel} color={theme.onPrimaryColor} /> : null}
          </View>
          {startTimeValue ? (
            <View style={styles.startTimeBadge}>
              <Ionicons name="time-outline" size={17} color={theme.onPrimaryColor} />
              <View style={styles.startTimeCopy}>
                <Text numberOfLines={1} style={[styles.startTimeLabel, { color: theme.onPrimaryColor }]}>{startTimeLabel}</Text>
                <DataText numberOfLines={1} style={[styles.startTimeValue, { color: theme.onPrimaryColor }]}>{startTimeValue}</DataText>
              </View>
            </View>
          ) : null}
          {logoUrl ? (
            <View style={styles.logoSurface}>
              <RacebookBrandLogo uri={logoUrl} style={styles.logo} accessibilityLabel={eventName ?? raceName} />
            </View>
          ) : null}
        </View>

        <View style={styles.metrics}>
          <Metric value={distanceLabel} label="Distance" color={theme.onPrimaryColor} />
          <View style={[styles.metricDivider, { backgroundColor: theme.onPrimaryColor }]} />
          <Metric value={elevationGainLabel} label={elevationCaption} color={theme.onPrimaryColor} />
          {elevationLossLabel ? (
            <>
              <View style={[styles.metricDivider, { backgroundColor: theme.onPrimaryColor }]} />
              <Metric value={elevationLossLabel} label={descentCaption} color={theme.onPrimaryColor} />
            </>
          ) : null}
          {planDurationLabel ? (
            <>
              <View style={[styles.metricDivider, { backgroundColor: theme.onPrimaryColor }]} />
              <Metric value={planDurationLabel} label={planDurationCaption} color={theme.onPrimaryColor} />
            </>
          ) : null}
          {planPaceLabel ? (
            <>
              <View style={[styles.metricDivider, { backgroundColor: theme.onPrimaryColor }]} />
              <Metric value={planPaceLabel} label={planPaceCaption} color={theme.onPrimaryColor} />
            </>
          ) : null}
        </View>
        {emergency && onCallEmergency ? (
          <View style={styles.emergencyRow}>
            <Ionicons name="medical" size={16} color={theme.onPrimaryColor} />
            <View style={styles.emergencyCopy}>
              <Text numberOfLines={1} style={[styles.emergencyLabel, { color: theme.onPrimaryColor }]}>
                {emergency.name ? `${emergency.label} · ${emergency.name}` : emergency.label}
              </Text>
              <DataText numberOfLines={1} style={[styles.emergencyPhone, { color: theme.onPrimaryColor }]}>
                {emergency.phone}
              </DataText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={emergency.accessibilityLabel}
              onPress={onCallEmergency}
              style={({ pressed }) => [styles.emergencyCallButton, pressed && styles.pressed]}
            >
              <Ionicons name="call" size={16} color={theme.onPrimaryColor} />
              <Text style={[styles.emergencyCallLabel, { color: theme.onPrimaryColor }]}>{emergency.callLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
      <Modal
        animationType="fade"
        onRequestClose={() => setLinksVisible(false)}
        transparent
        visible={linksVisible}
      >
        <Pressable accessibilityRole="button" onPress={() => setLinksVisible(false)} style={styles.linksBackdrop}>
          <Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={styles.linksSheet}>
            <View style={styles.linksHeader}>
              <Heading variant="h3" style={styles.linksTitle}>{linksLabel}</Heading>
              <Pressable
                accessibilityLabel={closeLabel}
                accessibilityRole="button"
                onPress={() => setLinksVisible(false)}
                style={({ pressed }) => [styles.linksClose, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </Pressable>
            </View>
            {socialLinks.map((link) => (
              <Pressable
                key={link.action}
                accessibilityRole="link"
                onPress={() => {
                  setLinksVisible(false);
                  onOpenSocial(link.url, link.action);
                }}
                style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
              >
                <Ionicons name={link.icon} size={20} color={Colors.brandPrimary} />
                <Text style={styles.linkLabel}>{link.accessibilityLabel}</Text>
                <Ionicons name="open-outline" size={18} color={Colors.textSecondary} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

function Meta({ icon, label, color, underlined = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; underlined?: boolean }) {
  return <View style={styles.metaItem}><Ionicons name={icon} size={18} color={color} /><Text numberOfLines={1} style={[styles.meta, { color }, underlined && styles.metaLink]}>{label}</Text></View>;
}

function Metric({ value, label, color }: { value: string; label: string; color: string }) {
  return <View style={styles.metric}><DataText adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.metricValue, { color }]}>{value}</DataText><Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={[styles.metricLabel, { color }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  hero: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#1A1A1A', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  heroImage: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  contrastVeil: { backgroundColor: 'rgba(0,0,0,0.14)' },
  backButton: { position: 'absolute', zIndex: 4, left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: 'rgba(0,0,0,0.22)' },
  pressed: { opacity: 0.64 },
  compactContent: { position: 'absolute', left: 72, flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactTitleWrap: { flex: 1, minWidth: 0 },
  compactTitle: { fontSize: 17, lineHeight: 21, fontWeight: '800' },
  compactKicker: { fontSize: 10, lineHeight: 13, fontWeight: '700', opacity: 0.78 },
  expandedContent: { position: 'absolute', top: 0, left: 0, right: 0, justifyContent: 'flex-start', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heading: { flex: 1, minWidth: 0, minHeight: 50, justifyContent: 'center', gap: 2, paddingLeft: 56 },
  kicker: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.86 },
  title: { fontSize: 29, lineHeight: 33 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoSurface: { width: 62, height: 52, flexShrink: 0, padding: 5, borderRadius: 13, backgroundColor: Colors.surface },
  logo: { width: '100%', height: '100%' },
  persistentSocialActions: { position: 'absolute', zIndex: 5, right: 16, flexDirection: 'row', gap: 4 },
  socialAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)', backgroundColor: 'rgba(0,0,0,0.18)' },
  compactEmergencyAction: { backgroundColor: 'rgba(176,28,28,0.44)' },
  metaGroup: { flex: 1, minWidth: 0, gap: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  meta: { flexShrink: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  metaLink: { textDecorationLine: 'underline' },
  startTimeBadge: { flexShrink: 0, minWidth: 82, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 9, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(0,0,0,0.18)' },
  startTimeCopy: { alignItems: 'flex-start' },
  startTimeLabel: { fontSize: 9, lineHeight: 12, fontWeight: '700', opacity: 0.76 },
  startTimeValue: { fontSize: 15, lineHeight: 18, fontWeight: '900' },
  metrics: { minHeight: 54, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(0,0,0,0.18)' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 7 },
  metricValue: { fontSize: 14, lineHeight: 18, fontWeight: '800', textAlign: 'center' },
  metricLabel: { fontSize: 9, lineHeight: 12, fontWeight: '700', textAlign: 'center', opacity: 0.76 },
  metricDivider: { width: 1, marginVertical: 10, opacity: 0.24 },
  emergencyRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(0,0,0,0.18)' },
  emergencyCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  emergencyLabel: { flexShrink: 1, minWidth: 0, fontSize: 11, lineHeight: 15, fontWeight: '700', opacity: 0.78 },
  emergencyPhone: { flexShrink: 0, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  emergencyCallButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', backgroundColor: 'rgba(255,255,255,0.1)' },
  emergencyCallLabel: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  linksBackdrop: { flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: 'rgba(26,26,26,0.42)' },
  linksSheet: { gap: 8, padding: 16, borderRadius: 20, backgroundColor: Colors.surface },
  linksHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  linksTitle: { flex: 1, color: Colors.textPrimary },
  linksClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: Colors.surfaceSecondary },
  linkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: Colors.surfaceSecondary },
  linkLabel: { flex: 1, color: Colors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700' },
});
