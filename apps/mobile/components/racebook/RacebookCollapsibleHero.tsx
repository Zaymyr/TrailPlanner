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
import {
  RACE_WORKSPACE_ACTION_TOP_OFFSET,
  RACE_WORKSPACE_COMPACT_BODY_HEIGHT,
  RACE_WORKSPACE_TOOLBAR_HEIGHT,
  RaceWorkspaceCommonBlock,
  RaceWorkspaceCompactIdentity,
} from '../race-workspace/RaceWorkspaceHeaderCommon';

/** Initial expanded height before the content is measured. */
export const RACEBOOK_HERO_BODY_HEIGHT = 268;
export const RACEBOOK_HERO_COMPACT_BODY_HEIGHT = RACE_WORKSPACE_COMPACT_BODY_HEIGHT;

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
  /** Race/event photo, shown blurred and veiled so it never competes with the identity text. */
  imageUrl: string | null;
  logoUrl: string | null;
  dateLabel: string | null;
  locationLabel: string | null;
  participationLabel: string | null;
  participationIcon: keyof typeof Ionicons.glyphMap;
  startTimeLabel: string;
  startTimeValue: string | null;
  maxTimeLabel: string;
  maxTimeValue: string | null;
  distanceLabel: string;
  distanceCaption: string;
  elevationGainLabel: string;
  elevationLossLabel: string | null;
  elevationCaption: string;
  descentCaption: string;
  /** Plan metrics are shown only to runners who own a plan for this race. */
  showPlanMetrics: boolean;
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
  onOpenSocial: (url: string, action: string) => void;
  onExpandedBodyHeightChange?: (height: number) => void;
  /** A workspace switch is attached below: it carries the rounded edge and shadow. */
  attachedBelow?: boolean;
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
  maxTimeLabel,
  maxTimeValue,
  distanceLabel,
  distanceCaption,
  elevationGainLabel,
  elevationLossLabel,
  elevationCaption,
  descentCaption,
  showPlanMetrics,
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
  onOpenSocial,
  onExpandedBodyHeightChange,
  attachedBelow = false,
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
  // The expanded block is fully faded out before the compact identity starts
  // to appear, so the two titles never overlap mid-collapse.
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.3, collapseDistance * 0.55],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });
  const compactOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.6, collapseDistance * 0.9],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // The expanded block moves up with the shrinking hero, so its bottom edge
  // (metrics, footer) is never clipped by the hero's lower border.
  const expandedTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [0, -collapseDistance],
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
        attachedBelow && styles.heroAttached,
        {
          height: heroHeight,
          backgroundColor: theme.primaryColor,
        },
      ]}
    >
      <StatusBar style={theme.onPrimaryColor === '#FFFFFF' ? 'light' : 'dark'} />
      {imageUrl ? (
        <Animated.View style={[styles.heroImage, { top: topInset, opacity: expandedOpacity }]}>
          <Animated.Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={8} accessible={false} />
        </Animated.View>
      ) : null}
      {imageUrl ? <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.primaryColor, opacity: HERO_PHOTO_VEIL_OPACITY }]} /> : null}

      <Pressable
        accessibilityLabel={backLabel}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, { top: topInset + RACE_WORKSPACE_ACTION_TOP_OFFSET }, pressed && styles.pressed]}
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
        <RaceWorkspaceCompactIdentity title={raceName} courseName={eventName} startLabel={startTimeLabel} startTime={startTimeValue} color={theme.onPrimaryColor} />
      </Animated.View>

      {socialLinks.length > 0 ? (
        <View style={[styles.persistentSocialActions, { top: topInset + RACE_WORKSPACE_ACTION_TOP_OFFSET }]}>
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
        <View style={[styles.persistentSocialActions, { top: topInset + RACE_WORKSPACE_ACTION_TOP_OFFSET }]}>
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
        style={[styles.expandedContent, { paddingTop: topInset + RACE_WORKSPACE_TOOLBAR_HEIGHT, opacity: expandedOpacity, transform: [{ translateY: expandedTranslateY }] }]}
      >
        <RaceWorkspaceCommonBlock
          title={raceName}
          courseName={eventName}
          dateLabel={dateLabel}
          locationLabel={locationLabel}
          startLabel={startTimeLabel}
          startTime={startTimeValue}
          maxTimeLabel={maxTimeLabel}
          maxTime={maxTimeValue}
          color={theme.onPrimaryColor}
          metrics={[
            { label: distanceCaption, value: distanceLabel },
            { label: elevationCaption, value: elevationGainLabel },
            { label: descentCaption, value: elevationLossLabel ?? '—' },
            ...(showPlanMetrics ? [
              { label: planDurationCaption, value: planDurationLabel ?? '—' },
              { label: planPaceCaption, value: planPaceLabel ?? '—' },
            ] : []),
          ]}
          footer={participationLabel || logoUrl || (emergency && onCallEmergency) ? (
            <View style={styles.footerRow}>
              {logoUrl ? (
                <View style={styles.logoSurface}>
                  <RacebookBrandLogo uri={logoUrl} style={styles.logo} accessibilityLabel={eventName ?? raceName} />
                </View>
              ) : null}
              <View style={styles.footerCopy}>
                {participationLabel ? (
                  <>
                    <Ionicons name={participationIcon} size={16} color={theme.onPrimaryColor} />
                    <Text numberOfLines={1} style={[styles.footerText, { color: theme.onPrimaryColor }]}>{participationLabel}</Text>
                  </>
                ) : null}
                {participationLabel && emergency && onCallEmergency ? (
                  <Text style={[styles.footerText, { color: theme.onPrimaryColor }]}>·</Text>
                ) : null}
                {emergency && onCallEmergency ? (
                  <>
                    <Ionicons name="medical" size={14} color={theme.onPrimaryColor} />
                    <Text numberOfLines={1} style={[styles.footerText, styles.footerEmergencyLabel, { color: theme.onPrimaryColor }]}>{emergency.label}</Text>
                    <DataText numberOfLines={1} style={[styles.emergencyPhone, { color: theme.onPrimaryColor }]}>{emergency.phone}</DataText>
                  </>
                ) : null}
              </View>
              {emergency && onCallEmergency ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={emergency.accessibilityLabel}
                  onPress={onCallEmergency}
                  style={({ pressed }) => [styles.emergencyCallButton, pressed && styles.pressed]}
                >
                  <Ionicons name="call" size={16} color={theme.onPrimaryColor} />
                  <Text style={[styles.emergencyCallLabel, { color: theme.onPrimaryColor }]}>{emergency.callLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        />
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

const HERO_PHOTO_VEIL_OPACITY = 0.9;

const styles = StyleSheet.create({
  heroImage: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  hero: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#1A1A1A', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  heroAttached: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, shadowOpacity: 0, elevation: 0 },
  backButton: { position: 'absolute', zIndex: 4, left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: 'rgba(0,0,0,0.22)' },
  pressed: { opacity: 0.64 },
  compactContent: { position: 'absolute', left: 72, flexDirection: 'row', alignItems: 'center', gap: 10 },
  expandedContent: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 16 },
  logoSurface: { width: 44, height: 36, flexShrink: 0, padding: 4, borderRadius: 10, backgroundColor: Colors.surface },
  footerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { flexShrink: 0, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  footerEmergencyLabel: { flexShrink: 1, minWidth: 0, opacity: 0.86 },
  logo: { width: '100%', height: '100%' },
  persistentSocialActions: { position: 'absolute', zIndex: 5, right: 16, flexDirection: 'row', gap: 4 },
  socialAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)', backgroundColor: 'rgba(0,0,0,0.18)' },
  compactEmergencyAction: { backgroundColor: 'rgba(176,28,28,0.44)' },
  emergencyPhone: { flexShrink: 0, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  emergencyCallButton: { flexShrink: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', backgroundColor: 'rgba(255,255,255,0.1)' },
  emergencyCallLabel: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  linksBackdrop: { flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: 'rgba(26,26,26,0.42)' },
  linksSheet: { gap: 8, padding: 16, borderRadius: 20, backgroundColor: Colors.surface },
  linksHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  linksTitle: { flex: 1, color: Colors.textPrimary },
  linksClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: Colors.surfaceSecondary },
  linkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: Colors.surfaceSecondary },
  linkLabel: { flex: 1, color: Colors.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700' },
});
