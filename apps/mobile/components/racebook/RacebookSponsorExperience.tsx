import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Pressable,
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
import {
  createRacebookSponsorImpressionReporter,
  isRacebookSponsorSurfaceViewable,
  type RacebookSponsor,
  type RacebookSponsorContextualPlacement,
  type RacebookSponsorImpressionReporter,
} from '../../lib/racebookSponsors';

export function RacebookBrandLogo({ uri, style, accessibilityLabel }: {
  uri: string | null;
  style: StyleProp<ImageStyle>;
  accessibilityLabel: string;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || failedUri === uri) return null;
  return <Image source={{ uri }} style={style} resizeMode="contain" accessibilityLabel={accessibilityLabel} onError={() => setFailedUri(uri)} />;
}

function SponsorCard({ sponsor, discoverLabel, variant, theme, onLogoLoad }: { sponsor: RacebookSponsor; discoverLabel: string; variant: 'principal' | 'official' | 'service'; theme?: ResolvedRacebookTheme; onLogoLoad: () => void }) {
  const hasLink = Boolean(sponsor.clickUrl);
  const content = <View style={[styles.sponsorCard, variant === 'official' && styles.sponsorCardOfficial, variant === 'principal' && styles.sponsorCardPrincipal, variant === 'principal' && theme ? { backgroundColor: theme.primarySurfaceColor, borderColor: theme.primaryBorderColor, borderWidth: 1 } : null, variant === 'service' && styles.sponsorCardService]}>
    <Image source={{ uri: sponsor.logoUrl }} style={[styles.sponsorLogo, variant === 'official' && styles.sponsorLogoOfficial, variant === 'principal' && styles.sponsorLogoPrincipal, variant === 'service' && styles.sponsorLogoService]} resizeMode="contain" accessibilityLabel={sponsor.name} onLoad={onLogoLoad} />
    <View style={[styles.sponsorCopy, variant === 'official' && styles.sponsorCopyOfficial]}>
      <Text numberOfLines={1} style={[styles.sponsorName, variant === 'official' && styles.sponsorNameOfficial]}>{sponsor.name}</Text>
      {sponsor.category ? <Text numberOfLines={1} style={[styles.sponsorCategory, variant === 'official' && styles.sponsorCategoryOfficial]}>{sponsor.category}</Text> : null}
      {hasLink && variant !== 'official' ? <View style={styles.discoverRow}><Text style={[styles.discoverLabel, theme ? { color: theme.primaryForegroundColor } : null]}>{discoverLabel}</Text><Ionicons name="arrow-forward" size={14} color={theme?.primaryForegroundColor ?? Colors.brandPrimary} /></View> : null}
    </View>
  </View>;
  if (!hasLink) return content;
  return <Pressable accessibilityRole="link" accessibilityLabel={`${sponsor.name}, ${discoverLabel}`} onPress={() => Linking.openURL(sponsor.clickUrl!).catch(() => {})} style={({ pressed }) => [styles.sponsorPressable, pressed && styles.sponsorPressed]}>{content}</Pressable>;
}

function FeaturedSponsor({ sponsor, onLogoLoad }: { sponsor: RacebookSponsor; onLogoLoad: () => void }) {
  const content = <View style={styles.featuredSponsorRow}><Image source={{ uri: sponsor.logoUrl }} style={styles.featuredSponsorLogo} resizeMode="contain" accessibilityLabel={sponsor.name} onLoad={onLogoLoad} /><Text numberOfLines={1} style={styles.featuredSponsorName}>{sponsor.name}</Text></View>;
  if (!sponsor.clickUrl) return content;
  return <Pressable accessibilityRole="link" accessibilityLabel={sponsor.name} onPress={() => Linking.openURL(sponsor.clickUrl!).catch(() => {})} style={({ pressed }) => [styles.featuredSponsorPressable, pressed && styles.sponsorPressed]}>{content}</Pressable>;
}

export function RacebookLoadingScreen({ progress, sponsors, sponsorLabel, loadingLabel, viewportHeight, sponsorLookupDone, title, theme, onSponsorImpression }: { progress: number; sponsors: RacebookSponsor[]; sponsorLabel: string; loadingLabel: string; viewportHeight: number; sponsorLookupDone: boolean; title: string; theme: ResolvedRacebookTheme; onSponsorImpression?: RacebookSponsorImpressionReporter }) {
  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const highestProgress = useRef(progress);
  const [trackWidth, setTrackWidth] = useState(0);
  const [loadedSponsorIds, setLoadedSponsorIds] = useState<Set<string>>(() => new Set());
  const safeProgress = Math.max(0, Math.min(1, progress));
  const sponsorAreaHeight = Math.max(228, Math.min(292, viewportHeight * 0.31));

  useEffect(() => {
    const nextProgress = Math.max(highestProgress.current, safeProgress);
    highestProgress.current = nextProgress;
    const animation = Animated.timing(animatedProgress, { toValue: nextProgress, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [animatedProgress, safeProgress]);
  const reportImpression = useRef(onSponsorImpression ? createRacebookSponsorImpressionReporter(onSponsorImpression) : null);
  useEffect(() => { sponsors.filter((sponsor) => loadedSponsorIds.has(sponsor.id)).forEach((sponsor) => reportImpression.current?.(sponsor, 'loading')); }, [loadedSponsorIds, sponsors]);

  const progressWidth = animatedProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  const runnerTranslateX = animatedProgress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, trackWidth - 34)], extrapolate: 'clamp' });
  return <View style={styles.loadingScreen}><View style={styles.loadingIntro}>{RACEBOOK_EDITION_LOGO_ENABLED ? <RacebookBrandLogo uri={theme.logoUrl} style={[styles.loadingBrandLogo, { borderColor: theme.primaryBorderColor }]} accessibilityLabel={title} /> : null}<Heading variant="h3" style={styles.loadingTitle}>{title}</Heading></View><View style={styles.loadingProgressBlock}><View style={styles.loadingProgressTrack} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(safeProgress * 100) }}><Animated.View style={[styles.loadingProgressFill, { width: progressWidth, backgroundColor: theme.accentGraphicColor }]} /><Animated.View style={[styles.loadingRunner, { transform: [{ translateX: runnerTranslateX }] }]}><Ionicons name="walk" size={27} color={Colors.brandPrimary} /></Animated.View></View><View style={styles.loadingProgressCopy}><Text style={styles.loadingText}>{loadingLabel}</Text><DataText style={styles.loadingPercent}>{Math.round(safeProgress * 100)}%</DataText></View></View>{sponsors.length > 0 || !sponsorLookupDone ? <View style={[styles.featuredSponsors, { minHeight: sponsorAreaHeight }]}><Text style={styles.sponsorLoadingLabel}>{sponsorLabel}</Text><View style={styles.featuredSponsorPanel}>{sponsors.length > 0 ? sponsors.map((sponsor, index) => <View key={sponsor.id} style={styles.featuredSponsorSlot}>{index > 0 ? <View style={styles.featuredSponsorDivider} /> : null}<FeaturedSponsor sponsor={sponsor} onLogoLoad={() => setLoadedSponsorIds((current) => current.has(sponsor.id) ? current : new Set(current).add(sponsor.id))} /></View>) : <><View style={styles.featuredSponsorSlot}><View style={styles.featuredSponsorPlaceholder} /></View><View style={styles.featuredSponsorSlot}><View style={styles.featuredSponsorDivider} /><View style={styles.featuredSponsorPlaceholder} /></View></>}</View></View> : null}</View>;
}

export type SponsorBannerProps = {
  sponsors: RacebookSponsor[];
  /** Human-facing section label, e.g. "Partenaires officiels". */
  label: string;
  discoverLabel?: string;
  /** `hero` displays every partner. A contextual surface displays only matching partners. */
  placement?: 'hero' | Exclude<RacebookSponsorContextualPlacement, 'none'>;
  theme?: ResolvedRacebookTheme;
  /** Aggregate-only hook; never attach a runner identity or destination URL. */
  onSponsorImpression?: RacebookSponsorImpressionReporter;
};

/** A stable sponsor surface, reusable in a contextual RaceBook section. */
export function SponsorBanner({ sponsors, label, discoverLabel = 'Découvrir', placement = 'hero', theme, onSponsorImpression }: SponsorBannerProps) {
  const surfaceRef = useRef<View>(null);
  const [loadedSponsorIds, setLoadedSponsorIds] = useState<Set<string>>(() => new Set());
  const visibleSponsors = useMemo(() => placement === 'hero' ? sponsors : sponsors.filter((sponsor) => sponsor.contextualPlacement === placement), [placement, sponsors]);
  const loadedVisibleSponsors = useMemo(() => visibleSponsors.filter((sponsor) => loadedSponsorIds.has(sponsor.id)), [loadedSponsorIds, visibleSponsors]);
  const reportImpression = useRef(onSponsorImpression ? createRacebookSponsorImpressionReporter(onSponsorImpression) : null);
  useEffect(() => {
    if (loadedVisibleSponsors.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const checkVisibility = () => surfaceRef.current?.measureInWindow((_x, y, _width, height) => {
      if (cancelled) return;
      const viewportHeight = Dimensions.get('window').height;
      if (isRacebookSponsorSurfaceViewable(y, height, viewportHeight)) {
        loadedVisibleSponsors.forEach((sponsor) => reportImpression.current?.(sponsor, placement));
        return;
      }
      timer = setTimeout(checkVisibility, 600);
    });
    const initialTimer = setTimeout(checkVisibility, 0);
    return () => { cancelled = true; clearTimeout(initialTimer); if (timer) clearTimeout(timer); };
  }, [loadedVisibleSponsors, placement]);
  if (visibleSponsors.length === 0) return null;
  const principalSponsors = visibleSponsors.filter((sponsor) => sponsor.tier === 'principal');
  const officialSponsors = visibleSponsors.filter((sponsor) => sponsor.tier === 'official');
  const serviceSponsors = visibleSponsors.filter((sponsor) => sponsor.tier === 'service');
  const markLogoLoaded = (sponsorId: string) => setLoadedSponsorIds((current) => current.has(sponsorId) ? current : new Set(current).add(sponsorId));
  return <View ref={surfaceRef} style={styles.sponsorSurface} accessibilityRole="summary" accessibilityLabel={label}>
    <View style={styles.sponsorSurfaceHeading}><Text style={styles.sponsorSurfaceEyebrow}>{label}</Text><View style={styles.sponsorSurfaceRule} /></View>
    {principalSponsors.map((sponsor) => <SponsorCard key={sponsor.id} sponsor={sponsor} discoverLabel={discoverLabel} variant="principal" theme={theme} onLogoLoad={() => markLogoLoaded(sponsor.id)} />)}
    {officialSponsors.length > 0 ? <View style={styles.sponsorGrid}>{officialSponsors.map((sponsor) => <View key={sponsor.id} style={styles.sponsorGridItem}><SponsorCard sponsor={sponsor} discoverLabel={discoverLabel} variant="official" theme={theme} onLogoLoad={() => markLogoLoaded(sponsor.id)} /></View>)}</View> : null}
    {serviceSponsors.length > 0 ? <View style={styles.serviceSponsorList}>{serviceSponsors.map((sponsor) => <SponsorCard key={sponsor.id} sponsor={sponsor} discoverLabel={discoverLabel} variant="service" theme={theme} onLogoLoad={() => markLogoLoaded(sponsor.id)} />)}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 8, paddingTop: 28, paddingBottom: 20, gap: 26 }, loadingIntro: { width: '100%', alignItems: 'center', paddingHorizontal: 16, gap: 12 }, loadingBrandLogo: { width: 84, height: 64, borderRadius: 16, borderWidth: 1, backgroundColor: Colors.surface, padding: 8 }, loadingTitle: { color: Colors.textPrimary, textAlign: 'center' }, loadingProgressBlock: { width: '100%', gap: 12 }, loadingProgressTrack: { width: '100%', height: 7, borderRadius: 999, backgroundColor: Colors.surfaceMuted }, loadingProgressFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.brandLight }, loadingRunner: { position: 'absolute', top: -24, left: 0, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, loadingProgressCopy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, loadingText: { color: Colors.textSecondary, fontSize: 14 }, loadingPercent: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' }, featuredSponsors: { width: '100%', alignItems: 'center', gap: 10, marginTop: 8 }, sponsorLoadingLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }, featuredSponsorPanel: { width: '100%', flex: 1, overflow: 'hidden', borderRadius: 24, backgroundColor: Colors.surface, shadowColor: '#1A1A1A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, featuredSponsorSlot: { flex: 1, width: '100%' }, featuredSponsorPressable: { flex: 1, width: '100%' }, featuredSponsorRow: { flex: 1, width: '100%', minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 24, paddingVertical: 10 }, featuredSponsorDivider: { height: 1, marginHorizontal: 24, backgroundColor: Colors.border }, featuredSponsorLogo: { width: '88%', maxWidth: 280, flex: 1, minHeight: 72 }, featuredSponsorName: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textAlign: 'center' }, featuredSponsorPlaceholder: { flex: 1, minHeight: 78, marginHorizontal: 24, marginVertical: 14, borderRadius: 16, backgroundColor: Colors.surfaceSecondary, opacity: 0.7 },
  sponsorSurface: { gap: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, backgroundColor: Colors.surface, padding: 16 }, sponsorSurfaceHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, sponsorSurfaceEyebrow: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.45, textTransform: 'uppercase' }, sponsorSurfaceRule: { flex: 1, height: 1, backgroundColor: Colors.border }, sponsorGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }, sponsorGridItem: { width: '33.3333%', padding: 3 }, serviceSponsorList: { gap: 8 }, sponsorPressable: { borderRadius: 14 }, sponsorPressed: { opacity: 0.65 }, sponsorCard: { minHeight: 132, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: Colors.surfaceSecondary, padding: 12 }, sponsorCardOfficial: { minHeight: 88, gap: 4, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 8 }, sponsorCardPrincipal: { minHeight: 150, flexDirection: 'row', justifyContent: 'flex-start', backgroundColor: Colors.brandLight }, sponsorCardService: { minHeight: 76, flexDirection: 'row', justifyContent: 'flex-start', paddingVertical: 10 }, sponsorLogo: { width: 64, height: 64 }, sponsorLogoOfficial: { width: 40, height: 34 }, sponsorLogoPrincipal: { width: 80, height: 80 }, sponsorLogoService: { width: 56, height: 56 }, sponsorCopy: { alignItems: 'center', gap: 2 }, sponsorCopyOfficial: { width: '100%', gap: 0 }, sponsorName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', textAlign: 'center' }, sponsorNameOfficial: { fontSize: 11, lineHeight: 14 }, sponsorCategory: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center' }, sponsorCategoryOfficial: { fontSize: 9, lineHeight: 12 }, discoverRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }, discoverLabel: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '800' },
});
