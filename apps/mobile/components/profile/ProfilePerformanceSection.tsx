import { memo } from 'react';
import { mobileComponents } from '@pace-yourself/design-system';
import {
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { Card } from '../themed/Card';
import { Field } from '../themed/Field';
import { Text } from '../themed/Text';
import { RidgeDivider } from '../themed/Ridge';
import Ionicons from '@expo/vector-icons/Ionicons';
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
    <Card variationKey="profile-performance">
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

      <RidgeDivider style={styles.divider} />

      <View style={styles.group}>
        <Text style={styles.groupTitle}>{effortTitle}</Text>
        <Text style={styles.groupHint}>{effortHint}</Text>

        <View style={styles.metricsRow}>
          <Field
            containerStyle={styles.metricBlock}
            inputAccessoryViewID="pace-yourself-numeric-keyboard"
            keyboardType="number-pad"
            label={utmbIndexLabel}
            maxLength={4}
            onChangeText={onChangeUtmbIndex}
            placeholder="600"
            value={utmbIndex}
          />

          <View style={[styles.metricBlock, styles.paceMetricBlock]}>
            <Text style={styles.label}>{comfortableFlatPaceLabel}</Text>
            <View style={styles.paceCard}>
              <Field
                accessibilityLabel={`${comfortableFlatPaceLabel}, ${paceMinutesLabel}`}
                containerStyle={styles.paceInputGroup}
                inputAccessoryViewID="pace-yourself-numeric-keyboard"
                keyboardType="number-pad"
                label={paceMinutesLabel}
                maxLength={2}
                onChangeText={onChangePaceMinutes}
                placeholder="6"
                value={paceMinutes}
              />
              <Text style={styles.paceSeparator}>:</Text>
              <Field
                accessibilityLabel={`${comfortableFlatPaceLabel}, ${paceSecondsLabel}`}
                containerStyle={styles.paceInputGroup}
                inputAccessoryViewID="pace-yourself-numeric-keyboard"
                keyboardType="number-pad"
                label={paceSecondsLabel}
                maxLength={2}
                onChangeText={onChangePaceSeconds}
                placeholder="00"
                unit="/km"
                value={paceSeconds}
              />
            </View>
          </View>
        </View>
      </View>

      <RidgeDivider style={styles.divider} />

      <View style={styles.group}>
        <Text style={styles.inlineSectionTitle}>{planDefaultsTitle}</Text>
        <Text style={styles.groupHint}>{planDefaultsHint}</Text>
        <Text style={styles.groupHint}>{estimatorInlineHint}</Text>

        <TouchableOpacity style={styles.estimateTargetsButton} onPress={onOpenEstimator}>
          <Ionicons name="sparkles-outline" size={16} color={Colors.brandPrimary} />
          <Text style={styles.estimateTargetsButtonText}>{estimatorButtonLabel}</Text>
        </TouchableOpacity>

        <View style={styles.targetsStack}>
          <Field
            inputAccessoryViewID="pace-yourself-numeric-keyboard"
            keyboardType="number-pad"
            label={defaultCarbsLabel}
            maxLength={3}
            onChangeText={onChangeDefaultCarbs}
            placeholder="70"
            unit="g"
            value={defaultCarbsPerHour}
          />
          <Field
            inputAccessoryViewID="pace-yourself-numeric-keyboard"
            keyboardType="number-pad"
            label={defaultWaterLabel}
            maxLength={4}
            onChangeText={onChangeDefaultWater}
            placeholder="500"
            unit="ml"
            value={defaultWaterPerHour}
          />
          <Field
            inputAccessoryViewID="pace-yourself-numeric-keyboard"
            keyboardType="number-pad"
            label={defaultSodiumLabel}
            maxLength={4}
            onChangeText={onChangeDefaultSodium}
            placeholder="600"
            unit="mg"
            value={defaultSodiumPerHour}
          />
        </View>
      </View>
    </Card>
  );
}

export const ProfilePerformanceSection = memo(ProfilePerformanceSectionComponent);

const styles = StyleSheet.create({
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
    marginVertical: 8,
  },
  waterBagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  waterBtn: {
    minHeight: mobileComponents.filterChip.minHeight,
    backgroundColor: Colors.surface,
    paddingHorizontal: mobileComponents.filterChip.paddingHorizontal,
    paddingVertical: 9,
    borderRadius: mobileComponents.filterChip.borderRadius,
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
  paceMetricBlock: {
    minWidth: 230,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 0,
  },
  paceCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  paceInputGroup: {
    flex: 1,
    minWidth: 0,
  },
  paceSeparator: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    paddingBottom: 8,
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
    gap: 12,
  },
});
