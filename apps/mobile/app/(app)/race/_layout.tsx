import { Stack } from 'expo-router';
import { FeedbackHeaderButton } from '../../../components/feedback/FeedbackHeaderButton';
import { Colors } from '../../../constants/colors';
import { useI18n } from '../../../lib/i18n';

export default function RaceLayout() {
  const { locale } = useI18n();

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
        headerRight: () => (
          <FeedbackHeaderButton
            contextLabel={
              route.name === 'new'
                ? locale === 'fr' ? 'Nouvelle course' : 'New race'
                : route.name === '[id]/edit'
                  ? locale === 'fr' ? 'Édition de course' : 'Edit race'
                  : locale === 'fr' ? 'Course' : 'Race'
            }
          />
        ),
      })}
    />
  );
}
