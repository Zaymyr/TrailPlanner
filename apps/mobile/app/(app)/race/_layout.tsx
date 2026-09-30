import { Stack } from 'expo-router';

import { AppHeaderTitle } from '../../../components/navigation/AppHeaderTitle';
import { FeedbackHeaderButton } from '../../../components/feedback/FeedbackHeaderButton';
import { Colors } from '../../../constants/colors';
import { useI18n } from '../../../lib/i18n';

export default function RaceLayout() {
  const { locale, t } = useI18n();

  const getHeaderTitle = (routeName: string) =>
    routeName === '[id]/racebook'
        ? t.catalog.racebookTitle
      : locale === 'fr'
          ? 'Course'
          : 'Race';

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: route.name !== '[id]/racebook',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: Colors.background },
        headerTitleAlign: 'left',
        headerTitle: () => <AppHeaderTitle title={getHeaderTitle(route.name)} />,
        headerRight: () => <FeedbackHeaderButton contextLabel={getHeaderTitle(route.name)} />,
      })}
    />
  );
}
