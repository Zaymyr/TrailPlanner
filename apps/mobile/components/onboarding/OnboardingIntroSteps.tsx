import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Text } from '../themed/Text';

type OnboardingShellProps = {
  children: ReactNode;
  onSkip?: () => void;
  skipDisabled?: boolean;
  skipLabel?: string;
  step: number;
  totalSteps: number;
  stepLabel: string;
};

export function OnboardingShell({
  children,
  onSkip,
  skipDisabled = false,
  skipLabel,
  step,
  totalSteps,
  stepLabel,
}: OnboardingShellProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topGlow} />
      <ScrollView
        contentContainerStyle={styles.shellScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.hero}>
            <View style={styles.heroTitleRow}>
              <Text style={styles.logo}>Pace Yourself</Text>
              {onSkip && skipLabel ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={skipLabel}
                  activeOpacity={0.7}
                  disabled={skipDisabled}
                  hitSlop={8}
                  onPress={onSkip}
                  style={[styles.skipOnboardingButton, skipDisabled && styles.buttonDisabled]}
                >
                  {skipDisabled ? (
                    <ActivityIndicator color={Colors.textSecondary} size="small" />
                  ) : (
                    <Text style={styles.skipOnboardingButtonText}>{skipLabel}</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.stepIndicator}>
              {stepLabel.replace('{step}', String(step)).replace('{total}', String(totalSteps))}
            </Text>
            <View style={styles.progressRow}>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <View
                  key={`progress-${index + 1}`}
                  style={[
                    styles.progressSegment,
                    index < step ? styles.progressSegmentActive : styles.progressSegmentInactive,
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={styles.card}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type OnboardingTourChoiceProps = {
  busy: boolean;
  discoverLaterLabel: string;
  onChoosePlan: () => void;
  onChooseRacebook: () => void;
  onDiscoverLater: () => void;
  planBody: string;
  planTitle: string;
  racebookBody: string;
  racebookTitle: string;
  stepLabel: string;
  subtitle: string;
  title: string;
};

export function OnboardingTourChoice({
  busy,
  discoverLaterLabel,
  onChoosePlan,
  onChooseRacebook,
  onDiscoverLater,
  planBody,
  planTitle,
  racebookBody,
  racebookTitle,
  stepLabel,
  subtitle,
  title,
}: OnboardingTourChoiceProps) {
  return (
    <OnboardingShell step={1} totalSteps={1} stepLabel={stepLabel}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <TourChoiceCard icon="map-outline" title={planTitle} body={planBody} disabled={busy} onPress={onChoosePlan} />
      <TourChoiceCard
        icon="book-outline"
        title={racebookTitle}
        body={racebookBody}
        disabled={busy}
        onPress={onChooseRacebook}
      />
      <TouchableOpacity disabled={busy} onPress={onDiscoverLater} style={styles.secondaryButton}>
        {busy ? (
          <ActivityIndicator color={Colors.brandPrimary} />
        ) : (
          <Text style={styles.secondaryButtonText}>{discoverLaterLabel}</Text>
        )}
      </TouchableOpacity>
    </OnboardingShell>
  );
}

function TourChoiceCard({
  body,
  disabled,
  icon,
  onPress,
  title,
}: {
  body: string;
  disabled: boolean;
  icon: 'book-outline' | 'map-outline';
  onPress: () => void;
  title: string;
}) {
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={styles.phaseCard}>
      <View style={styles.phaseBadge}>
        <Ionicons name={icon} size={20} color={Colors.brandPrimary} />
      </View>
      <View style={styles.phaseBody}>
        <Text style={styles.phaseTitle}>{title}</Text>
        <Text style={styles.phaseText}>{body}</Text>
      </View>
    </TouchableOpacity>
  );
}

export type OnboardingOverviewPhase = {
  index: number;
  text: string;
  title: string;
};

type OnboardingOverviewStepProps = {
  accountContent?: ReactNode;
  kicker: string;
  onSkip: () => void;
  onStart: () => void;
  phases: OnboardingOverviewPhase[];
  skipDisabled: boolean;
  skipLabel: string;
  startLabel: string;
  stepLabel: string;
  subtitle: string;
  title: string;
  totalSteps: number;
};

export function OnboardingOverviewStep({
  accountContent,
  kicker,
  onSkip,
  onStart,
  phases,
  skipDisabled,
  skipLabel,
  startLabel,
  stepLabel,
  subtitle,
  title,
  totalSteps,
}: OnboardingOverviewStepProps) {
  return (
    <OnboardingShell
      step={1}
      totalSteps={totalSteps}
      stepLabel={stepLabel}
      skipLabel={skipLabel}
      skipDisabled={skipDisabled}
      onSkip={onSkip}
    >
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.phaseList}>
        {phases.map((item) => (
          <View key={item.title} style={styles.phaseCard}>
            <View style={styles.phaseBadgeFilled}>
              <Text style={styles.phaseBadgeText}>{item.index}</Text>
            </View>
            <View style={styles.phaseBody}>
              <Text style={styles.phaseTitle}>{item.title}</Text>
              <Text style={styles.phaseText}>{item.text}</Text>
            </View>
          </View>
        ))}
      </View>
      {accountContent ?? (
        <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
          <Text style={styles.primaryButtonText}>{startLabel}</Text>
        </TouchableOpacity>
      )}
    </OnboardingShell>
  );
}

export type OnboardingWorkflowGroup = {
  items: Array<{ text: string; title: string }>;
  label: string;
};

type OnboardingWorkflowStepProps = {
  groups: OnboardingWorkflowGroup[];
  kicker: string;
  onSkip: () => void;
  onStart: () => void;
  skipDisabled: boolean;
  skipLabel: string;
  startLabel: string;
  stepLabel: string;
  subtitle: string;
  title: string;
  totalSteps: number;
};

export function OnboardingWorkflowStep({
  groups,
  kicker,
  onSkip,
  onStart,
  skipDisabled,
  skipLabel,
  startLabel,
  stepLabel,
  subtitle,
  title,
  totalSteps,
}: OnboardingWorkflowStepProps) {
  const steps = groups.flatMap((group) => group.items);

  return (
    <OnboardingShell
      step={2}
      totalSteps={totalSteps}
      stepLabel={stepLabel}
      skipLabel={skipLabel}
      skipDisabled={skipDisabled}
      onSkip={onSkip}
    >
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.timelineGroups}>
        {groups.map((group) => (
          <View key={group.label} style={styles.timelineGroup}>
            <Text style={styles.timelineGroupLabel}>{group.label}</Text>
            <View style={styles.timelineGroupBody}>
              {group.items.map((item) => {
                const globalIndex = steps.findIndex((step) => step.title === item.title);
                const isLast = group.items[group.items.length - 1]?.title === item.title;

                return (
                  <View key={item.title} style={styles.timelineItem}>
                    <View style={styles.timelineMarkerColumn}>
                      <View style={styles.timelineBadge}>
                        <Text style={styles.timelineBadgeText}>{globalIndex + 1}</Text>
                      </View>
                      {!isLast ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <View style={styles.timelineCard}>
                      <Text style={styles.timelineTitle}>{item.title}</Text>
                      <Text style={styles.timelineText}>{item.text}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
        <Text style={styles.primaryButtonText}>{startLabel}</Text>
      </TouchableOpacity>
    </OnboardingShell>
  );
}

type OnboardingCompletionStepProps = {
  newPlanLabel: string;
  onContinue: () => void;
  onNewPlan: () => void;
  primaryLabel: string;
  stepLabel: string;
  subtitle: string;
  summaryLines: string[];
  summaryTitle: string;
  title: string;
  totalSteps: number;
};

export function OnboardingCompletionStep({
  newPlanLabel,
  onContinue,
  onNewPlan,
  primaryLabel,
  stepLabel,
  subtitle,
  summaryLines,
  summaryTitle,
  title,
  totalSteps,
}: OnboardingCompletionStepProps) {
  return (
    <OnboardingShell step={totalSteps} totalSteps={totalSteps} stepLabel={stepLabel}>
      <View style={styles.notificationIconWrap}>
        <Text style={styles.notificationIcon}>✓</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>{summaryTitle}</Text>
        {summaryLines.map((line, index) => (
          <Text key={`${index}-${line}`} style={styles.noticeText}>{line}</Text>
        ))}
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={onContinue}>
        <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={onNewPlan}>
        <Text style={styles.secondaryButtonText}>{newPlanLabel}</Text>
      </TouchableOpacity>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topGlow: {
    position: 'absolute',
    top: -60,
    left: -20,
    right: -20,
    height: 220,
    backgroundColor: Colors.brandSurface,
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
  },
  shellScrollContent: { flexGrow: 1 },
  inner: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 18 },
  heroTitleRow: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  logo: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.brandPrimary,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  skipOnboardingButton: {
    width: 64,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
  },
  skipOnboardingButtonText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  stepIndicator: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  progressRow: { flexDirection: 'row', gap: 8, marginTop: 14, width: '100%' },
  progressSegment: { flex: 1, height: 6, borderRadius: 999 },
  progressSegmentActive: { backgroundColor: Colors.brandPrimary },
  progressSegmentInactive: { backgroundColor: Colors.surfaceMuted },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  kicker: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  phaseList: { gap: 14, marginBottom: 28 },
  phaseCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phaseBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  phaseBadgeFilled: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  phaseBadgeText: { color: Colors.textOnBrand, fontSize: 14, fontWeight: '700' },
  phaseBody: { flex: 1 },
  phaseTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  phaseText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  timelineGroups: { gap: 16, marginBottom: 28 },
  timelineGroup: { gap: 10 },
  timelineGroupLabel: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timelineGroupBody: { gap: 12 },
  timelineItem: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  timelineMarkerColumn: { alignItems: 'center', width: 30 },
  timelineBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBadgeText: { color: Colors.textOnBrand, fontSize: 13, fontWeight: '700' },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.brandBorder,
    marginTop: 6,
    marginBottom: -6,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  timelineTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  timelineText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  primaryButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonText: { color: Colors.textOnBrand, fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  notificationIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  notificationIcon: { color: Colors.brandPrimary, fontSize: 34, fontWeight: '800' },
  noticeBox: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
    marginBottom: 24,
  },
  noticeTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  noticeText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
