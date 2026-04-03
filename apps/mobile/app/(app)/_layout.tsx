import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text } from 'react-native';
import { FeedbackHeaderButton } from '../../components/feedback/FeedbackHeaderButton';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';

export const unstable_settings = {
  initialRouteName: 'plans',
};

export default function AppLayout() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const catalogLabel = locale === 'fr' ? 'Courses' : 'Races';
  const plansTabLabel = locale === 'fr' ? 'Plans' : 'Plans';
  const nutritionLabel = 'Nutrition';
  const getFeedbackContext = (routeName: string) => {
    switch (routeName) {
      case 'profile':
        return t.profile.title;
      case 'catalog':
        return catalogLabel;
      case 'plans':
      case 'plan':
        return t.plans.title;
      case 'nutrition':
        return nutritionLabel;
      case 'plan/new':
        return t.plans.newPlan;
      case 'plan/[id]/edit':
        return locale === 'fr' ? 'Edition du plan' : 'Edit plan';
      default:
        return routeName;
    }
  };

  return (
    <Tabs
      backBehavior="initialRoute"
      initialRouteName="plans"
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          color: Colors.textPrimary,
          fontSize: 22,
          fontWeight: '800',
        },
        headerTitleContainerStyle: {
          paddingHorizontal: 12,
        },
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: Colors.brandPrimary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerRight: () => (
          <FeedbackHeaderButton contextLabel={getFeedbackContext(route.name)} />
        ),
      })}
    >
      {/* Far left: Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile.title,
          tabBarLabel: t.profile.title,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />

      {/* Left of center: Courses catalog */}
      <Tabs.Screen
        name="catalog"
        options={{
          title: catalogLabel,
          tabBarLabel: catalogLabel,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trail-sign" size={size} color={color} />
          ),
          headerRight: () => (
            <FeedbackHeaderButton
              contextLabel={catalogLabel}
              leading={(
                <TouchableOpacity
                  onPress={() => router.push('/(app)/race/new')}
                  style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                >
                  <Text style={{ color: Colors.brandPrimary, fontSize: 26, fontWeight: '600' }}>+</Text>
                </TouchableOpacity>
              )}
            />
          ),
        }}
      />

      {/* Center: My Plans — big green standout button */}
      <Tabs.Screen
        name="plans"
        options={{
          title: t.plans.title,
          tabBarLabel: plansTabLabel,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />

      {/* Right: Nutrition */}
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarLabel: nutritionLabel,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="nutrition" size={size} color={color} />
          ),
        }}
      />

      {/* Non-tab screens — hidden from tab bar */}
      <Tabs.Screen
        name="race"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="plan"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="plan/new"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="plan/[id]/edit"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}

