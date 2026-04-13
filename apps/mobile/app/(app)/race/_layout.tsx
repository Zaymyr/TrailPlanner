import { Stack } from 'expo-router';

import { AppHeaderTitle } from '../../../components/navigation/AppHeaderTitle';
import { FeedbackHeaderButton } from '../../../components/feedback/FeedbackHeaderButton';
import { Colors } from '../../../constants/colors';
import { useI18n } from '../../../lib/i18n';

export default function RaceLayout() {
  const { locale } = useI18n();

  const getHeaderTitle = (routeName: string) =>
    routeName === 'new'
      ? locale === 'fr'
        ? 'Nouvelle course'
        : 'New race'
      : routeName === '[id]/edit'
        ? locale === 'fr'
          ? 'Modifier la course'
          : 'Edit race'
        : locale === 'fr'
          ? 'Course'
          : 'Race';

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
        headerTitleAlign: 'left',
        headerTitle: () => <AppHeaderTitle title={getHeaderTitle(route.name)} />,
        headerRight: () => <FeedbackHeaderButton contextLabel={getHeaderTitle(route.name)} />,
      })}
    />
  );
}
