import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Card } from '../themed/Card';
import { Text } from '../themed/Text';
import { TrailTabs } from '../themed/TrailTabs';
import { Colors } from '../../constants/colors';
import type { Locale } from '../../locales/types';

type ProfileLanguageSectionProps = {
  languageEnLabel: string;
  languageFrLabel: string;
  onSelectLocale: (locale: Locale) => void;
  selectedLocale: Locale;
  title: string;
};

function ProfileLanguageSectionComponent({
  languageEnLabel,
  languageFrLabel,
  onSelectLocale,
  selectedLocale,
  title,
}: ProfileLanguageSectionProps) {
  return (
    <Card style={styles.card} variationKey="profile-language">
      <Text style={styles.title}>{title}</Text>

      <TrailTabs<Locale>
        activeKey={selectedLocale}
        onChange={onSelectLocale}
        stretch
        tabs={[
          { key: 'fr', label: `FR ${languageFrLabel}` },
          { key: 'en', label: `EN ${languageEnLabel}` },
        ]}
      />
    </Card>
  );
}

export const ProfileLanguageSection = memo(ProfileLanguageSectionComponent);

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
});
