import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';

import type { MobileTranslations } from '../../locales/types';
import type { FreeTrainingResourceKey } from '../../lib/freeTrainingLive';
import { getNutritionStats } from '../../lib/raceLiveSession';
import { Colors } from '../../constants/colors';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { LiveFuelGauge } from './LiveFuelGauge';
import { LiveNextIntakeCard } from './LiveNextIntakeCard';

type TrainingLiveStats = ReturnType<typeof getNutritionStats>;

type TrainingLiveSessionProps = {
  activeResourceKeys: ReadonlySet<FreeTrainingResourceKey>;
  backButton: ReactNode;
  copy: MobileTranslations['trainingLive'];
  onAlertAction: (
    alertId: string,
    action: 'confirmed' | 'skipped' | 'snoozed',
    snoozeMinutes?: number,
  ) => Promise<void>;
  onStop: () => void;
  startedAt: Date;
  stats: TrainingLiveStats | null;
};

function formatDuration(totalMinutes: number | null) {
  if (totalMinutes === null) return '--';
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours <= 0) return `${safeMinutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function TrainingLiveSession({
  activeResourceKeys,
  backButton,
  copy,
  onAlertAction,
  onStop,
  startedAt,
  stats,
}: TrainingLiveSessionProps) {
  const activeMetrics = (stats?.metrics ?? []).filter((metric) =>
    activeResourceKeys.has(metric.key),
  );

  return (
    <>
      <Stack.Screen options={{ title: copy.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        style={styles.screen}
      >
        {backButton}

        <View style={styles.liveHero}>
          <View>
            <Text style={styles.kicker}>{copy.liveKicker}</Text>
            <DataText style={styles.liveChrono}>
              {formatDuration(stats?.elapsedMinutes ?? 0)}
            </DataText>
          </View>
          <Text style={styles.liveSummary}>
            {Math.round(stats?.totalCarbsConsumed ?? 0)} g glucides -{' '}
            {Math.round(stats?.totalWaterConsumed ?? 0)} ml eau -{' '}
            {Math.round(stats?.totalSodiumConsumed ?? 0)} mg sodium
          </Text>
        </View>

        <Text style={styles.sectionHeading}>{copy.nextIntake}</Text>
        <LiveNextIntakeCard
          alert={stats?.nextAlert ?? null}
          startedAt={startedAt}
          onConfirm={() => {
            if (stats?.nextAlert) void onAlertAction(stats.nextAlert.id, 'confirmed');
          }}
          onSnooze={(minutes) => {
            if (stats?.nextAlert) void onAlertAction(stats.nextAlert.id, 'snoozed', minutes);
          }}
          onSkip={() => {
            if (stats?.nextAlert) void onAlertAction(stats.nextAlert.id, 'skipped');
          }}
        />

        <Text style={styles.sectionHeading}>{copy.liveLevels}</Text>
        {activeMetrics.map((metric) => (
          <LiveFuelGauge key={metric.key} metric={metric} />
        ))}

        <Text style={styles.sectionHeading}>{copy.upcoming}</Text>
        {(stats?.upcomingAlerts ?? []).length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.mutedText}>{copy.emptyUpcoming}</Text>
          </View>
        ) : (
          stats?.upcomingAlerts.slice(0, 5).map((alert) => (
            <View key={alert.id} style={styles.listRow}>
              <DataText style={styles.listTime}>
                {formatClock(addMinutes(startedAt, alert.triggerMinutes))}
              </DataText>
              <View style={styles.listContent}>
                <Text style={styles.listTitle}>{alert.title}</Text>
                <Text style={styles.mutedText}>{alert.payload.detail}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionHeading}>{copy.recent}</Text>
        {(stats?.recentIntakes ?? []).length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.mutedText}>{copy.emptyRecent}</Text>
          </View>
        ) : (
          stats?.recentIntakes.map((intake) => (
            <View key={intake.alertId} style={styles.listRow}>
              <DataText style={styles.listTime}>
                {formatClock(new Date(intake.confirmedAt))}
              </DataText>
              <View style={styles.listContent}>
                <Text style={styles.listTitle}>{intake.detail}</Text>
                <DataText style={styles.mutedText}>
                  {Math.round(intake.carbsGrams)} g - {Math.round(intake.sodiumMg)} mg -{' '}
                  {Math.round(intake.waterMl)} ml
                </DataText>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.stopButton} onPress={onStop}>
          <Text style={styles.stopButtonText}>{copy.stop}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 14,
  },
  liveHero: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 8,
  },
  kicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  liveChrono: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
  liveSummary: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeading: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  mutedText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  listRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  listTime: {
    width: 54,
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  stopButton: {
    backgroundColor: Colors.dangerSurface,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f4c7c1',
  },
  stopButtonText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '800',
  },
});
