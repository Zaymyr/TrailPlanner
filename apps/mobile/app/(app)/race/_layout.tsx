import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

import { AppHeaderTitle } from '../../../components/navigation/AppHeaderTitle';
import { FeedbackHeaderButton } from '../../../components/feedback/FeedbackHeaderButton';
import { Colors } from '../../../constants/colors';
import { useI18n } from '../../../lib/i18n';

export default function RaceLayout() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(app)/catalog');
  };

  const getHeaderTitle = (routeName: string) =>
    routeName === 'new'
      ? locale === 'fr'
        ? 'Nouvelle course'
        : 'New race'
      : routeName === '[id]/racebook'
        ? t.catalog.racebookTitle
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
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: Colors.background },
        headerTitleAlign: 'left',
        headerTitle: () => <AppHeaderTitle title={getHeaderTitle(route.name)} />,
        headerLeft:
          route.name === '[id]/racebook'
            ? () => (
                <TouchableOpacity
                  accessibilityLabel={t.common.back}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={handleBack}
                  style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  testID="racebook-back-to-catalog"
                >
                  <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
              )
            : undefined,
        headerRight: () => <FeedbackHeaderButton contextLabel={getHeaderTitle(route.name)} />,
      })}
    />
  );
}
