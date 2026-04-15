import { memo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

type ProfilePersonalSectionProps = {
  title: string;
  subtitle: string;
  firstNameLabel: string;
  firstNamePlaceholder: string;
  birthDateLabel: string;
  birthDatePlaceholder: string;
  birthDateHelpText: string;
  weightLabel: string;
  weightPlaceholder: string;
  heightLabel: string;
  heightPlaceholder: string;
  fullName: string;
  birthDateInput: string;
  weightKg: string;
  heightCm: string;
  onChangeFullName: (value: string) => void;
  onChangeBirthDate: (value: string) => void;
  onChangeWeightKg: (value: string) => void;
  onChangeHeightCm: (value: string) => void;
};

function ProfilePersonalSectionComponent({
  title,
  subtitle,
  firstNameLabel,
  firstNamePlaceholder,
  birthDateLabel,
  birthDatePlaceholder,
  birthDateHelpText,
  weightLabel,
  weightPlaceholder,
  heightLabel,
  heightPlaceholder,
  fullName,
  birthDateInput,
  weightKg,
  heightCm,
  onChangeFullName,
  onChangeBirthDate,
  onChangeWeightKg,
  onChangeHeightCm,
}: ProfilePersonalSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="person-circle-outline" size={20} color={Colors.brandPrimary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{firstNameLabel}</Text>
        <TextInput
          style={styles.textInput}
          value={fullName}
          onChangeText={onChangeFullName}
          placeholder={firstNamePlaceholder}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
          textContentType="givenName"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{birthDateLabel}</Text>
        <TextInput
          style={styles.textInput}
          value={birthDateInput}
          onChangeText={onChangeBirthDate}
          placeholder={birthDatePlaceholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={10}
        />
        <Text style={styles.helperText}>{birthDateHelpText}</Text>
      </View>

      <View style={styles.bodyMetricsRow}>
        <View style={styles.bodyMetricField}>
          <Text style={styles.label}>{weightLabel}</Text>
          <View style={styles.metricInputShell}>
            <TextInput
              style={styles.metricInput}
              value={weightKg}
              onChangeText={onChangeWeightKg}
              placeholder={weightPlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={styles.metricInputUnit}>kg</Text>
          </View>
        </View>

        <View style={styles.bodyMetricField}>
          <Text style={styles.label}>{heightLabel}</Text>
          <View style={styles.metricInputShell}>
            <TextInput
              style={styles.metricInput}
              value={heightCm}
              onChangeText={onChangeHeightCm}
              placeholder={heightPlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={styles.metricInputUnit}>cm</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export const ProfilePersonalSection = memo(ProfilePersonalSectionComponent);

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
    backgroundColor: Colors.brandSurface,
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
  fieldGroup: {
    marginTop: 12,
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
  helperText: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  bodyMetricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bodyMetricField: {
    flex: 1,
    marginTop: 12,
  },
  metricInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  metricInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    color: Colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  metricInputUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
});
