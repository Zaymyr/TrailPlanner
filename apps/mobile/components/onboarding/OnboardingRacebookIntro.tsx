import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { ActionButton } from '../themed/ActionButton';
import { IconAction } from '../themed/IconAction';
import { Text } from '../themed/Text';
import { TopoCard } from '../themed/TopoCard';
import { TrailSignButton } from '../themed/TrailSignButton';
import { OnboardingShell } from './OnboardingIntroSteps';

type IoniconName = keyof typeof Ionicons.glyphMap;

/** Who the app is for this time: the runner (Livret coureur) or a supporter (Livret supporter). */
export type OnboardingAudience = 'runner' | 'supporter';

export type OnboardingRacebookIntroTab = {
  /** Same glyph as the Livret tab bar so the reader recognises it later. */
  icon: IoniconName;
  label: string;
  text: string;
};

/** Presentation of one Livret: its promises, then its tabs and the race choice. */
export type OnboardingLivretIntro = {
  chooseRaceCta: string;
  /** Promise shown right above the race choice: race or demo, then the guided tour. */
  chooseRaceHint?: string;
  heroIcon: IoniconName;
  kicker: string;
  nextCta: string;
  promises: { icon: IoniconName; text: string; title: string }[];
  subtitle: string;
  tabs: OnboardingRacebookIntroTab[];
  tabsSubtitle: string;
  tabsTitle: string;
  title: string;
};

export type OnboardingRacebookIntroCopy = {
  audienceSubtitle: string;
  audienceTitle: string;
  backLabel: string;
  discoverLater: string;
  goToPageLabel: string;
  pagerLabel: string;
  runnerText: string;
  runnerTitle: string;
  supporterText: string;
  supporterTitle: string;
};

type OnboardingRacebookIntroProps = {
  busy: boolean;
  copy: OnboardingRacebookIntroCopy;
  livrets: Record<OnboardingAudience, OnboardingLivretIntro>;
  onChooseRace: (audience: OnboardingAudience) => void;
  onDiscoverLater: () => void;
};

const PAGE_COUNT = 3;

/**
 * First-run welcome: the reader says whether they race or support a runner,
 * which picks the Livret presented next (Livret coureur or Livret supporter),
 * then its tabs and the race choice as the single action. Plan creation is
 * offered later, from the RaceBook tour, so it is not a choice here.
 * Pages switch instantly (no animation), so reduced motion needs no branch.
 */
export function OnboardingRacebookIntro({
  busy,
  copy,
  livrets,
  onChooseRace,
  onDiscoverLater,
}: OnboardingRacebookIntroProps) {
  const [page, setPage] = useState(0);
  const [audience, setAudience] = useState<OnboardingAudience | null>(null);
  const livret = audience ? livrets[audience] : null;

  // Android back steps back one panel instead of leaving onboarding.
  useEffect(() => {
    if (page === 0) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setPage((current) => Math.max(0, current - 1));
      return true;
    });
    return () => subscription.remove();
  }, [page]);

  const pagerText = copy.pagerLabel
    .replace('{page}', String(page + 1))
    .replace('{total}', String(PAGE_COUNT));

  function chooseAudience(next: OnboardingAudience) {
    setAudience(next);
    setPage(1);
  }

  const audienceChoices: { audience: OnboardingAudience; icon: IoniconName; text: string; title: string }[] = [
    { audience: 'runner', icon: 'walk', title: copy.runnerTitle, text: copy.runnerText },
    { audience: 'supporter', icon: 'people', title: copy.supporterTitle, text: copy.supporterText },
  ];

  return (
    <OnboardingShell showProgress={false}>
      <View style={styles.topRow}>
        {page > 0 ? (
          <IconAction accessibilityLabel={copy.backLabel} onPress={() => setPage(page - 1)} variant="back" />
        ) : (
          <View style={styles.topRowSpacer} />
        )}
        <View accessibilityLabel={pagerText} accessible style={styles.pager}>
          {Array.from({ length: PAGE_COUNT }).map((_, index) => {
            // The Livret pages only exist once the audience is chosen.
            const reachable = index === 0 || Boolean(audience);
            return (
              <Pressable
                key={`intro-page-${index + 1}`}
                accessibilityLabel={copy.goToPageLabel.replace('{page}', String(index + 1))}
                accessibilityRole="button"
                accessibilityState={{ selected: index === page, disabled: !reachable }}
                disabled={!reachable}
                hitSlop={4}
                onPress={() => setPage(index)}
                style={styles.pagerTarget}
              >
                <View style={[styles.pagerDot, index === page && styles.pagerDotActive]} />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.topRowSpacer} />
      </View>

      {page === 0 || !livret || !audience ? (
        <View>
          <Text accessibilityRole="header" style={styles.title}>{copy.audienceTitle}</Text>
          <Text style={styles.subtitle}>{copy.audienceSubtitle}</Text>
          <View style={styles.choiceList}>
            {audienceChoices.map((choice) => (
              <TopoCard
                key={choice.audience}
                accessibilityLabel={`${choice.title}. ${choice.text}`}
                accessibilityRole="button"
                accessibilityState={{ selected: audience === choice.audience }}
                onPress={() => chooseAudience(choice.audience)}
                variant="interactive"
              >
                <View style={styles.choiceRow}>
                  <View style={styles.choiceIcon}>
                    <Ionicons color={Colors.brandPrimary} name={choice.icon} size={26} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.choiceTitle}>{choice.title}</Text>
                    <Text style={styles.rowText}>{choice.text}</Text>
                  </View>
                  <Ionicons color={Colors.brandPrimary} name="chevron-forward" size={20} />
                </View>
              </TopoCard>
            ))}
          </View>
          <ActionButton isLoading={busy} onPress={onDiscoverLater} style={styles.softExit} variant="ghost">
            {copy.discoverLater}
          </ActionButton>
        </View>
      ) : page === 1 ? (
        <View>
          <View style={styles.heroIcon}>
            <Ionicons color={Colors.brandPrimary} name={livret.heroIcon} size={34} />
          </View>
          <Text style={styles.kicker}>{livret.kicker}</Text>
          <Text accessibilityRole="header" style={styles.title}>{livret.title}</Text>
          <Text style={styles.subtitle}>{livret.subtitle}</Text>
          <View style={styles.promiseList}>
            {livret.promises.map((promise) => (
              <View key={promise.title} style={styles.promiseRow}>
                <View style={styles.tabIcon}>
                  <Ionicons color={Colors.brandPrimary} name={promise.icon} size={20} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{promise.title}</Text>
                  <Text style={styles.rowText}>{promise.text}</Text>
                </View>
              </View>
            ))}
          </View>
          <ActionButton fullWidth onPress={() => setPage(2)} size="lg">
            {livret.nextCta}
          </ActionButton>
          <ActionButton isLoading={busy} onPress={onDiscoverLater} style={styles.softExit} variant="ghost">
            {copy.discoverLater}
          </ActionButton>
        </View>
      ) : (
        <View>
          <Text accessibilityRole="header" style={styles.title}>{livret.tabsTitle}</Text>
          <Text style={styles.subtitle}>{livret.tabsSubtitle}</Text>
          <View style={styles.tabList}>
            {livret.tabs.map((tab) => (
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
          {livret.chooseRaceHint ? <Text style={styles.chooseRaceHint}>{livret.chooseRaceHint}</Text> : null}
          <TrailSignButton
            disabled={busy}
            fullWidth
            icon={<Ionicons color={Colors.textOnBrand} name="search" size={16} />}
            label={livret.chooseRaceCta}
            onPress={() => onChooseRace(audience)}
            tilt={0}
            variant="solid"
          />

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
  heroIcon: {
    alignSelf: 'center',
    marginBottom: 16,
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
  choiceList: { gap: 14, marginBottom: 12 },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  choiceIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 2 },
  promiseList: { gap: 14, marginBottom: 24 },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  softExit: { alignSelf: 'center', marginTop: 12 },
});
