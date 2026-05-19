import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeaderTitle } from '../../components/navigation/AppHeaderTitle';
import { FeedbackHeaderButton } from '../../components/feedback/FeedbackHeaderButton';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { getActivePlanEditHref } from '../../lib/planEditSession';

export const unstable_settings = {
  initialRouteName: 'plans',
};

const ROOT_TAB_ROUTES = new Set(['profile', 'catalog', 'plans', 'nutrition']);

export default function AppLayout() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const catalogLabel = locale === 'fr' ? 'Courses' : 'Races';
  const plansTabLabel = locale === 'fr' ? 'Plans' : 'Plans';
  const nutritionLabel = 'Nutrition';
  const getHeaderTitle = (routeName: string) => {
    switch (routeName) {
      case 'profile':
        return t.profile.title;
      case 'catalog':
        return catalogLabel;
      case 'plans':
        return t.plans.title;
      case 'nutrition':
        return nutritionLabel;
      case 'plan/new':
        return t.plans.newPlan;
      case 'plan/[id]/edit':
        return locale === 'fr' ? 'Modifier le plan' : 'Edit plan';
      case 'training-live':
        return t.trainingLive.title;
      default:
        return 'Pace Yourself';
    }
  };
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
      case 'training-live':
        return t.trainingLive.title;
      default:
        return routeName;
    }
  };
  const getHeaderTitleRightInset = (routeName: string) => {
    switch (routeName) {
      case 'profile':
        return 116;
      case 'catalog':
        return 160;
      default:
        return 72;
    }
  };

  return (
    <Tabs
      backBehavior="initialRoute"
      initialRouteName="plans"
      screenOptions={({ route }) => {
        const isRootTab = ROOT_TAB_ROUTES.has(route.name);

        return {
          headerShown: !isRootTab,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTitle: () => <AppHeaderTitle title={getHeaderTitle(route.name)} />,
          headerTitleContainerStyle: {
            left: 16,
            right: getHeaderTitleRightInset(route.name),
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
        };
      }}
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
        }}
      />

      {/* Center: My Plans — big green standout button */}
      <Tabs.Screen
        name="plans"
        listeners={() => ({
          tabPress: (event) => {
            const activePlanEditHref = getActivePlanEditHref();
            if (!activePlanEditHref) return;

            event.preventDefault();
            router.push(activePlanEditHref as any);
          },
        })}
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
        name="training-live"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}

