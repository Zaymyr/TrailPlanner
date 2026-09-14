import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RACEBOOK_EDITION_LOGO_ENABLED, type ResolvedRacebookTheme } from '@pace-yourself/design-system';

import { Colors } from '../../constants/colors';
import { DataText } from '../themed/DataText';
import { Heading } from '../themed/Heading';
import { Text } from '../themed/Text';
import type { RacebookSponsor } from '../../lib/racebookSponsors';

export function RacebookBrandLogo({ uri, style, accessibilityLabel }: {
  uri: string | null;
  style: StyleProp<ImageStyle>;
  accessibilityLabel: string;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || failedUri === uri) return null;

  return <Image source={{ uri }} style={style} resizeMode="contain" accessibilityLabel={accessibilityLabel} onError={() => setFailedUri(uri)} />;
}

function SponsorChip({ sponsor, compact = false }: { sponsor: RacebookSponsor; compact?: boolean }) {
  const content = (
    <View style={[styles.sponsorChip, compact && styles.sponsorChipCompact]}>
      <Image source={{ uri: sponsor.logoUrl }} style={[styles.sponsorLogo, compact && styles.sponsorLogoCompact]} resizeMode="contain" accessibilityLabel={sponsor.name} />
      <Text numberOfLines={1} style={[styles.sponsorName, compact && styles.sponsorNameCompact]}>{sponsor.name}</Text>
    </View>
  );

  if (!sponsor.clickUrl) return content;
  return <Pressable accessibilityRole="link" accessibilityLabel={sponsor.name} onPress={() => Linking.openURL(sponsor.clickUrl!).catch(() => {})} style={({ pressed }) => pressed && styles.sponsorPressed}>{content}</Pressable>;
}

function FeaturedSponsor({ sponsor }: { sponsor: RacebookSponsor }) {
  const content = <View style={styles.featuredSponsorRow}><Image source={{ uri: sponsor.logoUrl }} style={styles.featuredSponsorLogo} resizeMode="contain" accessibilityLabel={sponsor.name} /><Text numberOfLines={1} style={styles.featuredSponsorName}>{sponsor.name}</Text></View>;
  if (!sponsor.clickUrl) return content;
  return <Pressable accessibilityRole="link" accessibilityLabel={sponsor.name} onPress={() => Linking.openURL(sponsor.clickUrl!).catch(() => {})} style={({ pressed }) => [styles.featuredSponsorPressable, pressed && styles.sponsorPressed]}>{content}</Pressable>;
}

export function RacebookLoadingScreen({ progress, sponsors, sponsorLabel, loadingLabel, viewportHeight, sponsorLookupDone, title, theme }: { progress: number; sponsors: RacebookSponsor[]; sponsorLabel: string; loadingLabel: string; viewportHeight: number; sponsorLookupDone: boolean; title: string; theme: ResolvedRacebookTheme }) {
  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const highestProgress = useRef(progress);
  const [trackWidth, setTrackWidth] = useState(0);
  const safeProgress = Math.max(0, Math.min(1, progress));
  const sponsorAreaHeight = Math.max(228, Math.min(292, viewportHeight * 0.31));

  useEffect(() => {
    const nextProgress = Math.max(highestProgress.current, safeProgress);
    highestProgress.current = nextProgress;
    const animation = Animated.timing(animatedProgress, { toValue: nextProgress, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [animatedProgress, safeProgress]);

  const progressWidth = animatedProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  const runnerTranslateX = animatedProgress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, trackWidth - 34)], extrapolate: 'clamp' });

  return <View style={styles.loadingScreen}><View style={styles.loadingIntro}>{RACEBOOK_EDITION_LOGO_ENABLED ? <RacebookBrandLogo uri={theme.logoUrl} style={[styles.loadingBrandLogo, { borderColor: theme.primaryBorderColor }]} accessibilityLabel={title} /> : null}<Heading variant="h3" style={styles.loadingTitle}>{title}</Heading></View><View style={styles.loadingProgressBlock}><View style={styles.loadingProgressTrack} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(safeProgress * 100) }}><Animated.View style={[styles.loadingProgressFill, { width: progressWidth, backgroundColor: theme.accentColor }]} /><Animated.View style={[styles.loadingRunner, { transform: [{ translateX: runnerTranslateX }] }]}><Ionicons name="walk" size={27} color={Colors.brandPrimary} /></Animated.View></View><View style={styles.loadingProgressCopy}><Text style={styles.loadingText}>{loadingLabel}</Text><DataText style={styles.loadingPercent}>{Math.round(safeProgress * 100)}%</DataText></View></View>{sponsors.length > 0 || !sponsorLookupDone ? <View style={[styles.featuredSponsors, { minHeight: sponsorAreaHeight }]}><Text style={styles.sponsorLoadingLabel}>{sponsorLabel}</Text><View style={styles.featuredSponsorPanel}>{sponsors.length > 0 ? sponsors.map((sponsor, index) => <View key={sponsor.id} style={styles.featuredSponsorSlot}>{index > 0 ? <View style={styles.featuredSponsorDivider} /> : null}<FeaturedSponsor sponsor={sponsor} /></View>) : <><View style={styles.featuredSponsorSlot}><View style={styles.featuredSponsorPlaceholder} /></View><View style={styles.featuredSponsorSlot}><View style={styles.featuredSponsorDivider} /><View style={styles.featuredSponsorPlaceholder} /></View></>}</View></View> : null}</View>;
}

export function SponsorBanner({ sponsors, label }: { sponsors: RacebookSponsor[]; label: string }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const activeSlideIndex = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted && setReduceMotion(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    translateX.stopAnimation(); translateX.setValue(0); activeSlideIndex.current = 0;
    if (reduceMotion || sponsors.length < 2 || viewportWidth <= 0) return;
    const carouselTimer = setInterval(() => { const nextIndex = activeSlideIndex.current + 1; Animated.timing(translateX, { toValue: -nextIndex * viewportWidth, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (!finished) return; if (nextIndex === sponsors.length) { translateX.setValue(0); activeSlideIndex.current = 0; return; } activeSlideIndex.current = nextIndex; }); }, 3_000);
    return () => { clearInterval(carouselTimer); translateX.stopAnimation(); };
  }, [reduceMotion, sponsors.length, translateX, viewportWidth]);

  if (sponsors.length === 0) return null;
  if (reduceMotion || sponsors.length === 1) return <View style={styles.sponsorBanner}><Text style={styles.sponsorBannerLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sponsorBannerStaticRow}>{sponsors.map((sponsor) => <SponsorChip key={sponsor.id} sponsor={sponsor} compact />)}</ScrollView></View>;
  const carouselSponsors = [...sponsors, sponsors[0]];
  return <View style={styles.sponsorBanner}><Text style={styles.sponsorBannerLabel}>{label}</Text><View style={styles.sponsorBannerViewport} onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}><Animated.View style={[styles.sponsorBannerAnimatedRow, { transform: [{ translateX }] }]}>{carouselSponsors.map((sponsor, index) => { const loopCopy = index === sponsors.length; return <View key={loopCopy ? `loop-${sponsor.id}` : sponsor.id} pointerEvents={loopCopy ? 'none' : 'auto'} accessibilityElementsHidden={loopCopy} importantForAccessibility={loopCopy ? 'no-hide-descendants' : 'auto'} style={[styles.sponsorBannerSlide, { width: viewportWidth }]}><SponsorChip sponsor={sponsor} compact /></View>; })}</Animated.View></View></View>;
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 8, paddingTop: 28, paddingBottom: 20, gap: 26 }, loadingIntro: { width: '100%', alignItems: 'center', paddingHorizontal: 16, gap: 12 }, loadingBrandLogo: { width: 84, height: 64, borderRadius: 16, borderWidth: 1, backgroundColor: Colors.surface, padding: 8 }, loadingTitle: { color: Colors.textPrimary, textAlign: 'center' }, loadingProgressBlock: { width: '100%', gap: 12 }, loadingProgressTrack: { width: '100%', height: 7, borderRadius: 999, backgroundColor: Colors.surfaceMuted }, loadingProgressFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.brandLight }, loadingRunner: { position: 'absolute', top: -24, left: 0, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }, loadingProgressCopy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, loadingText: { color: Colors.textSecondary, fontSize: 14 }, loadingPercent: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' }, featuredSponsors: { width: '100%', alignItems: 'center', gap: 10, marginTop: 8 }, sponsorLoadingLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }, featuredSponsorPanel: { width: '100%', flex: 1, overflow: 'hidden', borderRadius: 24, backgroundColor: Colors.surface, shadowColor: '#1A1A1A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, featuredSponsorSlot: { flex: 1, width: '100%' }, featuredSponsorPressable: { flex: 1, width: '100%' }, featuredSponsorRow: { flex: 1, width: '100%', minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 24, paddingVertical: 10 }, featuredSponsorDivider: { height: 1, marginHorizontal: 24, backgroundColor: Colors.border }, featuredSponsorLogo: { width: '88%', maxWidth: 280, flex: 1, minHeight: 72 }, featuredSponsorName: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textAlign: 'center' }, featuredSponsorPlaceholder: { flex: 1, minHeight: 78, marginHorizontal: 24, marginVertical: 14, borderRadius: 16, backgroundColor: Colors.surfaceSecondary, opacity: 0.7 }, sponsorChip: { maxWidth: 150, alignItems: 'center', gap: 8 }, sponsorChipCompact: { maxWidth: 170, flexDirection: 'row', gap: 7 }, sponsorLogo: { width: 76, height: 76 }, sponsorLogoCompact: { width: 24, height: 24 }, sponsorName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', textAlign: 'center' }, sponsorNameCompact: { maxWidth: 130, fontSize: 12, textAlign: 'left' }, sponsorPressed: { opacity: 0.65 }, sponsorBanner: { minHeight: 44, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.surface, paddingHorizontal: 10, gap: 10 }, sponsorBannerLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }, sponsorBannerViewport: { flex: 1, overflow: 'hidden' }, sponsorBannerAnimatedRow: { flexDirection: 'row', alignItems: 'center' }, sponsorBannerSlide: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, sponsorBannerStaticRow: { flexGrow: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', gap: 22 },
});
