import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeaderTitle } from '../../components/navigation/AppHeaderTitle';
import { FeedbackHeaderButton } from '../../components/feedback/FeedbackHeaderButton';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { getActivePlanEditHref } from '../../lib/planEditSession';
import {
  addOnboardingStatusListener,
  DEFAULT_ONBOARDING_STATUSES,
  hasPendingOnboarding,
  loadOnboardingStatuses,
} from '../../lib/onboardingStatus';
import { supabase } from '../../lib/supabase';

export const unstable_settings = {
  initialRouteName: 'catalog',
};

const ROOT_TAB_ROUTES = new Set(['profile', 'catalog', 'plans', 'nutrition']);
const TAB_BAR_CONTENT_HEIGHT = 60;
const TAB_BAR_MIN_BOTTOM_PADDING = 8;

export default function AppLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale, t } = useI18n();
  const catalogLabel = locale === 'fr' ? 'Courses' : 'Races';
  const plansTabLabel = locale === 'fr' ? 'Plans' : 'Plans';
  const nutritionLabel = 'Nutrition';
  const [showProfileOnboardingDot, setShowProfileOnboardingDot] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const applyStatuses = (statuses = DEFAULT_ONBOARDING_STATUSES) => {
      if (!cancelled) setShowProfileOnboardingDot(hasPendingOnboarding(statuses));
    };
    const refresh = () => {
      void loadOnboardingStatuses().then(applyStatuses).catch(() => undefined);
    };
    refresh();
    const removeStatusListener = addOnboardingStatusListener(applyStatuses);
    const { data: authListener } = supabase.auth.onAuthStateChange(() => refresh());
    return () => {
      cancelled = true;
      removeStatusListener();
      authListener.subscription.unsubscribe();
    };
  }, []);
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
      case 'plan/[id]/summary':
        return t.planSummary.title;
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
      case 'plan/[id]/summary':
        return t.planSummary.title;
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
      case 'plan/[id]/edit':
        return 120;
      default:
        return 72;
    }
  };

  return (
    <Tabs
      backBehavior="history"
      initialRouteName="catalog"
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
            height:
              TAB_BAR_CONTENT_HEIGHT +
              Math.max(TAB_BAR_MIN_BOTTOM_PADDING, insets.bottom),
            paddingBottom: Math.max(TAB_BAR_MIN_BOTTOM_PADDING, insets.bottom),
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
            <View style={styles.profileIconWrap}>
              <Ionicons name="person" size={size} color={color} />
              {showProfileOnboardingDot ? (
                <View accessibilityLabel={t.onboarding.tours.profileDotLabel} style={styles.onboardingDot} />
              ) : null}
            </View>
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
        name="race/[id]/racebook"
        options={{ href: null }}
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
        name="plan/[id]/summary"
        options={{ href: null, headerRight: () => null }}
      />
      <Tabs.Screen
        name="training-live"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{ href: null, headerShown: false, tabBarStyle: { display: 'none' } }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  profileIconWrap: { position: 'relative' },
  onboardingDot: {
    position: 'absolute',
    right: -4,
    top: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.background,
    backgroundColor: Colors.danger,
  },
});

