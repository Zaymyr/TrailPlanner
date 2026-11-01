import { colors, radius, shadows, spacing } from '@pace-yourself/design-system';
import { StyleSheet, TextInput, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { DataText } from '../themed/DataText';
import { Heading } from '../themed/Heading';
import { Text, Text as ThemedText } from '../themed/Text';
import type { ElevationPoint, SectionSubSegmentStats } from './contracts';
import { ProfileMiniChart } from './ProfileMiniChart';
import { styles } from './styles';

type Props = {
  title: string;
  durationLabel: string;
  paceValue: string;
  profilePoints: ElevationPoint[];
  stats: SectionSubSegmentStats;
  alternateBackground: boolean;
  canSplit: boolean;
  canRemove: boolean;
  onPaceChange: (value: string) => void;
  onPaceBlur: () => void;
  onDecreasePace: () => void;
  onIncreasePace: () => void;
  onSplit: () => void;
  onRemove: () => void;
  readOnly?: boolean;
  previewIntent?: () => void;
};

export function AidStationProfileSegmentCard({
  title,
  durationLabel,
  paceValue,
  profilePoints,
  stats,
  alternateBackground,
  canSplit,
  canRemove,
  onPaceChange,
  onPaceBlur,
  onDecreasePace,
  onIncreasePace,
  onSplit,
  onRemove,
  readOnly = false,
  previewIntent,
}: Props) {
  const showControls = !readOnly || Boolean(previewIntent);
  const paceDecrease = previewIntent ?? onDecreasePace;
  const paceIncrease = previewIntent ?? onIncreasePace;
  const split = previewIntent ?? onSplit;
  const remove = previewIntent ?? onRemove;
  return (
    <View
      style={[
        styles.profileCard,
        localStyles.sectionCard,
        alternateBackground ? localStyles.cardCream : localStyles.cardWhite,
      ]}
    >
      <View style={styles.profileHeader}>
        <View style={styles.profileHeaderText}>
          <Heading variant="h3" style={localStyles.profileSegmentLabel}>
            {title}
          </Heading>
          <ThemedText tone="tertiary" size="xs" weight="semibold" style={localStyles.profileSegmentTimeLabel}>
            Temps estime
          </ThemedText>
          <DataText tone="brand" size="2xl" weight="bold" style={localStyles.profileSegmentTime}>
            {durationLabel}
          </DataText>
        </View>
        <View style={styles.profilePaceWrap}>
          <Text style={styles.profilePaceLabel}>Allure</Text>
          {!showControls ? (
            <DataText tone="brand" size="xl" weight="bold">{paceValue}</DataText>
          ) : <View style={styles.profilePaceControlRow}>
            <TouchableOpacity
              accessibilityLabel="Accélérer l’allure"
              accessibilityRole="button"
              style={styles.profilePaceStepBtn}
              onPress={paceDecrease}
              activeOpacity={0.8}
            >
              <Text style={styles.profilePaceStepBtnText}>-</Text>
            </TouchableOpacity>
            {previewIntent ? (
              <TouchableOpacity
                accessibilityLabel={`Allure ${title}`}
                accessibilityRole="button"
                onPress={previewIntent}
                style={[styles.profilePaceInput, localStyles.previewPaceButton]}
              >
                <DataText tone="brand" size="lg" weight="bold">{paceValue}</DataText>
              </TouchableOpacity>
            ) : <TextInput
              accessibilityLabel={`Allure ${title}`}
              style={styles.profilePaceInput}
              value={paceValue}
              onChangeText={onPaceChange}
              onBlur={onPaceBlur}
              keyboardType="numbers-and-punctuation"
              inputAccessoryViewID="pace-yourself-numeric-keyboard"
              placeholder="6:00"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />}
            <TouchableOpacity
              accessibilityLabel="Ralentir l’allure"
              accessibilityRole="button"
              style={styles.profilePaceStepBtn}
              onPress={paceIncrease}
              activeOpacity={0.8}
            >
              <Text style={styles.profilePaceStepBtnText}>+</Text>
            </TouchableOpacity>
          </View>}
          <Text style={styles.profilePaceHint}>min/km</Text>
        </View>
      </View>

      {profilePoints.length > 1 ? (
        <ProfileMiniChart points={profilePoints} />
      ) : (
        <Text style={styles.profileEmptyText}>Profil indisponible pour ce segment.</Text>
      )}

      <View style={styles.profileMetricsRow}>
        <View style={styles.profileMetricPill}>
          <DataText tone="secondary" size="xs" weight="semibold">
            {stats.distKm.toFixed(2)} km
          </DataText>
        </View>
        <View style={styles.profileMetricPill}>
          <DataText tone="secondary" size="xs" weight="semibold">
            D+ {Math.round(stats.dPlus)} m
          </DataText>
        </View>
        <View style={styles.profileMetricPill}>
          <DataText tone="secondary" size="xs" weight="semibold">
            D- {Math.round(stats.dMinus)} m
          </DataText>
        </View>
      </View>

      {showControls ? <View style={styles.profileSegmentControls}>
        <View style={styles.profileSegmentActions}>
          <TouchableOpacity
            accessibilityLabel={canSplit || previewIntent ? `Découper ${title}` : `Découpage indisponible pour ${title}`}
            accessibilityRole="button"
            style={[styles.profileActionBtn, !previewIntent && !canSplit && styles.profileActionBtnDisabled]}
            onPress={split}
            activeOpacity={0.8}
            disabled={!previewIntent && !canSplit}
          >
            <Text style={styles.profileActionBtnText}>
              {canSplit || previewIntent ? 'Decouper plus finement' : 'Decoupage indisponible sur ce segment'}
            </Text>
          </TouchableOpacity>

          {canRemove || previewIntent ? (
            <TouchableOpacity
              accessibilityLabel={`Supprimer ${title} et fusionner`}
              accessibilityRole="button"
              style={[styles.profileActionBtn, styles.profileDeleteBtn]}
              onPress={remove}
              activeOpacity={0.8}
            >
              <Text style={styles.profileDeleteBtnText}>Supprimer et fusionner</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View> : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  sectionCard: {
    borderRadius: radius.card,
    borderColor: colors.border.subtle,
    shadowOpacity: 0,
    elevation: 0,
    boxShadow: shadows.sm,
  } as ViewStyle,
  cardWhite: {
    backgroundColor: colors.surface.white,
  },
  cardCream: {
    backgroundColor: colors.surface.cream,
  },
  profileSegmentLabel: {
    color: colors.text.primary,
    fontSize: 17,
    lineHeight: 21,
  },
  profileSegmentTimeLabel: {
    marginTop: spacing[2],
  },
  profileSegmentTime: {
    marginTop: spacing[0.5],
  },
  previewPaceButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
