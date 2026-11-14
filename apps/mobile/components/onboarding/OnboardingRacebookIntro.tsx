import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { ActionButton } from '../themed/ActionButton';
import { Card } from '../themed/Card';
import { IconAction } from '../themed/IconAction';
import { StatusPill } from '../themed/StatusPill';
import { Text } from '../themed/Text';
import { TrailBlaze } from '../themed/TrailBlaze';
import { TrailSignButton } from '../themed/TrailSignButton';
import { OnboardingShell } from './OnboardingIntroSteps';

type IoniconName = keyof typeof Ionicons.glyphMap;

export type OnboardingRacebookIntroTab = {
  /** Same glyph as the RaceBook tab bar so the runner recognises it later. */
  icon: IoniconName;
  label: string;
  text: string;
};

export type OnboardingRacebookIntroCopy = {
  backLabel: string;
  chooseRaceCta: string;
  /** Promise shown right above the race choice: race or demo, then the guided tour. */
  chooseRaceHint?: string;
  discoverLater: string;
  goToPageLabel: string;
  kicker: string;
  nextCta: string;
  officialBadge: string;
  pagerLabel: string;
  planBody: string;
  planCta: string;
  planOptionalLabel: string;
  planTitle: string;
  promises: { icon: IoniconName; text: string; title: string }[];
  subtitle: string;
  tabsSubtitle: string;
  tabsTitle: string;
  title: string;
};

type OnboardingRacebookIntroProps = {
  busy: boolean;
  copy: OnboardingRacebookIntroCopy;
  onChoosePlan: () => void;
  onChooseRacebook: () => void;
  onDiscoverLater: () => void;
  tabs: OnboardingRacebookIntroTab[];
};

const PAGE_COUNT = 2;

/**
 * First-run presentation of the Livret coureur (the product the organizer
 * sells), then the race choice. The optional plan path stays secondary.
 * Pages switch instantly (no animation), so reduced motion needs no branch.
 */
export function OnboardingRacebookIntro({
  busy,
  copy,
  onChoosePlan,
  onChooseRacebook,
  onDiscoverLater,
  tabs,
}: OnboardingRacebookIntroProps) {
  const [page, setPage] = useState(0);

  // Android back returns to the first panel instead of leaving onboarding.
  useEffect(() => {
    if (page === 0) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setPage(0);
      return true;
    });
    return () => subscription.remove();
  }, [page]);

  const pagerText = copy.pagerLabel
    .replace('{page}', String(page + 1))
    .replace('{total}', String(PAGE_COUNT));

  return (
    <OnboardingShell showProgress={false}>
      <View style={styles.topRow}>
        {page > 0 ? (
          <IconAction accessibilityLabel={copy.backLabel} onPress={() => setPage(0)} variant="back" />
        ) : (
          <View style={styles.topRowSpacer} />
        )}
        <View accessibilityLabel={pagerText} accessible style={styles.pager}>
          {Array.from({ length: PAGE_COUNT }).map((_, index) => (
            <Pressable
              key={`intro-page-${index + 1}`}
              accessibilityLabel={copy.goToPageLabel.replace('{page}', String(index + 1))}
              accessibilityRole="button"
              accessibilityState={{ selected: index === page }}
              hitSlop={4}
              onPress={() => setPage(index)}
              style={styles.pagerTarget}
            >
              <View style={[styles.pagerDot, index === page && styles.pagerDotActive]} />
            </Pressable>
          ))}
        </View>
        <View style={styles.topRowSpacer} />
      </View>

      {page === 0 ? (
        <View>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons color={Colors.brandPrimary} name="book" size={34} />
            </View>
            <StatusPill label={copy.officialBadge} tone="brand" />
          </View>
          <Text style={styles.kicker}>{copy.kicker}</Text>
          <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
          <View style={styles.promiseList}>
            {copy.promises.map((promise) => (
              <View key={promise.title} style={styles.promiseRow}>
                <TrailBlaze size="sm" style={styles.promiseBlaze} />
                <Ionicons color={Colors.brandPrimary} name={promise.icon} size={20} style={styles.promiseIcon} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{promise.title}</Text>
                  <Text style={styles.rowText}>{promise.text}</Text>
                </View>
              </View>
            ))}
          </View>
          <ActionButton fullWidth onPress={() => setPage(1)} size="lg">
            {copy.nextCta}
          </ActionButton>
          <ActionButton isLoading={busy} onPress={onDiscoverLater} style={styles.softExit} variant="ghost">
            {copy.discoverLater}
          </ActionButton>
        </View>
      ) : (
        <View>
          <Text accessibilityRole="header" style={styles.title}>{copy.tabsTitle}</Text>
          <Text style={styles.subtitle}>{copy.tabsSubtitle}</Text>
          <View style={styles.tabList}>
            {tabs.map((tab) => (
              <View
                key={tab.label}
                accessibilityLabel={`${tab.label}. ${tab.text}`}
                accessible
                style={styles.tabRow}
              >
                <View style={styles.tabIcon}>
                  <Ionicons color={Colors.brandPrimary} name={tab.icon} size={20} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{tab.label}</Text>
                  <Text style={styles.rowText}>{tab.text}</Text>
                </View>
              </View>
            ))}
          </View>
          {copy.chooseRaceHint ? <Text style={styles.chooseRaceHint}>{copy.chooseRaceHint}</Text> : null}
          <TrailSignButton
            disabled={busy}
            fullWidth
            icon={<Ionicons color={Colors.textOnBrand} name="search" size={16} />}
            label={copy.chooseRaceCta}
            onPress={onChooseRacebook}
            tilt={0}
            variant="solid"
          />

          <Text accessibilityRole="header" style={styles.optionalLabel}>{copy.planOptionalLabel}</Text>
          <Card padded style={styles.planCard} surface="cream">
            <View style={styles.planRow}>
              <View style={styles.tabIcon}>
                <Ionicons color={Colors.brandPrimary} name="flag" size={20} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{copy.planTitle}</Text>
                <Text style={styles.rowText}>{copy.planBody}</Text>
              </View>
            </View>
            <TrailSignButton
              disabled={busy}
              label={copy.planCta}
              onPress={onChoosePlan}
              style={styles.planSign}
              variant="soft"
            />
          </Card>

          <ActionButton isLoading={busy} onPress={onDiscoverLater} style={styles.softExit} variant="ghost">
            {copy.discoverLater}
          </ActionButton>
        </View>
      )}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 48 },
  topRowSpacer: { width: 48, height: 48 },
  pager: { flexDirection: 'row', alignItems: 'center' },
  pagerTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pagerDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.brandPrimary, backgroundColor: 'transparent' },
  pagerDotActive: { width: 24, backgroundColor: Colors.brandPrimary },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    alignSelf: 'center',
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  promiseList: { gap: 14, marginBottom: 24 },
  promiseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  promiseBlaze: { marginTop: 2 },
  promiseIcon: { marginTop: 1 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  rowText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  tabList: { gap: 12, marginBottom: 24 },
  chooseRaceHint: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tabIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionalLabel: { marginTop: 28, marginBottom: 8, color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  planCard: { gap: 12 },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planSign: { alignSelf: 'flex-end', marginTop: 12 },
  softExit: { alignSelf: 'center', marginTop: 12 },
});
