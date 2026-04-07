import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors } from '../constants/colors';

type Props = {
  planName?: string | null;
  progress: number;
  title: string;
  stage: string;
};

export function PlanLoadingScreen({
  planName,
  progress,
  title,
  stage,
}: Props) {
  const safeProgress = Math.max(0.08, Math.min(1, progress));

  return (
    <View style={styles.loadingScreen}>
      <View style={styles.loadingCard}>
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
        <Text style={styles.loadingTitle}>{title}</Text>
        {planName ? <Text style={styles.loadingPlanName}>{planName}</Text> : null}
        <View style={styles.loadingProgressTrack}>
          <View style={[styles.loadingProgressFill, { width: `${safeProgress * 100}%` }]} />
        </View>
        <Text style={styles.loadingStage}>{stage}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 24,
    alignItems: 'center',
  },
  loadingTitle: {
    color: Colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 18,
  },
  loadingPlanName: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    overflow: 'hidden',
    marginTop: 22,
  },
  loadingProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.brandPrimary,
  },
  loadingStage: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
});
