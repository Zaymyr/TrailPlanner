import { memo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

type ProfilePerformanceSectionProps = {
  title: string;
  subtitle: string;
  effortTitle: string;
  effortHint: string;
  waterBagLabel: string;
  utmbIndexLabel: string;
  comfortableFlatPaceLabel: string;
  paceMinutesLabel: string;
  paceSecondsLabel: string;
  planDefaultsTitle: string;
  planDefaultsHint: string;
  estimatorInlineHint: string;
  estimatorButtonLabel: string;
  defaultCarbsLabel: string;
  defaultWaterLabel: string;
  defaultSodiumLabel: string;
  waterBagOptions: number[];
  waterBagLiters: number;
  utmbIndex: string;
  paceMinutes: string;
  paceSeconds: string;
  defaultCarbsPerHour: string;
  defaultWaterPerHour: string;
  defaultSodiumPerHour: string;
  onSelectWaterBag: (value: number) => void;
  onChangeUtmbIndex: (value: string) => void;
  onChangePaceMinutes: (value: string) => void;
  onChangePaceSeconds: (value: string) => void;
  onChangeDefaultCarbs: (value: string) => void;
  onChangeDefaultWater: (value: string) => void;
  onChangeDefaultSodium: (value: string) => void;
  onOpenEstimator: () => void;
};

function ProfilePerformanceSectionComponent({
  title,
  subtitle,
  effortTitle,
  effortHint,
  waterBagLabel,
  utmbIndexLabel,
  comfortableFlatPaceLabel,
  paceMinutesLabel,
  paceSecondsLabel,
  planDefaultsTitle,
  planDefaultsHint,
  estimatorInlineHint,
  estimatorButtonLabel,
  defaultCarbsLabel,
  defaultWaterLabel,
  defaultSodiumLabel,
  waterBagOptions,
  waterBagLiters,
  utmbIndex,
  paceMinutes,
  paceSeconds,
  defaultCarbsPerHour,
  defaultWaterPerHour,
  defaultSodiumPerHour,
  onSelectWaterBag,
  onChangeUtmbIndex,
  onChangePaceMinutes,
  onChangePaceSeconds,
  onChangeDefaultCarbs,
  onChangeDefaultWater,
  onChangeDefaultSodium,
  onOpenEstimator,
}: ProfilePerformanceSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="speedometer-outline" size={20} color={Colors.brandLight} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>{waterBagLabel}</Text>
        <View style={styles.waterBagRow}>
          {waterBagOptions.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.waterBtn, waterBagLiters === opt && styles.waterBtnActive]}
              onPress={() => onSelectWaterBag(opt)}
            >
              <Text style={[styles.waterBtnText, waterBagLiters === opt && styles.waterBtnTextActive]}>
                {opt}L
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.group}>
        <Text style={styles.groupTitle}>{effortTitle}</Text>
        <Text style={styles.groupHint}>{effortHint}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricBlock}>
            <Text style={styles.label}>{utmbIndexLabel}</Text>
            <TextInput
              style={[styles.textInput, styles.metricTextInput]}
              value={utmbIndex}
              onChangeText={onChangeUtmbIndex}
              placeholder="600"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <View style={styles.metricBlock}>
            <Text style={styles.label}>{comfortableFlatPaceLabel}</Text>
            <View style={styles.paceCard}>
              <View style={styles.paceInputGroup}>
                <Text style={styles.paceLabel}>{paceMinutesLabel}</Text>
                <TextInput
                  style={styles.paceInput}
                  value={paceMinutes}
                  onChangeText={onChangePaceMinutes}
                  placeholder="6"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text style={styles.paceSeparator}>:</Text>
              <View style={styles.paceInputGroup}>
                <Text style={styles.paceLabel}>{paceSecondsLabel}</Text>
                <TextInput
                  style={styles.paceInput}
                  value={paceSeconds}
                  onChangeText={onChangePaceSeconds}
                  placeholder="00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text style={styles.paceInlineUnit}>min/km</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.group}>
        <Text style={styles.inlineSectionTitle}>{planDefaultsTitle}</Text>
        <Text style={styles.groupHint}>{planDefaultsHint}</Text>
        <Text style={styles.groupHint}>{estimatorInlineHint}</Text>

        <TouchableOpacity style={styles.estimateTargetsButton} onPress={onOpenEstimator}>
          <Ionicons name="sparkles-outline" size={16} color={Colors.brandPrimary} />
          <Text style={styles.estimateTargetsButtonText}>{estimatorButtonLabel}</Text>
        </TouchableOpacity>

        <View style={styles.targetsStack}>
          <View style={[styles.targetRow, styles.targetRowBordered]}>
            <Text style={styles.targetLabel}>{defaultCarbsLabel}</Text>
            <View style={styles.targetInputShell}>
              <TextInput
                style={styles.targetInput}
                value={defaultCarbsPerHour}
                onChangeText={onChangeDefaultCarbs}
                placeholder="70"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.targetUnit}>g</Text>
            </View>
          </View>

          <View style={[styles.targetRow, styles.targetRowBordered]}>
            <Text style={styles.targetLabel}>{defaultWaterLabel}</Text>
            <View style={styles.targetInputShell}>
              <TextInput
                style={styles.targetInput}
                value={defaultWaterPerHour}
                onChangeText={onChangeDefaultWater}
                placeholder="500"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
              />
              <Text style={styles.targetUnit}>ml</Text>
            </View>
          </View>

          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>{defaultSodiumLabel}</Text>
            <View style={styles.targetInputShell}>
              <TextInput
                style={styles.targetInput}
                value={defaultSodiumPerHour}
                onChangeText={onChangeDefaultSodium}
                placeholder="600"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
              />
              <Text style={styles.targetUnit}>mg</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export const ProfilePerformanceSection = memo(ProfilePerformanceSectionComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE3C8',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  group: {
    gap: 10,
  },
  groupTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  groupHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  waterBagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  waterBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  waterBtnActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  waterBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  waterBtnTextActive: {
    color: Colors.textOnBrand,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricBlock: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 132,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 0,
  },
  textInput: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  metricTextInput: {
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  paceCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  paceInputGroup: {
    width: 58,
    gap: 4,
  },
  paceLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  paceInput: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  paceSeparator: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    paddingBottom: 8,
  },
  paceInlineUnit: {
    marginLeft: 'auto',
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    overflow: 'hidden',
  },
  inlineSectionTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  estimateTargetsButton: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  estimateTargetsButtonText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  targetsStack: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    overflow: 'hidden',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  targetRowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  targetLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  targetInputShell: {
    width: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  targetInput: {
    flex: 1,
    backgroundColor: 'transparent',
    color: Colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 0,
  },
  targetUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 24,
  },
});
