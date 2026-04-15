import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';
import type { Locale } from '../../locales/types';

type ProfileLanguageSectionProps = {
  languageEnLabel: string;
  languageFrLabel: string;
  onOpenPrivacyPolicy: () => void;
  onSelectLocale: (locale: Locale) => void;
  privacyPolicyLabel: string;
  selectedLocale: Locale;
  title: string;
};

function ProfileLanguageSectionComponent({
  languageEnLabel,
  languageFrLabel,
  onOpenPrivacyPolicy,
  onSelectLocale,
  privacyPolicyLabel,
  selectedLocale,
  title,
}: ProfileLanguageSectionProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.languageButton, selectedLocale === 'fr' && styles.languageButtonActive]}
          onPress={() => onSelectLocale('fr')}
        >
          <Text style={[styles.languageButtonText, selectedLocale === 'fr' && styles.languageButtonTextActive]}>
            FR {languageFrLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.languageButton, selectedLocale === 'en' && styles.languageButtonActive]}
          onPress={() => onSelectLocale('en')}
        >
          <Text style={[styles.languageButtonText, selectedLocale === 'en' && styles.languageButtonTextActive]}>
            EN {languageEnLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={onOpenPrivacyPolicy}>
        <Text style={styles.secondaryButtonText}>{privacyPolicyLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const ProfileLanguageSection = memo(ProfileLanguageSectionComponent);

const styles = StyleSheet.create({
  card: {
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 16,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  languageButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  languageButtonActive: {
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  languageButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  languageButtonTextActive: {
    color: Colors.brandPrimary,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
