import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../themed/Card';
import { Field } from '../themed/Field';
import { Text } from '../themed/Text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { DatePickerField } from '../inputs/DatePickerField';

type ProfilePersonalSectionProps = {
  title: string;
  subtitle: string;
  firstNameLabel: string;
  firstNamePlaceholder: string;
  birthDateLabel: string;
  birthDatePlaceholder: string;
  birthDateHelpText: string;
  birthDateClearLabel: string;
  birthDateError?: string | null;
  weightLabel: string;
  weightPlaceholder: string;
  heightLabel: string;
  heightPlaceholder: string;
  heightError?: string | null;
  locale: string;
  datePickerUnavailableMessage: string;
  fullName: string;
  birthDateInput: Date | null;
  weightKg: string;
  weightError?: string | null;
  heightCm: string;
  onChangeFullName: (value: string) => void;
  onChangeBirthDate: (value: Date) => void;
  onClearBirthDate: () => void;
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
  birthDateClearLabel,
  birthDateError,
  weightLabel,
  weightPlaceholder,
  heightLabel,
  heightPlaceholder,
  heightError,
  locale,
  datePickerUnavailableMessage,
  fullName,
  birthDateInput,
  weightKg,
  weightError,
  heightCm,
  onChangeFullName,
  onChangeBirthDate,
  onClearBirthDate,
  onChangeWeightKg,
  onChangeHeightCm,
}: ProfilePersonalSectionProps) {
  return (
    <Card variationKey="profile-personal">
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
        <Field
          autoCapitalize="words"
          label={firstNameLabel}
          onChangeText={onChangeFullName}
          placeholder={firstNamePlaceholder}
          textContentType="givenName"
          value={fullName}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{birthDateLabel}</Text>
        <DatePickerField
          accessibilityLabel={birthDateLabel}
          clearLabel={birthDateClearLabel}
          locale={locale}
          maximumDate={new Date()}
          onChange={onChangeBirthDate}
          onClear={onClearBirthDate}
          placeholder={birthDatePlaceholder}
          unavailableMessage={datePickerUnavailableMessage}
          value={birthDateInput}
        />
        {birthDateError ? <Text style={styles.fieldError}>{birthDateError}</Text> : null}
        <Text style={styles.helperText}>{birthDateHelpText}</Text>
      </View>

      <View style={styles.bodyMetricsRow}>
        <View style={styles.bodyMetricField}>
          <Field
            error={weightError ?? undefined}
            inputAccessoryViewID="pace-yourself-numeric-keyboard"
            keyboardType="number-pad"
            label={weightLabel}
            maxLength={3}
            onChangeText={onChangeWeightKg}
            placeholder={weightPlaceholder}
            unit="kg"
            value={weightKg}
          />
        </View>

        <View style={styles.bodyMetricField}>
          <Field
            error={heightError ?? undefined}
            inputAccessoryViewID="pace-yourself-numeric-keyboard"
            keyboardType="number-pad"
            label={heightLabel}
            maxLength={3}
            onChangeText={onChangeHeightCm}
            placeholder={heightPlaceholder}
            unit="cm"
            value={heightCm}
          />
        </View>
      </View>
    </Card>
  );
}

export const ProfilePersonalSection = memo(ProfilePersonalSectionComponent);

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
  helperText: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  fieldError: {
    color: Colors.danger,
    fontSize: 12,
    lineHeight: 17,
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
});
